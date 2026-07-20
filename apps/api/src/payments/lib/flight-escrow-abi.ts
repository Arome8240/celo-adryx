/**
 * Minimal ABI — just the surface this backend actually calls/decodes
 * (deposit/depositNative/release/refund plus the escrows() getter and
 * Deposited event). Mirrors apps/contracts/contracts/FlightEscrow.sol; keep
 * in sync by hand since the two packages don't share a build step.
 */
export const FLIGHT_ESCROW_ABI = [
  {
    type: 'function',
    name: 'escrows',
    stateMutability: 'view',
    inputs: [{ name: 'bookingIdHash', type: 'bytes32' }],
    outputs: [
      { name: 'payer', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'isNative', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'release',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bookingIdHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refund',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bookingIdHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: 'bookingIdHash', type: 'bytes32', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'isNative', type: 'bool', indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

/**
 * Minimal Mento Broker ABI — used only as a live price reference for "how
 * much CELO is this booking's USD price worth right now" (the non-MiniPay
 * deposit path). Not used to actually perform a swap; the escrow custodies
 * native CELO directly.
 */
export const MENTO_BROKER_ABI = [
  {
    type: 'function',
    name: 'getAmountIn',
    stateMutability: 'view',
    inputs: [
      { name: 'exchangeProvider', type: 'address' },
      { name: 'exchangeId', type: 'bytes32' },
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountOut', type: 'uint256' },
    ],
    outputs: [{ name: 'amountIn', type: 'uint256' }],
  },
] as const;
