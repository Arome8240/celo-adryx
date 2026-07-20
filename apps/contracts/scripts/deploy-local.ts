// One-off local verification helper — deploys MockERC20 + FlightEscrow to
// whatever network this is run against (intended for the local Hardhat
// node), mints test tokens to a "customer" account, and prints an .env
// snippet apps/api can source to exercise the real payments flow against a
// real (local) chain. Never run this against Celo mainnet/Sepolia — it
// deploys a fake token, not real USDm/cUSD.
import hre from "hardhat";
import { parseEther } from "viem";

async function main() {
  const [admin, operator, treasury, customer] =
    await hre.viem.getWalletClients();

  const token = await hre.viem.deployContract("MockERC20", [
    "Mock USDm",
    "mUSDm",
  ]);
  await token.write.mint([customer.account.address, parseEther("10000")]);

  const escrow = await hre.viem.deployContract("FlightEscrow", [
    token.address,
    treasury.account.address,
    admin.account.address,
    operator.account.address,
  ]);

  // Only needed to exercise the native-CELO quote path locally — real
  // networks use the real Mento Broker (see celo.service.ts's MENTO_CONFIG).
  const mockBroker = await hre.viem.deployContract("MockMentoBroker", []);

  // Well-known Hardhat default-mnemonic private keys (publicly documented,
  // test-only) — hre.viem's wallet clients don't expose the raw key
  // directly since the node itself signs for its own accounts, so these
  // are hardcoded here for accounts #1 (operator) and #3 (customer).
  const OPERATOR_PRIVATE_KEY =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const CUSTOMER_PRIVATE_KEY =
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";

  console.log("--- Local deployment (for verification only) ---");
  console.log("CELO_RPC_URL=http://127.0.0.1:8545");
  console.log("CHAIN_ID=31337");
  console.log(`USDM_TOKEN_ADDRESS=${token.address}`);
  console.log(`ESCROW_CONTRACT_ADDRESS=${escrow.address}`);
  console.log(`OPERATOR_PRIVATE_KEY=${OPERATOR_PRIVATE_KEY}`);
  console.log(`TREASURY_ADDRESS=${treasury.account.address}`);
  console.log(`MOCK_MENTO_BROKER_ADDRESS=${mockBroker.address}`);
  console.log("--- test accounts ---");
  console.log(`customer address: ${customer.account.address}`);
  console.log(`customer private key: ${CUSTOMER_PRIVATE_KEY}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
