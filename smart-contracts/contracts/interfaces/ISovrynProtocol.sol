pragma solidity ^0.8.0;

interface ISovrynProtocol {
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

    function liquidate(
        bytes32 loanId,
        address receiver,
        uint256 closeAmount // denominated in loanToken
    )
    external
    payable
    returns (
        uint256 loanCloseAmount,
        uint256 seizedAmount,
        address seizedToken
    );

    function getLoan(bytes32 loanId) external view returns (LoanReturnData memory loanData);
}