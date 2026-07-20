import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseEventLogs,
  toBytes,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { FLIGHT_ESCROW_ABI, MENTO_BROKER_ABI } from './lib/flight-escrow-abi';

export interface EscrowState {
  payer: Hex;
  amount: bigint;
  /** 0 = None, 1 = Deposited, 2 = Released, 3 = Refunded — mirrors FlightEscrow.sol's Status enum. */
  status: number;
  isNative: boolean;
}

/** USDm (and every other Celo-native stable asset, and CELO itself) uses 18 decimals. */
const TOKEN_DECIMALS = 18n;
/** Booking amounts are stored in USD cents (2 decimals) — see Booking.totalAmountMinor. */
const CURRENCY_DECIMALS = 2n;

/**
 * Canonical Mento protocol addresses, keyed by chain id — these are
 * fixed, public protocol contracts (not per-deployment secrets), so they're
 * hardcoded here rather than pulled from env vars. Used only as a live price
 * reference (getAmountIn) for the non-MiniPay "pay with CELO" path; the
 * escrow itself never calls into Mento; it just custodies native CELO.
 * Verified directly on-chain (eth_getCode + a real getAmountOut call), not
 * just from docs — see TASKS.md Phase 8.
 */
const MENTO_CONFIG: Record<
  number,
  { broker: Hex; exchangeProvider: Hex; exchangeId: Hex; celoAddress: Hex }
> = {
  42220: {
    // Celo mainnet
    broker: '0x777A8255cA72412f0d706dc03C9D1987306B4CaD',
    exchangeProvider: '0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901',
    exchangeId:
      '0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c',
    celoAddress: '0x471EcE3750Da237f93B8E339c536989b8978a438',
  },
  11142220: {
    // Celo Sepolia testnet
    broker: '0xB9Ae2065142EB79b6c5EB1E8778F883fad6B07Ba',
    exchangeProvider: '0xeCB3C656C131fCd9bB8D1d80898716bD684feb78',
    exchangeId:
      '0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c',
    celoAddress: '0x471EcE3750Da237f93B8E339c536989b8978a438',
  },
  // TEMPORARY — local Hardhat verification only (MockMentoBroker), see
  // TASKS.md Phase 8. Remove before/after this round of local testing; a
  // real deploy never runs on chain 31337.
  31337: {
    broker: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    exchangeProvider: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    exchangeId:
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    celoAddress: '0x471EcE3750Da237f93B8E339c536989b8978a438',
  },
};

/**
 * Owns the viem clients talking to the escrow contract. Configuration is
 * read lazily (not in the constructor) so the app can boot without these
 * vars set — only a payment-flow call actually needs them, same reasoning
 * as AmadeusAuthService's lazy client init.
 */
@Injectable()
export class CeloService {
  private publicClient: PublicClient | null = null;
  private walletClient: WalletClient | null = null;

  constructor(private readonly config: ConfigService) {}

  get escrowContractAddress(): Hex {
    return this.requireAddress('ESCROW_CONTRACT_ADDRESS');
  }

  get tokenAddress(): Hex {
    return this.requireAddress('USDM_TOKEN_ADDRESS');
  }

  get chainId(): number {
    return Number(this.requireString('CHAIN_ID'));
  }

  /** `keccak256(bytes(bookingId))` — identical on the contract side, so a Prisma cuid maps deterministically to the on-chain key. */
  bookingIdHash(bookingId: string): Hex {
    return keccak256(toBytes(bookingId));
  }

  /** USD cents -> the token's smallest unit (18 decimals). Used for the USDm/ERC20 deposit path, where the peg is exact. */
  toTokenAmount(amountMinor: number): bigint {
    return BigInt(amountMinor) * 10n ** (TOKEN_DECIMALS - CURRENCY_DECIMALS);
  }

  /**
   * How much native CELO is needed right now for a booking's USD price —
   * the non-MiniPay deposit path. CELO floats against the dollar (unlike
   * USDm), so this is a live quote off Mento's Broker (the same AMM anyone
   * would actually swap through), not a fixed conversion. Quote-then-deposit
   * has an inherent small race against price movement — see
   * `isNativeAmountAcceptable` for how that's handled at confirm time.
   */
  async quoteNativeAmountForUsd(amountMinor: number): Promise<bigint> {
    const usdmAmount = this.toTokenAmount(amountMinor);
    const mento = this.getMentoConfig();
    const amountIn = await this.getPublicClient().readContract({
      address: mento.broker,
      abi: MENTO_BROKER_ABI,
      functionName: 'getAmountIn',
      args: [
        mento.exchangeProvider,
        mento.exchangeId,
        mento.celoAddress,
        this.tokenAddress,
        usdmAmount,
      ],
    });
    return amountIn;
  }

