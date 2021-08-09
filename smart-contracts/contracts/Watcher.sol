pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

    event Swapback(
        bytes32 _loanId,
        address indexed _sourceToken,
        address indexed _targetToken,
        uint256 _sourceTokenAmount,
        uint256 _targetTokenAmount,
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

    function arbitrage(
        IERC20[] calldata _conversionPath,
        uint256 _amount,
        uint256 _minProfit
    )
    external
    onlyRole(ROLE_EXECUTOR)
    {
        (IERC20 sourceToken, IERC20 targetToken) = getSourceAndTargetTokens(_conversionPath);
        uint256 priceFeedReturn = priceFeeds.queryReturn(
            address(sourceToken),
            address(targetToken),
            _amount
        );
        uint256 targetTokenAmount = swapInternal(
            _conversionPath,
            _amount,
            priceFeedReturn + _minProfit
        );

        emit Arbitrage(
            address(sourceToken),
            address(targetToken),
            _amount,
            targetTokenAmount,
            priceFeedReturn,
            targetTokenAmount - priceFeedReturn,
            msg.sender
        );
    }

    function liquidate(
        bytes32 _loanId,
        uint256 _closeAmount // denominated in loanToken
    )
    external
    onlyRole(ROLE_EXECUTOR)
    returns (
        uint256 loanCloseAmount,
        uint256 seizedAmount,
        address seizedToken
    )
    {
        (loanCloseAmount, seizedAmount, seizedToken) = liquidateInternal(_loanId, _closeAmount);
    }

    function liquidateWithSwapback(
        bytes32 _loanId,
        uint256 _closeAmount, // denominated in loanToken
        IERC20[] calldata _swapbackConversionPath,
        uint256 _swapbackMinProfit,
        bool _requireSwapback
    )
    external
    onlyRole(ROLE_EXECUTOR)
    returns (
        uint256 loanCloseAmount,
        uint256 seizedAmount,
        address seizedToken
    )
    {
        (loanCloseAmount, seizedAmount, seizedToken) = liquidateInternal(_loanId, _closeAmount);
        swapbackInternal(
            _loanId,
            loanCloseAmount,
            IERC20(seizedToken),
            seizedAmount,
            _swapbackConversionPath,
            _swapbackMinProfit,
            _requireSwapback
        );
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

    // internal functions

    function getSourceAndTargetTokens(
        IERC20[] calldata _conversionPath
    )
    internal
    pure
    returns (
        IERC20 sourceToken,
        IERC20 targetToken
    )
    {
        require(_conversionPath.length >= 2, "Watcher: _conversionPath must contain at least 2 tokens");
        sourceToken = _conversionPath[0];
        targetToken = _conversionPath[_conversionPath.length - 1];
    }

    function swapInternal(
        IERC20[] calldata _conversionPath,
        uint256 _amount,
        uint256 _minReturn
    )
    internal
    returns (
        uint256 targetTokenAmount
    )
    {
        require(
            _conversionPath[0].approve(address(sovrynSwapNetwork), _amount),
            "Watcher: error approving token"
        );

        targetTokenAmount = sovrynSwapNetwork.convertByPath(
            _conversionPath,
            _amount,
            _minReturn, // minReturn
            address(this), // beneficiary
            address(0), // affiliateAccount
            0 // affiliateFee
        );
    }

    function liquidateInternal(
        bytes32 _loanId,
        uint256 _closeAmount // denominated in loanToken
    )
    internal
    returns (
        uint256 loanCloseAmount,
        uint256 seizedAmount,
        address seizedToken
    )
    {
        // NOTE: to save gas, we might be able to use sovrynProtocol.loans[loanId],
        // but then it doesn't have max liquidation amounts
        ISovrynProtocol.LoanReturnData memory loan = sovrynProtocol.getLoan(_loanId);
        IERC20 loanToken = IERC20(loan.loanToken);
        //closeAmount = loan.maxLiquidatable;
        //require(closeAmount > 0, "loan not liquidatable");

        loanToken.approve(address(sovrynProtocol), _closeAmount);
        (loanCloseAmount, seizedAmount, seizedToken) = sovrynProtocol.liquidate(_loanId, address(this), _closeAmount);

        // LoanClosings wants to send us RBTC, deposit to wrbtcToken to keep things simpler
        if (seizedToken == address(wrbtcToken)) {
            wrbtcToken.deposit{ value: seizedAmount }();
        }

        emit Liquidation(
            _loanId,
            address(loanToken),
            seizedToken,
            loanCloseAmount,
            seizedAmount,
            msg.sender
        );
    }

    function swapbackInternal(
        bytes32 _loanId,
        uint256 _loanCloseAmount,
        IERC20 _seizedToken,
        uint256 _seizedAmount,
        IERC20[] calldata _swapbackConversionPath,
        uint256 _swapbackMinProfit,
        bool _requireSwapback
    )
    internal
    {
        require(
            IERC20(_seizedToken) == _swapbackConversionPath[0],
            "Watcher: _swapbackConversionPath must start with seizedToken"
        );
        (IERC20 sourceToken, IERC20 targetToken) = getSourceAndTargetTokens(_swapbackConversionPath);

        if (!_requireSwapback) {
            // if we don't require swapback, we check the price and only do the swapback only if we get a profit
            // this wastes some gas however
            uint256 swapbackReturn = sovrynSwapNetwork.rateByPath(_swapbackConversionPath, _seizedAmount);
            if (swapbackReturn >= (_loanCloseAmount + _swapbackMinProfit)) {
                _requireSwapback = true;
            }
        }

        if (_requireSwapback) {
            // either we require swapback from the get-go, or we have determined that we want swapback above
            // either way, this transaction will only go through with the wanted profit
            uint256 targetTokenAmount = swapInternal(
                _swapbackConversionPath,
                _seizedAmount,
                _loanCloseAmount + _swapbackMinProfit  // it's safe to always set this
            );
            emit Swapback(
                _loanId,
                address(sourceToken),
                address(targetToken),
                _seizedAmount,
                targetTokenAmount,
                msg.sender
            );
        }
    }
}
