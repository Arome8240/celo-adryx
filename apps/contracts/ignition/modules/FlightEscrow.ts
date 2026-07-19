// Deploys FlightEscrow. All four constructor args are required parameters —
// deliberately no fallback/example defaults here, since a real deploy
// silently picking up a placeholder address would be far worse than the
// deploy just failing until you supply them.
//
// Usage:
//   npx hardhat ignition deploy ignition/modules/FlightEscrow.ts \
//     --network celo-sepolia \
//     --parameters '{"FlightEscrowModule":{"tokenAddress":"0x...","treasuryAddress":"0x...","adminAddress":"0x...","operatorAddress":"0x..."}}'
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FlightEscrowModule = buildModule("FlightEscrowModule", (m) => {
  const tokenAddress = m.getParameter("tokenAddress");
  const treasuryAddress = m.getParameter("treasuryAddress");
  const adminAddress = m.getParameter("adminAddress");
  const operatorAddress = m.getParameter("operatorAddress");

  const flightEscrow = m.contract("FlightEscrow", [
    tokenAddress,
    treasuryAddress,
    adminAddress,
    operatorAddress,
  ]);

  return { flightEscrow };
});

export default FlightEscrowModule;
