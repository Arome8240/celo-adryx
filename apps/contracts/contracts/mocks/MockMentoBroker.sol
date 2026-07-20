// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Test-only stand-in for Mento's Broker.getAmountIn — never deployed
/// to a real network. Simulates a fixed 1 CELO = 10 USDm rate so backend
/// verification tests have a deterministic quote to assert against.
contract MockMentoBroker {
    function getAmountIn(
        address,
        bytes32,
        address,
        address,
        uint256 amountOut
    ) external pure returns (uint256) {
        return amountOut / 10;
    }
}