  /**
   * Whether an actually-deposited native CELO amount is close enough to a
   * fresh quote to accept — CELO's price can move in the seconds between
   * `initiate` and the deposit transaction landing, so this isn't (and
   * shouldn't be) an exact-match check. 3% either side of a quote taken at
   * confirm time is generous enough to absorb normal price movement while
   * still catching a wildly wrong/stale amount.
   */
  async isNativeAmountAcceptable(
    amountMinor: number,
    depositedAmount: bigint,
  ): Promise<boolean> {
    const freshQuote = await this.quoteNativeAmountForUsd(amountMinor);
    const tolerance = (freshQuote * 3n) / 100n;
    const min = freshQuote > tolerance ? freshQuote - tolerance : 0n;
    const max = freshQuote + tolerance;
    return depositedAmount >= min && depositedAmount <= max;
  }

  async getTransactionReceipt(hash: Hex): Promise<TransactionReceipt> {
    return this.getPublicClient().getTransactionReceipt({ hash });
  }

  /** Decodes every `Deposited` event in a receipt's logs — used to confirm a specific deposit actually happened, rather than trusting the caller's say-so. */
  decodeDepositedLogs(receipt: TransactionReceipt): Array<{
    bookingIdHash: Hex;
    payer: Hex;
    amount: bigint;
    isNative: boolean;
  }> {
    const decoded = parseEventLogs({
      abi: FLIGHT_ESCROW_ABI,
      eventName: 'Deposited',
      logs: receipt.logs,
    });
    return decoded.map((log) => ({
      bookingIdHash: log.args.bookingIdHash,
      payer: log.args.payer,
      amount: log.args.amount,
      isNative: log.args.isNative,
    }));
  }

  async getEscrow(bookingIdHash: Hex): Promise<EscrowState> {
    const [payer, amount, status, isNative] =
      (await this.getPublicClient().readContract({
        address: this.escrowContractAddress,
        abi: FLIGHT_ESCROW_ABI,
        functionName: 'escrows',
        args: [bookingIdHash],
      })) as [Hex, bigint, number, boolean];
    return { payer, amount, status, isNative };
  }

  /** Calls release() from the operator wallet and waits for the receipt — reverts surface as a thrown error. */
  async release(bookingIdHash: Hex): Promise<Hex> {
    return this.writeAndWait('release', bookingIdHash);
  }

  /** Calls refund() from the operator wallet and waits for the receipt — reverts surface as a thrown error. */
  async refund(bookingIdHash: Hex): Promise<Hex> {
    return this.writeAndWait('refund', bookingIdHash);
  }

  private async writeAndWait(
    functionName: 'release' | 'refund',
    bookingIdHash: Hex,
  ): Promise<Hex> {
    const wallet = this.getWalletClient();
    const publicClient = this.getPublicClient();
    if (!wallet.account) {
      throw new InternalServerErrorException('Operator wallet has no account');
    }

    const hash = await wallet.writeContract({
      address: this.escrowContractAddress,
      abi: FLIGHT_ESCROW_ABI,
      functionName,
      args: [bookingIdHash],
      account: wallet.account,
      chain: wallet.chain,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new InternalServerErrorException(
        `FlightEscrow.${functionName}() reverted (tx ${hash})`,
      );
    }
    return hash;
  }

  private getMentoConfig() {
    const config = MENTO_CONFIG[this.chainId];
    if (!config) {
      throw new InternalServerErrorException(
        `No Mento protocol addresses known for chain ${this.chainId} — native CELO payments aren't supported on this network yet`,
      );
    }
    return config;
  }

  private getPublicClient(): PublicClient {
    if (this.publicClient) return this.publicClient;
    this.publicClient = createPublicClient({
      chain: this.getChain(),
      transport: http(this.requireString('CELO_RPC_URL')),
    }) as PublicClient;
    return this.publicClient;
  }

  private getWalletClient(): WalletClient {
    if (this.walletClient) return this.walletClient;
    const rawKey = this.requireString('OPERATOR_PRIVATE_KEY');
    const account = privateKeyToAccount(
      (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as Hex,
    );
    this.walletClient = createWalletClient({
      account,
      chain: this.getChain(),
      transport: http(this.requireString('CELO_RPC_URL')),
    });
    return this.walletClient;
  }

  private getChain() {
    const chainId = this.chainId;
    if (chainId === celo.id) return celo;
    // Anything else (Celo Sepolia, or a local Hardhat node for testing) —
    // viem has no dedicated Celo Sepolia chain export yet, so define one
    // generically rather than misusing an unrelated chain's shape.
    return defineChain({
      id: chainId,
      name: `celo-chain-${chainId}`,
      nativeCurrency: celo.nativeCurrency,
      rpcUrls: { default: { http: [this.requireString('CELO_RPC_URL')] } },
    });
  }

  private requireString(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured`);
    }
    return value;
  }

  private requireAddress(key: string): Hex {
    return this.requireString(key) as Hex;
  }
}
