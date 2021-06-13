pragma solidity ^0.7.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "hardhat/console.sol";

import "./interfaces/ISovrynSwapNetwork.sol";
import "./interfaces/IPriceFeeds.sol";


contract Watcher is Ownable {
  using SafeMath for uint256;
  //using SafeERC20 for IERC20; // TODO: is this needed?

  ISovrynSwapNetwork sovrynSwapNetwork;
  IPriceFeeds priceFeeds;

  constructor(
    ISovrynSwapNetwork _sovrynSwapNetwork,
    IPriceFeeds _priceFeeds
  ) {
    console.log("Deploying a Watcher with sovrynSwapNetwork: %s", address(_sovrynSwapNetwork));
    sovrynSwapNetwork = _sovrynSwapNetwork;
    priceFeeds = _priceFeeds;
  }

  function checkArbitrage(
    IERC20 _tokenA,
    IERC20 _tokenB
  ) public view returns (uint256, uint256, IERC20[] memory) {
    uint256 arbitrageAmount = 1 ether;

    // TODO: cannot figure out how to convert address[] to IERC20[]
    address[] memory conversionPath = sovrynSwapNetwork.conversionPath(_tokenA, _tokenB);
    IERC20[] memory aToB = new IERC20[](conversionPath.length);
    for(uint i = 0; i < conversionPath.length; i++) {
      aToB[i] = IERC20(conversionPath[i]);
    }

    IERC20[] memory bToA = new IERC20[](aToB.length);
    for(uint i = 0; i < aToB.length; i++) {
      bToA[i] = aToB[aToB.length - i - 1];
    }
    uint256 swapReturnAToB = sovrynSwapNetwork.rateByPath(aToB, arbitrageAmount);
    uint256 priceFeedsReturnAToB = priceFeeds.queryReturn(address(_tokenA), address(_tokenB), arbitrageAmount);
    uint256 swapReturnBToA = sovrynSwapNetwork.rateByPath(bToA, arbitrageAmount);
    uint256 priceFeedsReturnBToA = priceFeeds.queryReturn(address(_tokenB), address(_tokenA), arbitrageAmount);

    if (swapReturnAToB > priceFeedsReturnAToB) {
      return (arbitrageAmount, swapReturnAToB - priceFeedsReturnAToB, aToB);
    } else if (swapReturnBToA > priceFeedsReturnBToA) {
      return (arbitrageAmount, swapReturnBToA - priceFeedsReturnBToA, bToA);
    }

    return (0, 0, new IERC20[](0));
  }
}
