pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

//import "hardhat/console.sol";

import "./interfaces/ISovrynSwapNetwork.sol";
import "./interfaces/ISovrynProtocol.sol";
import "./interfaces/IPriceFeeds.sol";
import "./interfaces/IWRBTCToken.sol";


contract Watcher is AccessControl {
    address public immutable RBTC_ADDRESS = address(0);
    bytes32 public constant ROLE_EXECUTOR = keccak256("EXECUTOR");
    bytes32 public constant ROLE_OWNER = DEFAULT_ADMIN_ROLE;

    ISovrynProtocol public sovrynProtocol;
    ISovrynSwapNetwork public sovrynSwapNetwork;
    IPriceFeeds public priceFeeds;
    IWRBTCToken public wrbtcToken;

    event Arbitrage(
        address indexed _sourceToken,
        address indexed _targetToken,
        uint256 _sourceTokenAmount,
        uint256 _targetTokenAmount,
        uint256 _priceFeedAmount,
        uint256 _profit,
        address _sender
    );

    event Liquidation(
        bytes32 _loanId,
        address indexed _loanToken,
        address indexed _seizedToken,
        uint256 _closeAmount,
        uint256 _seizedAmount,
        address _sender
    );

    constructor(
        ISovrynProtocol _sovrynProtocol,
        ISovrynSwapNetwork _sovrynSwapNetwork,
        IPriceFeeds _priceFeeds,
        IWRBTCToken _wrbtcToken
    ) {
        sovrynProtocol = _sovrynProtocol;
        sovrynSwapNetwork = _sovrynSwapNetwork;
        priceFeeds = _priceFeeds;
        wrbtcToken = _wrbtcToken;

        // ROLE_OWNER is also the default admin role
        _setupRole(ROLE_OWNER, msg.sender);
    }

    receive() external payable {
        require(
            msg.sender == address(wrbtcToken) ||
            msg.sender == address(sovrynProtocol) ||
            msg.sender == address(sovrynSwapNetwork),
            "Watcher: only known contracts can transfer RBTC"
        );
    }

    // TODO: non-reentrant?
    function arbitrage(
        IERC20[] calldata _conversionPath,
        uint256 _amount,
        uint256 _minProfit
    )
    external
    onlyRole(ROLE_EXECUTOR)
    {
        require(_conversionPath.length >= 2, "Watcher: _conversionPath must contain at least 2 tokens");

        IERC20 sourceToken = _conversionPath[0];
        IERC20 targetToken = _conversionPath[_conversionPath.length - 1];
        require(sourceToken != targetToken, "Watcher: sourceToken and targetToken cannot be the same");

        require(sourceToken.approve(address(sovrynSwapNetwork), _amount), "Watcher: error approving token");

        // For now, we just directly send everything back to the user
        uint256 targetTokenAmount = sovrynSwapNetwork.convertByPath(
            _conversionPath,
            _amount,
            1, // minReturn
            address(this), // beneficiary
            address(0), // affiliateAccount
            0 // affiliateFee
        );

        uint256 priceFeedReturn = priceFeeds.queryReturn(address(sourceToken), address(targetToken), _amount);
        require(priceFeedReturn > 0, "Watcher: priceFeedReturn 0, possibly paused");

        uint256 profit = targetTokenAmount - priceFeedReturn;
        require(profit >= _minProfit, "Watcher: minimum profit not met");

        emit Arbitrage(
            address(sourceToken),
            address(targetToken),
            _amount,
            targetTokenAmount,
            priceFeedReturn,
            profit,
            msg.sender
        );
    }

    function liquidate(
        bytes32 loanId,
        uint256 closeAmount // denominated in loanToken
    )
    external
    onlyRole(ROLE_EXECUTOR)
    returns (
        uint256 loanCloseAmount,
        uint256 seizedAmount,
        address seizedToken
    )
    {
        // NOTE: to save gas, we might be able to use sovrynProtocol.loans[loanId],
        // but then it doesn't have max liquidation amounts
        ISovrynProtocol.LoanReturnData memory loan = sovrynProtocol.getLoan(loanId);
        IERC20 loanToken = IERC20(loan.loanToken);
        //closeAmount = loan.maxLiquidatable;
        //require(closeAmount > 0, "loan not liquidatable");

        loanToken.approve(address(sovrynProtocol), closeAmount);
        (loanCloseAmount, seizedAmount, seizedToken) = sovrynProtocol.liquidate(loanId, address(this), closeAmount);

        // LoanClosings wants to send us RBTC, deposit to wrbtcToken to keep things simpler
        if (seizedToken == address(wrbtcToken)) {
            wrbtcToken.deposit{ value: seizedAmount }();
        }

        // TODO: we could swapback here

        emit Liquidation(
            loanId,
            address(loanToken),
            seizedToken,
            loanCloseAmount,
            seizedAmount,
            msg.sender
        );

        return (loanCloseAmount, seizedAmount, seizedToken);
    }

    function withdrawTokens(
        IERC20 _token,
        uint256 _amount,
        address payable _receiver
    )
    external
    onlyRole(ROLE_OWNER)
    {
        if (_receiver == address(0)) {
            _receiver = payable(msg.sender);
        }

        if (address(_token) == RBTC_ADDRESS) {
            wrbtcToken.withdraw(_amount);
            _receiver.transfer(_amount);
        } else {
            _token.transfer(_receiver, _amount);
        }
    }

    function depositTokens(
        IERC20 _token,
        uint256 _amount
    )
    external
    payable
    onlyRole(ROLE_OWNER)
    {
        if (msg.value != 0) {
            require(address(_token) == RBTC_ADDRESS, "Watcher: msg.value can only be given for RBTC deposits");
            require(msg.value == _amount, "Watcher: _amount and msg.value must match for RBTC deposits");
            wrbtcToken.deposit{ value: _amount }();
        } else {
            _token.transferFrom(msg.sender, address(this), _amount);
        }
    }

    // @dev withdraw excess RBTC, if for some reason there is unwrapped RBTC in the contract
    function withdrawRbtc(
        uint256 _amount,
        address payable _receiver
    )
    external
    onlyRole(ROLE_OWNER)
    {
        if (_receiver == address(0)) {
            _receiver = payable(msg.sender);
        }

        _receiver.transfer(_amount);
    }

    // maintenance functions for updating the protocol addresses, in case of error/etc
    function setSovrynProtocol(ISovrynProtocol _sovrynProtocol) external onlyRole(ROLE_OWNER) {
        sovrynProtocol = _sovrynProtocol;
    }
    function setSovrynSwapNetwork(ISovrynSwapNetwork _sovrynSwapNetwork) external onlyRole(ROLE_OWNER) {
        sovrynSwapNetwork = _sovrynSwapNetwork;
    }
    function setPriceFeeds(IPriceFeeds _priceFeeds) external onlyRole(ROLE_OWNER) {
        priceFeeds = _priceFeeds;
    }
    function setWRBTCToken(IWRBTCToken _wrbtcToken) external onlyRole(ROLE_OWNER) {
        wrbtcToken = _wrbtcToken;
    }

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
