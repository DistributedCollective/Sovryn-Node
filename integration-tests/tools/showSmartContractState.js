/**
 * Fetches current state from the smart contracts
 *
 * Run it like this:
 * node -r esm fetchCurrentState.js [mainnet|testnet]
 *
 * Probably useful for testing.
 */
import C from '../../controller/contract';
import abiTestToken from "../../config/abiTestToken";
import config from "../../config/config";
const { BN } = require("@openzeppelin/test-helpers");

export async function main() {
    const network = config.network;
    const tokenDoc = C.contractTokenSUSD;
    const tokenRbtc = C.contractTokenRBTC;
    const tokenUsdt = C.contractTokenUSDT;
    const tokenBpro = C.contractTokenBPRO;

    const utility = new SmartContractStateUtility();

    console.log('Querying smartcontract state on network', network);
    console.log('AMM address:', utility.amm._address);
    console.log('priceFeeds address:', utility.priceFeeds._address);
    console.log('');
    await utility.queryAllForTokenPair(tokenRbtc, tokenUsdt);
    console.log('');
    await utility.queryAllForTokenPair(tokenRbtc, tokenDoc);
    console.log('');
    await utility.queryAllForTokenPair(tokenRbtc, tokenBpro);
    if(network === 'main') {
        console.log('');
        await utility.querySovLiquidityPoolData("0x1d2c04967e8b17168310fd7035cc219de477be82");
    }
}

export class SmartContractStateUtility {
    constructor() {
        this.web3 = C.web3;
        this.amm = C.contractSwaps;
        this.priceFeeds = C.contractPriceFeed;
    }

