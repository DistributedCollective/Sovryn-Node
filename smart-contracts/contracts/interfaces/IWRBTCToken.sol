pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IWRBTCToken is IERC20Upgradeable {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}
