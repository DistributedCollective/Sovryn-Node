// Bare-bones mock for SovrynProtocol
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./openzeppelin/Address.sol";
import "./openzeppelin/SafeERC20.sol";
import "./openzeppelin/SafeMath.sol";
import "./interfaces/IPriceFeeds.sol";
import "./TestToken.sol";
import "./TestWrbtc.sol";

contract TestLoanProtocol {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    struct LoanReturnData {
        bytes32 loanId;
        address loanToken;
        address collateralToken;
        uint256 principal;
        uint256 collateral;
        uint256 interestOwedPerDay;
        uint256 interestDepositRemaining;
        uint256 startRate; // collateralToLoanRate
        uint256 startMargin;
        uint256 maintenanceMargin;
        uint256 currentMargin;
        uint256 maxLoanTerm;
        uint256 endTimestamp;
        uint256 maxLiquidatable;
        uint256 maxSeizable;
    }

    mapping(bytes32 => LoanReturnData) private loans;
    TestWrbtc public wrbtcToken;

    constructor(
        TestWrbtc _wrbtcToken
    )
    public
    {
        wrbtcToken = _wrbtcToken;
    }

    // ==================================================
    // SovrynProtocol API
    // ==================================================

    function liquidate(
        bytes32 loanId,
        address receiver,
        uint256 closeAmount
    )
    external
    payable
    returns (
        uint256 loanCloseAmount,
        uint256 seizedAmount,
        address seizedToken
    ) {
        // Forked from LoanClosingsBase._liquidate but *GREATLY* simplified
        LoanReturnData storage loan = _getLoanOrThrow(loanId);
        require(_isLiquidatable(loan), "healthy position");

        loanCloseAmount = closeAmount;
        uint256 maxLiquidatable = loan.maxLiquidatable;
        uint256 maxSeizable = loan.maxSeizable;

        if (loanCloseAmount < maxLiquidatable) {
            seizedAmount = maxSeizable.mul(loanCloseAmount).div(maxLiquidatable);
        } else if (loanCloseAmount > maxLiquidatable) {
            // adjust down the close amount to the max
            loanCloseAmount = maxLiquidatable;
            seizedAmount = maxSeizable;
        } else {
            seizedAmount = maxSeizable;
        }

        require(loanCloseAmount != 0, "nothing to liquidate");

        // liquidator deposits the principal being closed
        _returnPrincipalWithDeposit(loan.loanToken, address(this), loanCloseAmount);

		seizedToken = loan.collateralToken;

		if (seizedAmount != 0) {
			loan.collateral = loan.collateral.sub(seizedAmount);

			_withdrawAsset(seizedToken, receiver, seizedAmount);
		}

		_closeLoan(loan, loanCloseAmount, seizedAmount);

        // TODO: should emit liquidation event but who cares?
    }

    function getLoan(bytes32 loanId) public view returns (LoanReturnData memory loanData) {
        return loans[loanId];
        // It looks like this:
        //return LoanReturnData(
        //    bytes32(0), // loanId;
        //    address(0), // loanToken;
        //    address(0), // collateralToken;
        //    uint256(0), // principal;
        //    uint256(0), // collateral;
        //    uint256(0), // interestOwedPerDay;
        //    uint256(0), // interestDepositRemaining;
        //    uint256(0), // startRate; // collateralToLoanRate
        //    uint256(0), // startMargin;
        //    uint256(0), // maintenanceMargin;
        //    uint256(0), // currentMargin;
        //    uint256(0), // maxLoanTerm;
        //    uint256(0), // endTimestamp;
        //    uint256(0), // maxLiquidatable;
        //    uint256(0) // maxSeizable;
        //);
    }

    // ==================================================
    // Test helper api
    // ==================================================

    function createLoan(
        bytes32 loanId,
        address loanToken,
        address collateralToken,
        uint256 principal,
        uint256 collateral
    )
    public
    {
        require(loans[loanId].loanId == bytes32(0), "loan already exists");
        loans[loanId].loanId = loanId;
        loans[loanId].loanToken = loanToken;
        loans[loanId].collateralToken = collateralToken;
        loans[loanId].principal = principal;
        loans[loanId].collateral = collateral;
        loans[loanId].startMargin = 100 ether;
        loans[loanId].maintenanceMargin = 15 ether;
        loans[loanId].currentMargin = 100 ether;

        // Just create tokens out of thin air
        TestToken(collateralToken).mint(address(this), collateral);
        TestToken(loanToken).mint(msg.sender, principal);
    }

    function deleteLoan(
        bytes32 loanId
    )
    public
    {
        delete loans[loanId];
    }

    // @dev A low level method for setting loan data in storage
    function setLoan(
        LoanReturnData memory loan
    )
    public
    {
        loans[loan.loanId] = loan;
    }

    function updateLiquidatableAmounts(
        bytes32 loanId,
        uint256 maxLiquidatable,
        uint256 maxSeizable
    )
    public
    {
        LoanReturnData storage loan = _getLoanOrThrow(loanId);
        require(maxLiquidatable <= loan.principal, "maxLiquidatable too large");
        require(maxSeizable <= loan.collateral, "maxSeizable too large");
        loan.currentMargin = 14 ether;  // this hardly matters but it needs to be below maintenance margin
        loan.maxLiquidatable = maxLiquidatable;
        loan.maxSeizable = maxSeizable;
    }

    function _getLoanOrThrow(
        bytes32 loanId
    )
    internal
    view
    returns (LoanReturnData storage loanData)
    {
        loanData = loans[loanId];
        require(loanData.loanId != bytes32(0), "loan not found");
    }

    function _isLiquidatable(
        LoanReturnData storage loan
    )
    internal
    view
    returns (bool)
    {
        return loan.currentMargin <= loan.maintenanceMargin && loan.maxLiquidatable > 0;
    }

    function _closeLoan(LoanReturnData storage loanLocal, uint256 loanCloseAmount, uint256 seizedAmount) internal {
        // Forked from LoanClosingsBase, but heavily adjusted
        require(loanCloseAmount != 0, "nothing to close");

        if (loanCloseAmount == loanLocal.principal) {
            loanLocal.principal = 0;
            //loanLocal.active = false;
            loanLocal.endTimestamp = block.timestamp;
            //loanLocal.pendingTradesId = 0;
            //activeLoansSet.removeBytes32(loanLocal.id);
            //lenderLoanSets[loanLocal.lender].removeBytes32(loanLocal.id);
            //borrowerLoanSets[loanLocal.borrower].removeBytes32(loanLocal.id);
            loanLocal.maxLiquidatable = 0;
            loanLocal.maxSeizable = 0;
        } else {
            loanLocal.principal = loanLocal.principal.sub(loanCloseAmount);
            loanLocal.maxLiquidatable = loanLocal.maxLiquidatable.sub(loanCloseAmount);
            loanLocal.maxSeizable = loanLocal.maxSeizable.sub(seizedAmount);
        }
    }

    // The receiver always gets back an ERC20 (even wrbtc)
    function _returnPrincipalWithDeposit(
        address loanToken,
        address receiver,
        uint256 principalNeeded
    ) internal {
        if (principalNeeded != 0) {
            if (msg.value == 0) {
                vaultTransfer(loanToken, msg.sender, receiver, principalNeeded);
            } else {
                require(loanToken == address(wrbtcToken), "wrong asset sent");
                require(msg.value >= principalNeeded, "not enough ether");
                wrbtcToken.deposit.value(principalNeeded)();
                if (receiver != address(this)) {
                    vaultTransfer(loanToken, address(this), receiver, principalNeeded);
                }
                if (msg.value > principalNeeded) {
                    // refund overage
                    Address.sendValue(msg.sender, msg.value - principalNeeded);
                }
            }
        } else {
            require(msg.value == 0, "wrong asset sent");
        }
    }

    function _withdrawAsset(
        address assetToken,
        address receiver,
        uint256 assetAmount
    ) internal {
        if (assetAmount != 0) {
            if (assetToken == address(wrbtcToken)) {
                vaultEtherWithdraw(receiver, assetAmount);
            } else {
                vaultWithdraw(assetToken, receiver, assetAmount);
            }
        }
    }

    // **********************************************************************
    // * VAULT CONTROLLER STUB (just copy pasted for ease)                  *
    // **********************************************************************
    event VaultDeposit(address indexed asset, address indexed from, uint256 amount);
    event VaultWithdraw(address indexed asset, address indexed to, uint256 amount);

    function vaultEtherDeposit(address from, uint256 value) internal {
        TestWrbtc _wrbtcToken = wrbtcToken;
        _wrbtcToken.deposit.value(value)();

        emit VaultDeposit(address(_wrbtcToken), from, value);
    }

    function vaultEtherWithdraw(address to, uint256 value) internal {
        if (value != 0) {
            TestWrbtc _wrbtcToken = wrbtcToken;
            uint256 balance = address(this).balance;
            if (value > balance) {
                _wrbtcToken.withdraw(value - balance);
            }
            Address.sendValue(to, value);

            emit VaultWithdraw(address(_wrbtcToken), to, value);
        }
    }

    function vaultDeposit(
        address token,
        address from,
        uint256 value
    ) internal {
        if (value != 0) {
            IERC20(token).safeTransferFrom(from, address(this), value);

            emit VaultDeposit(token, from, value);
        }
    }

    function vaultWithdraw(
        address token,
        address to,
        uint256 value
    ) internal {
        if (value != 0) {
            IERC20(token).safeTransfer(to, value);

            emit VaultWithdraw(token, to, value);
        }
    }

    function vaultTransfer(
        address token,
        address from,
        address to,
        uint256 value
    ) internal {
        if (value != 0) {
            if (from == address(this)) {
                IERC20(token).safeTransfer(to, value);
            } else {
                IERC20(token).safeTransferFrom(from, to, value);
            }
        }
    }

    function vaultApprove(
        address token,
        address to,
        uint256 value
    ) internal {
        if (value != 0 && IERC20(token).allowance(address(this), to) != 0) {
            IERC20(token).safeApprove(to, 0);
        }
        IERC20(token).safeApprove(to, value);
    }
    // **********************************************************************
    // * / VAULT CONTROLLER STUB                                            *
    // **********************************************************************
}