import { SiweMessage } from 'siwe';
import { Wallet as EthersWallet } from 'ethers';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  erc20Abi,
  defineChain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const API = 'http://localhost:4100';
const RPC = 'http://127.0.0.1:8545';
const localChain = defineChain({
  id: 31337,
  name: 'local',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const ESCROW_ABI = parseAbi([
  'function deposit(bytes32 bookingIdHash, uint256 amount)',
  'function depositNative(bytes32 bookingIdHash) payable',
]);

const CUSTOMER_PRIVATE_KEY =
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';
const TREASURY_ADDRESS = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

const customerAccount = privateKeyToAccount(CUSTOMER_PRIVATE_KEY);
const customerWallet = createWalletClient({
  account: customerAccount,
  chain: localChain,
  transport: http(RPC),
});
const publicClient = createPublicClient({ chain: localChain, transport: http(RPC) });

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function siweLogin() {
  const ethersWallet = EthersWallet.createRandom();
  const { nonce } = await api('/auth/nonce');
  const siweMessage = new SiweMessage({
    domain: 'localhost:3000',
    address: ethersWallet.address,
    statement: 'Sign in to my-celo-app.',
    uri: 'http://localhost:3000',
    version: '1',
    chainId: 42220,
    nonce,
  });
  const message = siweMessage.prepareMessage();
  const signature = await ethersWallet.signMessage(message);
  const result = await api('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ message, signature }),
  });
  return result.accessToken;
}

async function createBooking(accessToken) {
  const searchRes = await api('/flights/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      tripType: 'ONE_WAY',
      segments: [{ origin: 'IST', destination: 'LHR', departureDate: '2026-11-20' }],
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: 'ECONOMY',
    }),
  });

  const turkish = searchRes.offers.find((o) => o.airlineCodes.includes('TK'));
  const offer = turkish ?? searchRes.offers[0];
  if (!offer) throw new Error('No offers returned from Amadeus test search');
  console.log('  using offer', offer.id, offer.airlineCodes, offer.totalPriceMinor);

  const booking = await api('/bookings/flights', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      searchId: searchRes.searchId,
      offerId: offer.id,
      tripType: 'ONE_WAY',
      contactEmail: 'dual-asset-verify@example.com',
      contactPhone: '+14155552671',
      passengers: [
        {
          type: 'ADULT',
          title: 'Mr',
          firstName: 'Dual',
          lastName: 'Asset',
          gender: 'MALE',
          dateOfBirth: '1990-01-01',
          nationality: 'US',
          documentType: 'PASSPORT',
          documentNumber: 'X1234567',
          documentExpiry: '2030-01-01',
          documentIssuingCountry: 'US',
        },
      ],
    }),
  });
  console.log('  booking created', booking.id, 'PNR:', booking.flightBooking?.pnr);
  return booking;
}

async function verifyUsdmPath(accessToken) {
  console.log('\n=== USDM (ERC20) path ===');
  const booking = await createBooking(accessToken);

  const quote = await api(`/payments/bookings/${booking.id}/initiate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ asset: 'USDM' }),
  });
  console.log('  quote:', quote);
  if (quote.isNative) throw new Error('expected isNative=false for USDM');

  const amount = BigInt(quote.amount);
  const approveHash = await customerWallet.writeContract({
    address: quote.tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [quote.contractAddress, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const depositHash = await customerWallet.writeContract({
    address: quote.contractAddress,
    abi: ESCROW_ABI,
    functionName: 'deposit',
    args: [quote.bookingIdHash, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log('  deposited', amount.toString(), 'wei USDm, tx', depositHash);

  const treasuryBefore = await publicClient.readContract({
    address: quote.tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [TREASURY_ADDRESS],
  });

  const confirmed = await api(`/payments/bookings/${booking.id}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ txHash: depositHash }),
  });
  console.log('  confirmed booking status:', confirmed.status, 'payment status:', confirmed.payment?.status);

  const treasuryAfter = await publicClient.readContract({
    address: quote.tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [TREASURY_ADDRESS],
  });

  const delta = treasuryAfter - treasuryBefore;
  console.log('  treasury USDm balance delta:', delta.toString(), 'expected:', amount.toString());
  if (delta !== amount) throw new Error('USDm treasury balance delta mismatch!');
  if (confirmed.status !== 'CONFIRMED') throw new Error('booking not CONFIRMED');
  if (confirmed.payment?.status !== 'SUCCEEDED') throw new Error('payment not SUCCEEDED');
  console.log('  USDM PATH: PASS');
}

