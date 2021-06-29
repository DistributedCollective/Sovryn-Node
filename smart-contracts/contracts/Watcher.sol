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
}
