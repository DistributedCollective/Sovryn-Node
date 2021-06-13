pragma solidity ^0.7.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";

import "./interfaces/ISovrynSwapNetwork.sol";


contract Watcher is Ownable {
  ISovrynSwapNetwork sovrynSwapNetwork;

  constructor(
    ISovrynSwapNetwork _sovrynSwapNetwork
  ) {
    console.log("Deploying a Watcher with sovrynSwapNetwork: %s", address(_sovrynSwapNetwork));
    sovrynSwapNetwork = _sovrynSwapNetwork;
  }

  function checkArbitrage(
    IERC20 _tokenA,
    IERC20 _tokenB
  ) public view returns (bool hasArbitrage, address[] memory conversionPath) {
    return (false, new address[](0));
  }
}