    async queryAllForTokenPair(tokenA, tokenB) {
        tokenA = normalizeToken(tokenA);
        tokenB = normalizeToken(tokenB);
        const web3 = this.web3;
        const priceFeeds = this.priceFeeds;

        const aSymbol = await tokenA.methods.symbol().call();
        const bSymbol = await tokenB.methods.symbol().call();
        const aToBRate = await priceFeeds.methods.queryRate(tokenA._address, tokenB._address).call();
        const bToARate = await priceFeeds.methods.queryRate(tokenB._address, tokenA._address).call();
        const returnAmount = web3.utils.toWei(new BN(1), 'Ether');
        const aToBReturn = await priceFeeds.methods.queryReturn(tokenA._address, tokenB._address, returnAmount).call();
        const bToAReturn = await priceFeeds.methods.queryReturn(tokenB._address, tokenA._address, returnAmount).call();
        console.log("Tokens:")
        console.log(`${aSymbol} ${tokenA._address}`);
        console.log(`${bSymbol} ${tokenB._address}`);
        console.log("Rates from priceFeed:")
        console.log(`    ${aSymbol} -> ${bSymbol}: ${aToBRate.rate} / ${aToBRate.precision} = ${aToBRate.rate / aToBRate.precision}`);
        console.log(`    ${bSymbol} -> ${aSymbol}: ${bToARate.rate} / ${bToARate.precision} = ${bToARate.rate / bToARate.precision}`);
        console.log("Returns from priceFeed:")
        console.log(`    ${returnAmount} ${aSymbol} -> ${aToBReturn} ${bSymbol}`);
        console.log(`    ${returnAmount} ${bSymbol} -> ${bToAReturn} ${aSymbol}`);

        const liquidityPool = await C.getLiquidityPoolByTokens(tokenA._address, tokenB._address);
        const primaryReserveTokenAddress = await liquidityPool.methods.primaryReserveToken().call();
        const primaryReserveToken = C.getTokenInstance(primaryReserveTokenAddress);
        const primaryReserveTokenSymbol = await primaryReserveToken.methods.symbol().call();
        const secondaryReserveTokenAddress = await liquidityPool.methods.secondaryReserveToken().call();
        const secondaryReserveToken = C.getTokenInstance(secondaryReserveTokenAddress);
        const secondaryReserveTokenSymbol = await secondaryReserveToken.methods.symbol().call();

        console.log("Liquidity pool:", liquidityPool._address);
        console.log("Primary reserve token:", primaryReserveTokenSymbol, primaryReserveTokenAddress);
        console.log("Secondary reserve token:", secondaryReserveTokenSymbol, secondaryReserveTokenAddress);
        console.log("Dynamic fee factor:", await liquidityPool.methods.dynamicFeeFactor().call());
        console.log("Conversion fee:", await liquidityPool.methods.conversionFee().call());
        const referenceRate = await liquidityPool.methods.referenceRate().call();
        console.log(`Reference rate: ${referenceRate[0]} / ${referenceRate[1]} = ${referenceRate[0] / referenceRate[1]}`);

        const priceOracleAddress = await liquidityPool.methods.priceOracle().call();
        const priceOracle = this.getPriceOracle(priceOracleAddress);
        const oracleRate = await priceOracle.methods.latestRate(primaryReserveTokenAddress, secondaryReserveTokenAddress).call();
        const oracleRateReverse = await priceOracle.methods.latestRate(secondaryReserveTokenAddress, primaryReserveTokenAddress).call();
        console.log(`Rates from price oracle:`);
        console.log(`    ${primaryReserveTokenSymbol}/${secondaryReserveTokenSymbol}: ${oracleRate[0]} / ${oracleRate[1]} = ${oracleRate[0] / oracleRate[1]}`);
        console.log(`    ${secondaryReserveTokenSymbol}/${primaryReserveTokenSymbol}: ${oracleRateReverse[0]} / ${oracleRateReverse[1]} = ${oracleRateReverse[0] / oracleRateReverse[1]}`);

        console.log('effectiveTokensRate', await liquidityPool.methods.effectiveTokensRate().call());

        const effectiveReserveWeights = await liquidityPool.methods.effectiveReserveWeights().call()
        console.log('effectiveReserveWeights', effectiveReserveWeights);

        const primaryReserveWeight = await liquidityPool.methods.reserveWeight(primaryReserveTokenAddress).call();
        const secondaryReserveWeight = await liquidityPool.methods.reserveWeight(secondaryReserveTokenAddress).call();
        console.log(`reserveWeight(${primaryReserveTokenSymbol}) = ${primaryReserveWeight}`)
        console.log(`reserveWeight(${secondaryReserveTokenSymbol}) = ${secondaryReserveWeight}`)

        const primaryStakedBalance = await liquidityPool.methods.reserveStakedBalance(primaryReserveTokenAddress).call();
        const secondaryStakedBalance = await liquidityPool.methods.reserveStakedBalance(secondaryReserveTokenAddress).call();
        console.log(`reserveStakedBalance(${primaryReserveTokenSymbol}) = ${primaryStakedBalance}`)
        console.log(`reserveStakedBalance(${secondaryReserveTokenSymbol}) = ${secondaryStakedBalance}`)

        const primaryReserveBalance = await liquidityPool.methods.reserveBalance(primaryReserveTokenAddress).call();
        const secondaryReserveBalance = await liquidityPool.methods.reserveBalance(secondaryReserveTokenAddress).call();
        console.log(`reserveBalance(${primaryReserveTokenSymbol}) = ${primaryReserveBalance}`)
        console.log(`reserveBalance(${secondaryReserveTokenSymbol}) = ${secondaryReserveBalance}`)

        const primaryContractBalance = await primaryReserveToken.methods.balanceOf(liquidityPool._address).call();
        const secondaryContractBalance = await secondaryReserveToken.methods.balanceOf(liquidityPool._address).call();
        console.log(`token contract balance (${primaryReserveTokenSymbol}) = ${primaryContractBalance}`)
        console.log(`token contract balance (${secondaryReserveTokenSymbol}) = ${secondaryContractBalance}`)

        console.log(`Primary (${primaryReserveTokenSymbol}) delta (staked - actual):`, new BN(primaryStakedBalance).sub(new BN(primaryReserveBalance)).toString());
        console.log(`Secondary (${secondaryReserveTokenSymbol}) delta (staked - actual):`, new BN(secondaryStakedBalance).sub(new BN(secondaryReserveBalance)).toString());

        const converterInitializationScript = this.getConverterInitializationScript({
            primaryReserveToken: primaryReserveToken,
            secondaryReserveToken: secondaryReserveToken,
            initialPrimaryReserveLiquidity: primaryStakedBalance,
            initialSecondaryReserveLiquidity: secondaryStakedBalance,
            finalPrimaryReserveBalance: primaryReserveBalance,
            finalSecondaryReserveBalance: secondaryReserveBalance,
            finalPrimaryReserveWeight: primaryReserveWeight,
            finalSecondaryReserveWeight: secondaryReserveWeight,
            primaryPriceOracleAnswer: oracleRate[0],
            secondaryPriceOracleAnswer: oracleRate[1],
        });
        console.log(`Initialize the converter in tests with:\n${converterInitializationScript}\n`);
    }

