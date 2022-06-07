pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
//import "./IERC20Token.sol";

/*
    SovrynSwap Network interface -- trimmed for our needs
*/
interface ISovrynSwapNetwork {
    /**
     * @dev converts the token to any other token in the sovrynSwap network by following
     * a predefined conversion path and transfers the result tokens to a target account
     * affiliate account/fee can also be passed in to receive a conversion fee (on top of the liquidity provider fees)
     * note that the network should already have been given allowance of the source token (if not ETH)
     *
     * @param _path                conversion path, see conversion path format above
     * @param _amount              amount to convert from, in the source token
     * @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be greater than zero
     * @param _beneficiary         account that will receive the conversion result or 0x0 to send the result to the sender account
     * @param _affiliateAccount    wallet address to receive the affiliate fee or 0x0 to disable affiliate fee
     * @param _affiliateFee        affiliate fee in PPM or 0 to disable affiliate fee
     *
     * @return amount of tokens received from the conversion
     */
    function convertByPath(
        IERC20Upgradeable[] memory _path,
        uint256 _amount,
        uint256 _minReturn,
        address _beneficiary,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) external payable returns (uint256);

    /**
     * @dev returns the conversion path between two tokens in the network
     * note that this method is quite expensive in terms of gas and should generally be called off-chain
     *
     * @param _sourceToken source token address
     * @param _targetToken target token address
     *
     * @return conversion path between the two tokens
     */
    function conversionPath(
        IERC20Upgradeable _sourceToken,
        IERC20Upgradeable _targetToken
    ) external view returns (address[] memory);

    /**
     * @dev returns the expected target amount of converting a given amount on a given path
     * note that there is no support for circular paths
     *
     * @param _path        conversion path (see conversion path format above)
     * @param _amount      amount of _path[0] tokens received from the sender
     *
     * @return expected target amount
     */
    function rateByPath(
        IERC20Upgradeable[] memory _path,
        uint256 _amount
    ) external view returns (uint256);
}
