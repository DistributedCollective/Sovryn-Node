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

    // TODO: cannot figure out how to easily cast address[] to IERC20[]
    address[] memory _conversionPath = sovrynSwapNetwork.conversionPath(_tokenA, _tokenB);
    IERC20[] memory conversionPath = new IERC20[](_conversionPath.length);
    for(uint i = 0; i < _conversionPath.length; i++) {
      conversionPath[i] = IERC20(_conversionPath[i]);
    }

    uint256 swapReturn = sovrynSwapNetwork.rateByPath(conversionPath, arbitrageAmount);
    uint256 priceFeedReturn = priceFeeds.queryReturn(address(_tokenA), address(_tokenB), arbitrageAmount);
    if (swapReturn > priceFeedReturn) {
      return (arbitrageAmount, swapReturn - priceFeedReturn, conversionPath);
    } else {
      // reverse conversionPath
      for(uint i = 0; i < conversionPath.length / 2; i++) {
        IERC20 tmp = conversionPath[i];
        conversionPath[i] = conversionPath[_conversionPath.length - i - 1];
        conversionPath[_conversionPath.length - i - 1] = tmp;
      }
      swapReturn = sovrynSwapNetwork.rateByPath(conversionPath, arbitrageAmount);
      priceFeedReturn = priceFeeds.queryReturn(address(_tokenB), address(_tokenA), arbitrageAmount);
      if (swapReturn > priceFeedReturn) {
        return (arbitrageAmount, swapReturn - priceFeedReturn, conversionPath);
      }
    }

    return (0, 0, new IERC20[](0));
  }
}