    async querySovLiquidityPoolData(sovConverterAddress) {
        const sovPool = this.getSovLiquidityPool(sovConverterAddress);
        console.log('SOV anchor', await sovPool.methods.anchor().call());
        const sovPoolToken0Address = await sovPool.methods.reserveTokens(0).call();
        const sovPoolToken1Address = await sovPool.methods.reserveTokens(1).call();
        const sovPoolToken0 = new this.web3.eth.Contract(abiTestToken, sovPoolToken0Address);
        const sovPoolToken1 = new this.web3.eth.Contract(abiTestToken, sovPoolToken1Address);
        console.log('SOV converter token 0 ', await sovPoolToken0.methods.symbol().call(), sovPoolToken0Address);
        console.log('SOV converter token 1', await sovPoolToken1.methods.symbol().call(), sovPoolToken1Address);
    }

    getSovLiquidityPool(converterAddress) {
        return new this.web3.eth.Contract(
            [ { "constant": false, "inputs": [ { "name": "_onlyOwnerCanUpdateRegistry", "type": "bool" } ], "name": "restrictRegistryUpdate", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "reserveRatio", "outputs": [ { "name": "", "type": "uint32" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "_address", "type": "address" } ], "name": "connectors", "outputs": [ { "name": "", "type": "uint256" }, { "name": "", "type": "uint32" }, { "name": "", "type": "bool" }, { "name": "", "type": "bool" }, { "name": "", "type": "bool" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "hasETHReserve", "outputs": [ { "name": "", "type": "bool" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "_index", "type": "uint256" } ], "name": "connectorTokens", "outputs": [ { "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "_reserveToken", "type": "address" } ], "name": "reserveWeight", "outputs": [ { "name": "", "type": "uint32" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "_sourceToken", "type": "address" }, { "name": "_targetToken", "type": "address" }, { "name": "_amount", "type": "uint256" } ], "name": "getReturn", "outputs": [ { "name": "", "type": "uint256" }, { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [ { "name": "_newOwner", "type": "address" } ], "name": "transferTokenOwnership", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "isActive", "outputs": [ { "name": "", "type": "bool" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "onlyOwnerCanUpdateRegistry", "outputs": [ { "name": "", "type": "bool" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [], "name": "acceptTokenOwnership", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_token", "type": "address" }, { "name": "_to", "type": "address" }, { "name": "_amount", "type": "uint256" } ], "name": "withdrawFromAnchor", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "converterType", "outputs": [ { "name": "", "type": "uint16" } ], "payable": false, "stateMutability": "pure", "type": "function" }, { "constant": false, "inputs": [ { "name": "_amount", "type": "uint256" } ], "name": "liquidate", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [], "name": "updateRegistry", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_whitelist", "type": "address" } ], "name": "setConversionWhitelist", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "version", "outputs": [ { "name": "", "type": "uint16" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "conversionFee", "outputs": [ { "name": "", "type": "uint32" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [ { "name": "_token", "type": "address" }, { "name": "_to", "type": "address" }, { "name": "_amount", "type": "uint256" } ], "name": "withdrawTokens", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "prevRegistry", "outputs": [ { "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [ { "name": "_newOwner", "type": "address" } ], "name": "transferAnchorOwnership", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_to", "type": "address" } ], "name": "withdrawETH", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_token", "type": "address" }, { "name": "_weight", "type": "uint32" } ], "name": "addReserve", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [ { "name": "_x", "type": "uint256" } ], "name": "decimalLength", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "pure", "type": "function" }, { "constant": true, "inputs": [], "name": "connectorTokenCount", "outputs": [ { "name": "", "type": "uint16" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [], "name": "acceptOwnership", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "registry", "outputs": [ { "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [ { "name": "_reserveTokens", "type": "address[]" }, { "name": "_reserveAmounts", "type": "uint256[]" }, { "name": "_minReturn", "type": "uint256" } ], "name": "addLiquidity", "outputs": [], "payable": true, "stateMutability": "payable", "type": "function" }, { "constant": true, "inputs": [], "name": "owner", "outputs": [ { "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "maxConversionFee", "outputs": [ { "name": "", "type": "uint32" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "reserveTokenCount", "outputs": [ { "name": "", "type": "uint16" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "_values", "type": "uint256[]" } ], "name": "geometricMean", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "pure", "type": "function" }, { "constant": true, "inputs": [ { "name": "_sourceToken", "type": "address" }, { "name": "_targetToken", "type": "address" }, { "name": "_amount", "type": "uint256" } ], "name": "targetAmountAndFee", "outputs": [ { "name": "", "type": "uint256" }, { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [ { "name": "_amount", "type": "uint256" }, { "name": "_reserveTokens", "type": "address[]" }, { "name": "_reserveMinReturnAmounts", "type": "uint256[]" } ], "name": "removeLiquidity", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [], "name": "restoreRegistry", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [ { "name": "_n", "type": "uint256" }, { "name": "_d", "type": "uint256" } ], "name": "roundDiv", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "pure", "type": "function" }, { "constant": true, "inputs": [], "name": "conversionsEnabled", "outputs": [ { "name": "", "type": "bool" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "conversionWhitelist", "outputs": [ { "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [ { "name": "_amount", "type": "uint256" } ], "name": "fund", "outputs": [], "payable": true, "stateMutability": "payable", "type": "function" }, { "constant": false, "inputs": [], "name": "acceptAnchorOwnership", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [ { "name": "", "type": "uint256" } ], "name": "reserveTokens", "outputs": [ { "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "isV28OrHigher", "outputs": [ { "name": "", "type": "bool" } ], "payable": false, "stateMutability": "pure", "type": "function" }, { "constant": true, "inputs": [], "name": "anchor", "outputs": [ { "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "newOwner", "outputs": [ { "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [], "name": "upgrade", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [ { "name": "", "type": "address" } ], "name": "reserves", "outputs": [ { "name": "balance", "type": "uint256" }, { "name": "weight", "type": "uint32" }, { "name": "deprecated1", "type": "bool" }, { "name": "deprecated2", "type": "bool" }, { "name": "isSet", "type": "bool" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "_connectorToken", "type": "address" } ], "name": "getConnectorBalance", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "_reserveToken", "type": "address" } ], "name": "reserveBalance", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [ { "name": "_sourceToken", "type": "address" }, { "name": "_targetToken", "type": "address" }, { "name": "_amount", "type": "uint256" }, { "name": "_trader", "type": "address" }, { "name": "_beneficiary", "type": "address" } ], "name": "convert", "outputs": [ { "name": "", "type": "uint256" } ], "payable": true, "stateMutability": "payable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_conversionFee", "type": "uint32" } ], "name": "setConversionFee", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_newOwner", "type": "address" } ], "name": "transferOwnership", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "token", "outputs": [ { "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "inputs": [ { "name": "_token", "type": "address" }, { "name": "_registry", "type": "address" }, { "name": "_maxConversionFee", "type": "uint32" } ], "payable": false, "stateMutability": "nonpayable", "type": "constructor" }, { "payable": true, "stateMutability": "payable", "type": "fallback" }, { "anonymous": false, "inputs": [ { "indexed": true, "name": "_connectorToken", "type": "address" }, { "indexed": false, "name": "_tokenSupply", "type": "uint256" }, { "indexed": false, "name": "_connectorBalance", "type": "uint256" }, { "indexed": false, "name": "_connectorWeight", "type": "uint32" } ], "name": "PriceDataUpdate", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "name": "_provider", "type": "address" }, { "indexed": true, "name": "_reserveToken", "type": "address" }, { "indexed": false, "name": "_amount", "type": "uint256" }, { "indexed": false, "name": "_newBalance", "type": "uint256" }, { "indexed": false, "name": "_newSupply", "type": "uint256" } ], "name": "LiquidityAdded", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "name": "_provider", "type": "address" }, { "indexed": true, "name": "_reserveToken", "type": "address" }, { "indexed": false, "name": "_amount", "type": "uint256" }, { "indexed": false, "name": "_newBalance", "type": "uint256" }, { "indexed": false, "name": "_newSupply", "type": "uint256" } ], "name": "LiquidityRemoved", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "name": "_type", "type": "uint16" }, { "indexed": true, "name": "_anchor", "type": "address" }, { "indexed": true, "name": "_activated", "type": "bool" } ], "name": "Activation", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "name": "_fromToken", "type": "address" }, { "indexed": true, "name": "_toToken", "type": "address" }, { "indexed": true, "name": "_trader", "type": "address" }, { "indexed": false, "name": "_amount", "type": "uint256" }, { "indexed": false, "name": "_return", "type": "uint256" }, { "indexed": false, "name": "_conversionFee", "type": "int256" } ], "name": "Conversion", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "name": "_token1", "type": "address" }, { "indexed": true, "name": "_token2", "type": "address" }, { "indexed": false, "name": "_rateN", "type": "uint256" }, { "indexed": false, "name": "_rateD", "type": "uint256" } ], "name": "TokenRateUpdate", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": false, "name": "_prevFee", "type": "uint32" }, { "indexed": false, "name": "_newFee", "type": "uint32" } ], "name": "ConversionFeeUpdate", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "name": "_prevOwner", "type": "address" }, { "indexed": true, "name": "_newOwner", "type": "address" } ], "name": "OwnerUpdate", "type": "event" } ],
            converterAddress
        );
    }

    getPriceOracle(priceOracleAddress) {
        return new this.web3.eth.Contract(
            [{"constant":true,"inputs":[{"name":"_tokenA","type":"address"},{"name":"_tokenB","type":"address"}],"name":"latestRate","outputs":[{"name":"","type":"uint256"},{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_tokenA","type":"address"},{"name":"_tokenB","type":"address"}],"name":"latestRateAndUpdateTime","outputs":[{"name":"","type":"uint256"},{"name":"","type":"uint256"},{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"tokenAOracle","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"lastUpdateTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"tokenBOracle","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"}],
            priceOracleAddress
        );
    }

    getConverterInitializationScript({
        primaryReserveToken,
        secondaryReserveToken,
        initialPrimaryReserveLiquidity,
        initialSecondaryReserveLiquidity,
        finalPrimaryReserveBalance,
        finalSecondaryReserveBalance,
        finalPrimaryReserveWeight,
        finalSecondaryReserveWeight,
        primaryPriceOracleAnswer,
        secondaryPriceOracleAnswer,
    }) {
        const tokenContractNames = {}
        tokenContractNames[C.contractTokenSUSD._address.toLowerCase()] = 'docToken';
        tokenContractNames[C.contractTokenRBTC._address.toLowerCase()] = 'wrbtcToken';
        tokenContractNames[C.contractTokenUSDT._address.toLowerCase()] = 'usdtToken';
        tokenContractNames[C.contractTokenBPRO._address.toLowerCase()] = 'bproToken';

        const primaryTokenContractName = tokenContractNames[primaryReserveToken._address.toLowerCase()];
        const secondaryTokenContractName = tokenContractNames[secondaryReserveToken._address.toLowerCase()];

        function bnRepr(bn) {
            bn = new BN(bn);
            return `new BN('${bn.toString()}')`;
        }

        const lines = [
            `await converters.initConverter({`,
            `    primaryReserveToken: sovrynContracts.${primaryTokenContractName},`,
            `    secondaryReserveToken: sovrynContracts.${secondaryTokenContractName},`,
            `    initialPrimaryReserveLiquidity: ${bnRepr(initialPrimaryReserveLiquidity)},`,
            `    initialSecondaryReserveLiquidity: ${bnRepr(initialSecondaryReserveLiquidity)},`,
            `    finalPrimaryReserveBalance: ${bnRepr(finalPrimaryReserveBalance)},`,
            `    finalSecondaryReserveBalance: ${bnRepr(finalSecondaryReserveBalance)},`,
            `    finalPrimaryReserveWeight: ${bnRepr(finalPrimaryReserveWeight)},`,
            `    finalSecondaryReserveWeight: ${bnRepr(finalSecondaryReserveWeight)},`,
            `    primaryPriceOracleAnswer: ${bnRepr(primaryPriceOracleAnswer)},`,
            `    secondaryPriceOracleAnswer: ${bnRepr(secondaryPriceOracleAnswer)},`,
            `});`,
        ];
        return lines.join('\n');
    }
}

function normalizeToken(token) {
    // normalize tokens passed from hardhat tests (they have address instead of _address, and a different
    // API in general)
    const address = token.address;
    if(address) {
        token = C.getTokenInstance(address);
        if(!token) {
            throw new Error(`Cannot normalize token with address ${address}`);
        }
    }
    return token;
}

if(require.main === module) {
    // only run main if this script is run directly
    main();
}