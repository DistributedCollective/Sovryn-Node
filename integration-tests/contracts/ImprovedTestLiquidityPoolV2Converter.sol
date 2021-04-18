pragma solidity 0.4.26;
import "./copied/amm/converter/types/liquidity-pool-v2/LiquidityPoolV2Converter.sol";

/**
  * @dev Improved testing version of the liquidity Pool v2 Converter
  *
  * This builds on top of oracle-based-amm/solidity/contracts/helpers/TestLiquidityPoolV2Converter.sol
  * but adds methods for setting the reserve balances without affecting staked balances, and for doing other useful
  * development stuff.
  * This way, we can initialize the contract to any state we want in unit tests.
  *
  * It should go without saying, but:
  *
  * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  * !! DO NOT UNDER ANY CIRCUMSTANCE DEPLOY THIS CONTRACT TO PRODUCTION. !!
  * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  *
  * The nature of the contract means that anyone can can retrieve all tokens at will.
*/
contract ImprovedTestLiquidityPoolV2Converter is LiquidityPoolV2Converter {
    uint256 public currentTime;

    constructor(
        IPoolTokensContainer _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public LiquidityPoolV2Converter(_token, _registry, _maxConversionFee) {}

    function setReferenceRateUpdateTime(uint256 _referenceRateUpdateTime) public {
        referenceRateUpdateTime = _referenceRateUpdateTime;
    }

    function time() internal view returns (uint256) {
        return currentTime != 0 ? currentTime : now;
    }

    function setTime(uint256 _currentTime) public {
        currentTime = _currentTime;
    }

    function calculateFeeToEquilibriumTest(
        uint256 _primaryReserveStaked,
        uint256 _secondaryReserveStaked,
        uint256 _primaryReserveWeight,
        uint256 _secondaryReserveWeight,
        uint256 _primaryReserveRate,
        uint256 _secondaryReserveRate,
        uint256 _dynamicFeeFactor
    ) external pure returns (uint256) {
        return
        calculateFeeToEquilibrium(
            _primaryReserveStaked,
            _secondaryReserveStaked,
            _primaryReserveWeight,
            _secondaryReserveWeight,
            _primaryReserveRate,
            _secondaryReserveRate,
            _dynamicFeeFactor
        );
    }

    function setReserveWeight(IERC20Token _reserveToken, uint32 _weight) public validReserve(_reserveToken) {
        reserves[_reserveToken].weight = _weight;
    }

    /**
      * @dev transfers tokens from sender to the contract, increasing reserve balance
      * without affecting staked balance
      * the sender needs to approve the contract to spend tokens first
      *
      * @param  _reserveToken    reserve token, the reserve balance of which to increase
      * @param  _amount          amount of tokens to transfer/balance to increase
    */
    function addToReserveBalance(IERC20Token _reserveToken, uint256 _amount) public validReserve(_reserveToken) {
        _reserveToken.transferFrom(msg.sender, address(this), _amount);
        reserves[_reserveToken].balance = reserves[_reserveToken].balance.add(_amount);
    }

    /**
      * @dev transfers tokens from the contract to the sender, decreasing reserve balance
      * without affecting staked balance
      *
      * @param  _reserveToken    reserve token, the reserve balance of which to decrease
      * @param  _amount          amount of tokens to transfer/balance to decrease
    */
    function subtractFromReserveBalance(IERC20Token _reserveToken, uint256 _amount) public validReserve(_reserveToken) {
        require(reserves[_reserveToken].balance >= _amount, "ERR_RESERVE_BALANCE_WOULD_BECOME_NEGATIVE");
        _reserveToken.transfer(msg.sender, _amount);
        reserves[_reserveToken].balance = reserves[_reserveToken].balance.sub(_amount);
    }

    /**
      * @dev transfers tokens to/from the contract, increasing/decreasing the reserve balance to the desired balance
      * without affecting staked balance.
      * the sender should approve the contract to spend tokens first, in case tokens are transferred to
      * the contract.
      *
      * @param  _reserveToken    reserve token, the reserve balance of which to increase or decrease
      * @param  _balance         desired reserve balance for the contract
    */
    function setReserveBalance(IERC20Token _reserveToken, uint256 _balance) public validReserve(_reserveToken) {
        uint256 reserveBalance = reserves[_reserveToken].balance;
        if(_balance > reserveBalance) {
            addToReserveBalance(_reserveToken, _balance.sub(reserveBalance));
        } else if (_balance < reserveBalance) {
            subtractFromReserveBalance(_reserveToken, reserveBalance.sub(_balance));
        }
    }

    /**
      * @dev updates reference rate and update times from priceOracle.
      * does not rebalance weights
    */
    function updateRateAndTimeFromPriceOracle() public {
        (uint256 oracleRateN, uint256 oracleRateD, uint256 oracleUpdateTime) = priceOracle.latestRateAndUpdateTime(primaryReserveToken, secondaryReserveToken);
        currentTime = oracleUpdateTime;
        referenceRateUpdateTime = currentTime - 1 seconds;
        referenceRate = Fraction({ n: oracleRateN, d: oracleRateD });
    }

    /**
      * @dev forces rebalancing of weights according to the reference rate
    */
    function forceRebalance() public {
        // get the new reserve weights
        (uint256 primaryReserveWeight, uint256 secondaryReserveWeight) = effectiveReserveWeights();

        // update the reserve weights with the new values
        reserves[primaryReserveToken].weight = uint32(primaryReserveWeight);
        reserves[secondaryReserveToken].weight = uint32(secondaryReserveWeight);
    }
}
