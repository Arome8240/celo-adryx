# my-celo-app - Smart Contracts

This directory contains the smart contracts for my-celo-app, built with Hardhat and optimized for the Celo blockchain.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Compile contracts
pnpm compile

# Run tests
pnpm test

# Deploy to Celo Sepolia Testnet
pnpm deploy:celo-sepolia

# Deploy to Celo Mainnet
pnpm deploy:celo
```

## 📜 Available Scripts

- `pnpm compile` - Compile smart contracts
- `pnpm test` - Run contract tests
- `pnpm deploy` - Deploy to local network
- `pnpm deploy:celo-sepolia` - Deploy to Celo Sepolia Testnet
- `pnpm deploy:celo` - Deploy to Celo Mainnet
- `pnpm verify` - Verify contracts on Etherscan
- `pnpm clean` - Clean artifacts and cache

## 🌐 Networks

### Celo Mainnet
- **Chain ID**: 42220
- **RPC URL**: https://forno.celo.org
- **Explorer**: https://celoscan.io

### Celo Sepolia Testnet
- **Chain ID**: 11142220
- **RPC URL**: https://forno.celo-sepolia.celo-testnet.org/
- **Explorer**: https://sepolia.celoscan.io/
- **Faucet**: https://faucet.celo.org/celo-sepolia


## 🔧 Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your private key and API keys:
   ```env
   PRIVATE_KEY=your_private_key_without_0x_prefix
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

## 📁 Project Structure

```text
contracts/                 # Smart contract source files
├── FlightEscrow.sol        # Holds a customer's cUSD deposit per booking until release()/refund()
└── mocks/
    └── MockERC20.sol       # Test-only stand-in for cUSD

test/                      # Contract tests
└── FlightEscrow.ts         # Full lifecycle: deposit, release, refund, and every reject path

ignition/                  # Deployment scripts
└── modules/
    └── FlightEscrow.ts     # FlightEscrow deployment — takes tokenAddress/treasuryAddress/
                             # adminAddress/operatorAddress as required --parameters

hardhat.config.ts          # Hardhat configuration
tsconfig.json               # TypeScript configuration
```

## 🔒 FlightEscrow

One deposit per booking (`bookingIdHash = keccak256(bytes(bookingId))`, computed identically
by the backend). `deposit()` is open to any wallet; `release()` (→ treasury) and `refund()`
(→ original payer) are restricted to an `OPERATOR_ROLE` address distinct from the
`DEFAULT_ADMIN_ROLE` that can update the treasury address. See `apps/api`'s Phase 5 payments
module for how the backend drives this.

Deploy with explicit parameters (no defaults — a real deploy should never silently fall back
to a placeholder address):

```bash
npx hardhat ignition deploy ignition/modules/FlightEscrow.ts \
  --network celo-sepolia \
  --parameters '{"FlightEscrowModule":{"tokenAddress":"0x...","treasuryAddress":"0x...","adminAddress":"0x...","operatorAddress":"0x..."}}'
```

## 🔐 Security Notes

- Never commit your `.env` file with real private keys
- Use a dedicated wallet for development/testing
- Test thoroughly on Celo Sepolia Testnet before CeloMainnet deployment
- Consider using a hardware wallet for mainnet deployments

## 📚 Learn More

- [Hardhat Documentation](https://hardhat.org/docs)
- [Celo Developer Documentation](https://docs.celo.org)
- [Viem Documentation](https://viem.sh) (Ethereum library used by Hardhat)
