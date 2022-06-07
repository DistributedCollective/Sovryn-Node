//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Watcher.sol";

// This is a faux version of the Watcher contract to test upgrades.
contract WatcherUpgradeTest is Watcher{
    uint256 public foo; // new variable

    // new functions for testing
    function incrementFoo() external {
        foo++;
    }

    function getFoo() external view returns (uint256) {
        return foo;
    }
}
