pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWRBTCToken is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}