async function verifyCeloPath(accessToken) {
  console.log('\n=== CELO (native) path ===');
  const booking = await createBooking(accessToken);

  const quote = await api(`/payments/bookings/${booking.id}/initiate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ asset: 'CELO' }),
  });
  console.log('  quote:', quote);
  if (!quote.isNative) throw new Error('expected isNative=true for CELO');
  if (quote.tokenAddress !== null) throw new Error('expected tokenAddress=null for native path');

  const amount = BigInt(quote.amount);
  const treasuryBefore = await publicClient.getBalance({ address: TREASURY_ADDRESS });

  const depositHash = await customerWallet.writeContract({
    address: quote.contractAddress,
    abi: ESCROW_ABI,
    functionName: 'depositNative',
    args: [quote.bookingIdHash],
    value: amount,
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log('  deposited', amount.toString(), 'wei native CELO, tx', depositHash);

  const confirmed = await api(`/payments/bookings/${booking.id}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ txHash: depositHash }),
  });
  console.log('  confirmed booking status:', confirmed.status, 'payment status:', confirmed.payment?.status);

  const treasuryAfter = await publicClient.getBalance({ address: TREASURY_ADDRESS });
  const delta = treasuryAfter - treasuryBefore;
  console.log('  treasury CELO balance delta:', delta.toString(), 'expected:', amount.toString());
  if (delta !== amount) throw new Error('CELO treasury balance delta mismatch!');
  if (confirmed.status !== 'CONFIRMED') throw new Error('booking not CONFIRMED');
  if (confirmed.payment?.status !== 'SUCCEEDED') throw new Error('payment not SUCCEEDED');
  console.log('  CELO PATH: PASS');

  return booking.id;
}

async function verifyRefundPath(accessToken) {
  console.log('\n=== Native CELO refund path (pre-release simulation) ===');
  const booking = await createBooking(accessToken);
  const quote = await api(`/payments/bookings/${booking.id}/initiate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ asset: 'CELO' }),
  });
  const amount = BigInt(quote.amount);

  const depositHash = await customerWallet.writeContract({
    address: quote.contractAddress,
    abi: ESCROW_ABI,
    functionName: 'depositNative',
    args: [quote.bookingIdHash],
    value: amount,
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log('  deposited (not confirmed/released), tx', depositHash);

  // Simulate "verified but not yet released" by writing depositTxHash
  // directly — confirm() always auto-releases, so this state barely
  // persists in practice, but ops.refund() must still handle it correctly.
  const { execSync } = await import('child_process');
  const sql = `UPDATE "Payment" SET "depositTxHash" = '${depositHash}' WHERE "escrowBookingIdHash" = '${quote.bookingIdHash}';`;
  execSync(
    `PGPASSWORD=postgres PGSSLMODE=disable psql -h localhost -p 51221 -U postgres -d template1 -c "${sql}"`,
    { stdio: 'inherit' },
  );

  const customerBalanceBefore = await publicClient.getBalance({
    address: customerAccount.address,
  });

  const refundResult = await api(`/payments/bookings/${booking.id}/refund`, {
    method: 'POST',
    headers: { 'X-Ops-Secret': 'dev-only-ops-secret-change-me' },
  });
  console.log('  refund result:', refundResult);

  const customerBalanceAfter = await publicClient.getBalance({
    address: customerAccount.address,
  });
  const delta = customerBalanceAfter - customerBalanceBefore;
  console.log('  customer CELO balance delta:', delta.toString(), 'expected:', amount.toString());
  if (delta !== amount) throw new Error('customer refund balance delta mismatch!');

  const bookingAfter = await api(`/bookings/${booking.id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log('  booking status after refund:', bookingAfter.status);
  if (bookingAfter.status !== 'CANCELLED') throw new Error('booking not CANCELLED after refund');
  console.log('  REFUND PATH: PASS');
}

async function main() {
  const accessToken = await siweLogin();
  console.log('Logged in, accessToken acquired');

  await verifyUsdmPath(accessToken);
  await verifyCeloPath(accessToken);
  await verifyRefundPath(accessToken);

  console.log('\nALL DUAL-ASSET VERIFICATION PASSED');
}

main().catch((err) => {
  console.error('\nVERIFICATION FAILED:', err);
  process.exit(1);
});
