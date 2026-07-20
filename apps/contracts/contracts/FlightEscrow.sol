// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title FlightEscrow
/// @notice Holds a customer's payment for one flight booking until the
/// backend confirms the booking and releases it to the treasury, or refunds
/// it back to the customer if the booking falls through. Accepts either the
/// configured ERC20 (USDm/cUSD — the MiniPay in-wallet balance) or native
/// CELO (for wallets outside MiniPay, which more commonly hold CELO than a
/// Mento stable). Each booking deposits at most once, in exactly one of the
/// two assets — `bookingIdHash` is `keccak256(bytes(bookingId))`, computed
/// identically by the backend when it later verifies a deposit, so a Prisma
/// cuid maps deterministically to this contract's storage key without ever
/// storing the raw id on-chain.
contract FlightEscrow is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Distinct from DEFAULT_ADMIN_ROLE — the backend's hot wallet
    /// holds this role and calls release()/refund(); it cannot grant roles
    /// or change the treasury, so a compromised operator key can only move
    /// already-escrowed funds to the one fixed treasury address or back to
    /// their original payer, never anywhere else.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum Status {
        None,
        Deposited,
        Released,
        Refunded
    }

    struct Escrow {
        address payer;
        uint256 amount;
        Status status;
        bool isNative;
    }

    IERC20 public immutable token;
    address public treasury;

    mapping(bytes32 => Escrow) public escrows;

    event Deposited(bytes32 indexed bookingIdHash, address indexed payer, uint256 amount, bool isNative);
    event Released(bytes32 indexed bookingIdHash, address indexed treasury, uint256 amount, bool isNative);
    event Refunded(bytes32 indexed bookingIdHash, address indexed payer, uint256 amount, bool isNative);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    constructor(address tokenAddress, address treasuryAddress, address admin, address operator) {
        require(tokenAddress != address(0), "FlightEscrow: token is zero address");
        require(treasuryAddress != address(0), "FlightEscrow: treasury is zero address");
        require(admin != address(0), "FlightEscrow: admin is zero address");
        require(operator != address(0), "FlightEscrow: operator is zero address");

        token = IERC20(tokenAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
    }

    /// @notice Deposits `amount` of the configured ERC20 (USDm/cUSD) for
    /// `bookingIdHash`. Reverts if that hash already has a deposit (one
    /// deposit per booking, ever, in either asset — a released or refunded
    /// hash can't be reused either). Caller must have approved this contract
    /// for `amount` beforehand.
    function deposit(bytes32 bookingIdHash, uint256 amount) external nonReentrant {
        require(amount > 0, "FlightEscrow: amount is zero");
        Escrow storage escrow = escrows[bookingIdHash];
        require(escrow.status == Status.None, "FlightEscrow: already deposited");

        // State is finalized before the external call (checks-effects-
        // interactions), with nonReentrant as defense in depth.
        escrow.payer = msg.sender;
        escrow.amount = amount;
        escrow.status = Status.Deposited;
        escrow.isNative = false;

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(bookingIdHash, msg.sender, amount, false);
    }

    /// @notice Deposits native CELO (`msg.value`) for `bookingIdHash` — the
    /// non-MiniPay payment path, for wallets that hold CELO rather than a
    /// Mento stable. Same one-deposit-per-booking rule as `deposit()`.
    function depositNative(bytes32 bookingIdHash) external payable nonReentrant {
        require(msg.value > 0, "FlightEscrow: amount is zero");
        Escrow storage escrow = escrows[bookingIdHash];
        require(escrow.status == Status.None, "FlightEscrow: already deposited");

        escrow.payer = msg.sender;
        escrow.amount = msg.value;
        escrow.status = Status.Deposited;
        escrow.isNative = true;

        emit Deposited(bookingIdHash, msg.sender, msg.value, true);
    }

    /// @notice Moves an escrowed deposit to the treasury, in whichever asset
    /// it was deposited in — called once the backend has confirmed the
    /// booking. Operator-only.
    function release(bytes32 bookingIdHash) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Escrow storage escrow = escrows[bookingIdHash];
        require(escrow.status == Status.Deposited, "FlightEscrow: not deposited");

        escrow.status = Status.Released;
        _payOut(treasury, escrow.amount, escrow.isNative);

        emit Released(bookingIdHash, treasury, escrow.amount, escrow.isNative);
    }

    /// @notice Returns an escrowed deposit to the original payer, in
    /// whichever asset it was deposited in — called if the booking is
    /// cancelled or fails before release(). Operator-only.
    function refund(bytes32 bookingIdHash) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Escrow storage escrow = escrows[bookingIdHash];
        require(escrow.status == Status.Deposited, "FlightEscrow: not deposited");

        escrow.status = Status.Refunded;
        _payOut(escrow.payer, escrow.amount, escrow.isNative);

        emit Refunded(bookingIdHash, escrow.payer, escrow.amount, escrow.isNative);
    }

    /// @notice Updates where release() sends funds. Admin-only — the
    /// operator role deliberately cannot call this.
    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "FlightEscrow: treasury is zero address");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function _payOut(address to, uint256 amount, bool isNative) private {
        if (isNative) {
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "FlightEscrow: native transfer failed");
        } else {
            token.safeTransfer(to, amount);
        }
    }
}
