pragma solidity ^0.7.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "hardhat/console.sol";

import "./interfaces/ISovrynSwapNetwork.sol";
import "./interfaces/IPriceFeeds.sol";
import "./interfaces/IWRBTCToken.sol";


contract Watcher is Ownable {
  using SafeMath for uint256;
  //using SafeERC20 for IERC20; // TODO: is this needed?

  ISovrynSwapNetwork public sovrynSwapNetwork;
  IPriceFeeds public priceFeeds;
  IWRBTCToken public wrbtcToken;

  event Arbitrage(
    address indexed _beneficiary,
    address indexed _sourceToken,
    address indexed _targetToken,
    uint256 _sourceTokenAmount,
    uint256 _targetTokenAmount,
    uint256 _priceFeedAmount,
    uint256 _profit
  );

  constructor(
    ISovrynSwapNetwork _sovrynSwapNetwork,
    IPriceFeeds _priceFeeds,
    IWRBTCToken _wrbtcToken
  ) {
    sovrynSwapNetwork = _sovrynSwapNetwork;
    priceFeeds = _priceFeeds;
    wrbtcToken = _wrbtcToken;
  }

  // TODO: non-reentrant?
  function arbitrage(
    IERC20[] calldata _conversionPath,
    uint256 _amount,
    uint256 _minProfit
  ) public payable {
    require(_conversionPath.length >= 2, "_conversionPath must contain at least 2 tokens");

    IERC20 sourceToken = _conversionPath[0];
    IERC20 targetToken = _conversionPath[_conversionPath.length - 1];
    require(sourceToken != targetToken, "sourceToken and targetToken cannot be the same");

    // handle WRBTC wrapping if value is given
    if (msg.value != 0) {
      require(sourceToken == wrbtcToken, "value may only be given for WRBTC transfers");
      require(msg.value == _amount, "value must equal amount");

      wrbtcToken.deposit{ value: _amount }();
    } else {
      require(sourceToken.transferFrom(msg.sender, address(this), _amount), "error transferring token");
    }

    require(sourceToken.approve(address(sovrynSwapNetwork), _amount), "error approving token");

    // For now, we just directly send everything back to the user
    address beneficiary = targetToken == wrbtcToken ? address(this) : msg.sender;
    uint256 targetTokenAmount = sovrynSwapNetwork.convertByPath(
      _conversionPath,
      _amount,
      0, // minReturn
      beneficiary,
      address(0), // affiliateAccount
      0 // affiliateFee
    );

    uint256 priceFeedReturn = priceFeeds.queryReturn(address(sourceToken), address(targetToken), _amount);
    uint256 profit = targetTokenAmount.sub(priceFeedReturn);
    require(profit >= _minProfit, "minimum profit not met");

    if (targetToken == wrbtcToken) {
      wrbtcToken.withdraw(targetTokenAmount);
      msg.sender.transfer(targetTokenAmount);
    }

    emit Arbitrage(
      msg.sender,
      address(sourceToken),
      address(targetToken),
      _amount,
      targetTokenAmount,
      priceFeedReturn,
      profit
    );
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
