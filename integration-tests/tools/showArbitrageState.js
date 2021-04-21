/**
 * Fetches arbitrage related state from the smartcontracts
 *
 * Run it like this:
 * node -r esm fetchCurrentState.js [mainnet|testnet]
 *
 * Hopefully can be used to investigate optimal arbitrage amounts
 */
import { ether } from '@openzeppelin/test-helpers';
import C from '../../controller/contract';
import conf from '../../config/config';
import Arbitrage from '../../controller/arbitrage';


const ARBITRAGE_DATA = {};

async function main() {
    console.log('Running on network', conf.network);
    const tokenConfig = [
        [conf.USDTToken, conf.testTokenRBTC],
        [conf.testTokenRBTC, conf.USDTToken],
        [conf.docToken, conf.testTokenRBTC],
        [conf.testTokenRBTC, conf.docToken],
    ];
    for(let [sourceTokenAddress, destTokenAddress] of tokenConfig) {
        ARBITRAGE_DATA[sourceTokenAddress] = ARBITRAGE_DATA[sourceTokenAddress] || {};
        ARBITRAGE_DATA[sourceTokenAddress][destTokenAddress] = ARBITRAGE_DATA[sourceTokenAddress][destTokenAddress] || [];

        const [sourceDelta] = await fetchPoolBalances(sourceTokenAddress, destTokenAddress);

        if(sourceTokenAddress === conf.testTokenRBTC) {
            for(let i = 0.001; i <= 10000; i *= 10) {
                await fetchArbitrageData(sourceTokenAddress, destTokenAddress, i / 2);
                await fetchArbitrageData(sourceTokenAddress, destTokenAddress, i);
                await fetchArbitrageData(sourceTokenAddress, destTokenAddress, i * 2);
            }
        } else {
            await fetchArbitrageData(sourceTokenAddress, destTokenAddress, 0.1);
            await fetchArbitrageData(sourceTokenAddress, destTokenAddress, 1);
            await fetchArbitrageData(sourceTokenAddress, destTokenAddress, 1000);
            await fetchArbitrageData(sourceTokenAddress, destTokenAddress, 10000);
            for(let i = 30; i <= 100; i += 5) {
                await fetchArbitrageData(sourceTokenAddress, destTokenAddress, 10000 * i);
            }
            await fetchArbitrageData(sourceTokenAddress, destTokenAddress, 10000000);
        }
        if(sourceDelta.gt(C.web3.utils.toBN('0'))) {
            // this is the approach used by Arbitrage
            console.log('source delta is positive, standard arbitrage approach:');
            await fetchArbitrageData(sourceTokenAddress, destTokenAddress, parseFloat(C.web3.utils.fromWei(sourceDelta)));
        } else if(sourceDelta.lt(C.web3.utils.toBN('0'))) {
            console.log('source delta is negative, another approach:');
            const oracleRate = await C.contractPriceFeed.methods.queryRate(sourceTokenAddress, destTokenAddress).call();
            console.log('    (oracleRate:', oracleRate, ')');
            const amount = sourceDelta.abs().mul(C.web3.utils.toBN(oracleRate.rate)).div(C.web3.utils.toBN(oracleRate.precision));
            console.log(`    (amount: ${C.web3.utils.fromWei(amount)})`)
            await fetchArbitrageData(sourceTokenAddress, destTokenAddress, parseFloat(C.web3.utils.fromWei(amount)));
        }
        printProfits(sourceTokenAddress, destTokenAddress);
        //printProfits(sourceTokenAddress, destTokenAddress, 'normalizedProfitOverPriceFeed');
        console.log('\n');
    }
}

