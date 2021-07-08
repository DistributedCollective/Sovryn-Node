pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library WatcherHelpers {
    function checkArbitrage(
        IERC20 _tokenA,
        IERC20 _tokenB,
        uint256 _sellAmountAMin,
        uint256 _sellAmountAMax,
        uint256 _sellAmountBMin,
        uint256 _sellAmountBMax,
        uint256 _acceptableProfitDelta  // "percentages" in "ether", 100% = 1 ether = 10**18
    )
    public
    view
    returns (
        uint256 amount,
        uint256 targetAmount,
        uint256 profit,
        IERC20[] memory conversionPath
    ) {
        require(_sellAmountAMax >= _sellAmountAMin, "Watcher: token A max sell amount lower than min sell amount");
        require(_sellAmountBMax >= _sellAmountBMin, "Watcher: token B max sell amount lower than min sell amount");
        require(_sellAmountAMin > 0, "Watcher: token A min sell amount must be greater than 0");
        require(_sellAmountBMin > 0, "Watcher: token B min sell amount must be greater than 0");

        uint256 amountMax;
        uint256 priceFeedRate;
        uint256 priceFeedPrecision;
        (
        amount,
        amountMax,
        targetAmount,
        priceFeedRate,
        priceFeedPrecision,
        conversionPath
        ) = determineArbitrageDirection(
            _tokenA,
            _tokenB,
            _sellAmountAMin,
            _sellAmountAMax,
            _sellAmountBMin,
            _sellAmountBMax
        );

        uint256 priceFeedTargetAmount = amount * priceFeedRate / priceFeedPrecision;
        //console.log("amount %s, swaps %s, feeds", amount, targetAmount, priceFeedTargetAmount);

        if (targetAmount <= priceFeedTargetAmount) {
            return (0, 0, 0, new IERC20[](0));
        }

        (amount, targetAmount, profit) = bisectOptimalArbitrageAmount(
            conversionPath,
            amount,
            amountMax,
            targetAmount,
            priceFeedRate,
            priceFeedPrecision,
            _acceptableProfitDelta
        );

        return (amount, targetAmount, profit, conversionPath);
    }

    function determineArbitrageDirection(
        IERC20 _tokenA,
        IERC20 _tokenB,
        uint256 _sellAmountAMin,
        uint256 _sellAmountAMax,
        uint256 _sellAmountBMin,
        uint256 _sellAmountBMax
    )
    internal
    view
    returns (
        uint256 amountMin,
        uint256 amountMax,
        uint256 targetTokenAmount,
        uint256 priceFeedRate,
        uint256 priceFeedPrecision,
        IERC20[] memory conversionPath
    ) {
        {
            // TODO: cannot figure out how to easily cast address[] to IERC20[]
            address[] memory _conversionPath = sovrynSwapNetwork.conversionPath(_tokenA, _tokenB);
            conversionPath = new IERC20[](_conversionPath.length);
            for(uint i = 0; i < _conversionPath.length; i++) {
                conversionPath[i] = IERC20(_conversionPath[i]);
            }
        }

        amountMin = _sellAmountAMin;
        amountMax = _sellAmountAMax;
        targetTokenAmount = sovrynSwapNetwork.rateByPath(conversionPath, amountMin);

        (priceFeedRate, priceFeedPrecision) = priceFeeds.queryRate(address(_tokenA), address(_tokenB));
        uint256 priceFeedTargetTokenAmount = amountMin * priceFeedRate / priceFeedPrecision;

        if (targetTokenAmount <= priceFeedTargetTokenAmount) {
            // reverse conversionPath
            for(uint i = 0; i < conversionPath.length / 2; i++) {
                IERC20 tmp = conversionPath[i];
                conversionPath[i] = conversionPath[conversionPath.length - i - 1];
                conversionPath[conversionPath.length - i - 1] = tmp;
            }
            amountMin = _sellAmountBMin;
            amountMax = _sellAmountBMax;
            targetTokenAmount = sovrynSwapNetwork.rateByPath(conversionPath, amountMin);
            (priceFeedRate, priceFeedPrecision) = priceFeeds.queryRate(address(_tokenB), address(_tokenA));
        }

        return (amountMin, amountMax, targetTokenAmount, priceFeedRate, priceFeedPrecision, conversionPath);
    }

    function bisectOptimalArbitrageAmount(
        IERC20[] memory conversionPath,
        uint256 _amountMin,
        uint256 _amountMax,
        uint256 _targetTokenAmount,
        uint256 _priceFeedRate,
        uint256 _priceFeedPrecision,
        uint256 _acceptableProfitDelta  // "percentages" in "ether", 100% = 1 ether = 10**18
    )
    internal
    view
    returns (
        uint256,
        uint256,
        uint256
    ) {
        uint256 priceFeedTargetTokenAmount = _amountMin * _priceFeedRate / _priceFeedPrecision;
        uint256 profit = _targetTokenAmount - priceFeedTargetTokenAmount;
        //console.log("Bisect: start amount %s, swap %s, feed %s", _amountMin, _targetTokenAmount, priceFeedTargetTokenAmount);
        //console.log("Bisect: Profit %s", profit);

        while (_amountMin < _amountMax) {
            uint256 newAmount = (_amountMin + _amountMax) / 2;
            uint256 newTargetTokenAmount = sovrynSwapNetwork.rateByPath(conversionPath, newAmount);
            priceFeedTargetTokenAmount = newAmount * _priceFeedRate / _priceFeedPrecision;

            //console.log("Bisect: amount %s, swap %s, feed %s", newAmount, newTargetTokenAmount, priceFeedTargetTokenAmount);

            if (newTargetTokenAmount <= priceFeedTargetTokenAmount) {
                // return is lower than price feed amount, so this is a hard cap
                _amountMax = newAmount;
            } else {
                uint256 newProfit = newTargetTokenAmount - priceFeedTargetTokenAmount;
                uint256 profitDelta;
                if (newProfit >= profit) {
                    profitDelta = (newProfit - profit) * 1 ether / profit;
                    _amountMin = newAmount;
                    _targetTokenAmount = newTargetTokenAmount;
                    profit = newProfit;
                } else {
                    profitDelta = (profit - newProfit) * 1 ether / profit;
                    _amountMax = newAmount;
                }

                //console.log("Bisect: Profit %s, delta %s", newProfit, profitDelta);
                if (profitDelta <= _acceptableProfitDelta) {
                    //console.log("Bisect: Profit delta is good enough");
                    break;
                }
            }
        }
        return (_amountMin, _targetTokenAmount, profit);
    }
}