async function fetchPoolBalances(sourceTokenAddress, destTokenAddress) {
    const sourceTokenSymbol = C.getTokenSymbol(sourceTokenAddress);
    const destTokenSymbol = C.getTokenSymbol(destTokenAddress);
    const liquidityPool = await C.getLiquidityPoolByTokens(sourceTokenAddress, destTokenAddress);
    const toBN = C.web3.utils.toBN;
    const sourceTokenReserveBalance = toBN(await liquidityPool.methods.reserveBalance(sourceTokenAddress).call());
    const destTokenReserveBalance = toBN(await liquidityPool.methods.reserveBalance(destTokenAddress).call());
    const sourceTokenReserveStakedBalance = toBN(await liquidityPool.methods.reserveStakedBalance(sourceTokenAddress).call());
    const destTokenReserveStakedBalance = toBN(await liquidityPool.methods.reserveStakedBalance(destTokenAddress).call());
    const sourceTokenDelta = sourceTokenReserveStakedBalance.sub(sourceTokenReserveBalance);
    const destTokenDelta = destTokenReserveStakedBalance.sub(destTokenReserveBalance);
    console.log(`Pool: ${sourceTokenSymbol}-${destTokenSymbol}`)
    console.log(`Balance for ${sourceTokenSymbol}:`)
    console.log(`    staked: ${C.web3.utils.fromWei(sourceTokenReserveStakedBalance)}`)
    console.log(`    reserve: ${C.web3.utils.fromWei(sourceTokenReserveBalance)}`)
    console.log(`    delta: ${C.web3.utils.fromWei(sourceTokenDelta)}`)
    console.log(`Balance for ${destTokenSymbol}:`)
    console.log(`    staked: ${C.web3.utils.fromWei(destTokenReserveStakedBalance)}`)
    console.log(`    reserve: ${C.web3.utils.fromWei(destTokenReserveBalance)}`)
    console.log(`    delta: ${C.web3.utils.fromWei(destTokenDelta)}`)
    return [sourceTokenDelta, destTokenDelta];
}

async function fetchArbitrageData(sourceTokenAddress, destTokenAddress, amountEth) {
    const sourceTokenSymbol = C.getTokenSymbol(sourceTokenAddress);
    const destTokenSymbol = C.getTokenSymbol(destTokenAddress);
    const amount = ether(amountEth.toString());
    const priceAmmWei = await Arbitrage.getPriceFromAmm(
        C.contractSwaps,
        sourceTokenAddress,
        destTokenAddress,
        amount
    );
    const pricePriceFeedWei = await Arbitrage.getPriceFromPriceFeed(
        C.contractPriceFeed,
        sourceTokenAddress,
        destTokenAddress,
        amount
    );
    if(priceAmmWei.isZero() || priceAmmWei.isNeg()) {
        console.error("Invalid AMM price: " + priceAmmWei.toString());
        return;
    }
    if(pricePriceFeedWei.isZero() || pricePriceFeedWei.isNeg()) {
        console.error("Invalid price feed price: " + pricePriceFeedWei.toString());
        return;
    }
    const priceAmm = parseFloat(C.web3.utils.fromWei(priceAmmWei, 'Ether'));
    const pricePriceFeed = parseFloat(C.web3.utils.fromWei(pricePriceFeedWei, 'Ether'));
    console.log(`${C.web3.utils.fromWei(amount)} ${sourceTokenSymbol} -> ${destTokenSymbol}`)
    console.log('    amm: ', priceAmm / amountEth)
    console.log('    feed:', pricePriceFeed / amountEth)
    console.log('    amm price is', priceAmm / pricePriceFeed * 100, '% of feed price');
    console.log('    price diff is', priceAmm / pricePriceFeed * 100 - 100, '%');

    const profitOverPriceFeed = priceAmm - pricePriceFeed;
    console.log(`    profit over priceFeed: ${profitOverPriceFeed} ${destTokenSymbol}`)
    ARBITRAGE_DATA[sourceTokenAddress][destTokenAddress].push({
        amountEth,
        normalizedAmmPrice: priceAmm / amountEth,
        profitOverPriceFeed,
        normalizedProfitOverPriceFeed: profitOverPriceFeed / amountEth,
    })
}

function printProfits(sourceTokenAddress, destTokenAddress, key = 'profitOverPriceFeed') {
    const sourceTokenSymbol = C.getTokenSymbol(sourceTokenAddress);
    const destTokenSymbol = C.getTokenSymbol(destTokenAddress);
    const profits = [...ARBITRAGE_DATA[sourceTokenAddress][destTokenAddress]]
    profits.sort((a, b) => (b[key] - a[key]));
    for(let obj of profits) {
        const profitVal = obj[key];
        console.log(`${key} for ${obj.amountEth} ${sourceTokenSymbol} is ${profitVal} ${destTokenSymbol}`);
    }
}


if(require.main === module) {
    // only run main if this script is run directly
    main();
}
