/**
 * The arbitrage controller tries to capitalize on changes in market price between alle the enabled token pairs and RBtc on the Sovryn amm.
 *
 * The amount for which we seek arbitrage is defined in the config (amountArbitrage).
 * It start an endless loop:
 * 1. Get the price from the amm. This returns the expected return form the Sovryn network.
 * 2. Get the price from the price feed contract. This returns the oracle price.
 * 3. Compare the prices. If the difference is >= threshold (config/thresholdArbitrage) then sell arbitrage amount of liquidity of the respective currency to the amm,
 * Inform the telegram group about a successful arbitrage trade and save statistic in db
 *
 * The swap network contract (conf.swapsImpl) need to be approved by the arbitrage wallet to spend tokens on his behalf
 */

import C from './contract';
import U from '../util/helper';
import A from '../secrets/accounts';
import conf from '../config/config';
import  common from './common';
import abiDecoder from 'abi-decoder';
import abiSwap from "../config/abiSovrynSwapNetwork";
import db from "./db";


class Arbitrage {
    constructor() {
        abiDecoder.addABI(abiSwap);
    }

    /**
     * Wrapper checking arbitrage opportunities
     * 1. Compare RBtc prices from Amm with the oracle
     * 2. If arbitrage opportunity is found: buy the tokens which are too many:
     * Token x if price(Amm) < price(PriceFeed), RBtc otherwise
     */
    async start() {
        while (true) {
            console.log("started checking prices");

            let res, arb, profit;
            let prices = await this.getRBtcPrices();
            console.log(prices)

            for(let p in prices) {
                //set arb to the lower price in USD (prices are actually return values given for 0.005 rbtc)
                if(prices[p][0]>0 && prices[p][1]>0) arb = this.calcArbitrage(prices[p][0], prices[p][1], p, conf.thresholdArbitrage);

                //the AMM price is lower -> buy BTC
                if (arb && (arb === parseFloat(prices[p][0]).toFixed(5))) {
                    let convertedAmount = C.web3.utils.toWei(prices[p][0].toString(), "Ether");
                    res = await this.swap(convertedAmount, p, 'rbtc');
                }
                //the oracle price is lower -> sell btc
                else if (arb && (arb === parseFloat(prices[p][1]).toFixed(5))) {
                    res = await this.swap(C.web3.utils.toWei(conf.amountArbitrage.toString()), 'rbtc', p);
                }

                if(res) profit = await this.calculateProfit(res, p[1]);
            }

            console.log("Completed checking prices at ");
            await U.wasteTime(conf.arbitrageScanInterval);
        }
    }

    /**
     * If price difference between p1 and p2 >= threshold return Min(p1,p2)
     * else return 0
     */
    calcArbitrage(p1, p2, token, threshold) {
        const smallerAmount = Math.min(p1, p2);
        const arbitrage = Math.abs(p1 - p2) / smallerAmount * 100;
        if (arbitrage >= threshold) {
            console.log(`Arbitrage ${token}: `+arbitrage);
            if(smallerAmount === p1) console.log(`Buy ${token}!`)
            else console.log("Buy RBtc");

            return smallerAmount.toFixed(5);
        }
        console.log(arbitrage+ " % price difference is too small for arbitrage");
        return;
    }

    async getRBtcPrices() {
        const amount = C.web3.utils.toWei(conf.amountArbitrage.toString(), "Ether");
        // TODO: refactor to automatically include all tokens from tokensDictionary

        //doc
        let rBtcDocAmm = await this.getPriceFromAmm(C.contractSwaps, conf.testTokenRBTC, conf.docToken, amount);
        rBtcDocAmm = C.web3.utils.fromWei(rBtcDocAmm.toString(), "Ether");
        rBtcDocAmm = parseFloat(rBtcDocAmm).toFixed(5);
        let rBtcDocPf = await this.getPriceFromPriceFeed(C.contractPriceFeed, conf.testTokenRBTC, conf.docToken, amount);
        rBtcDocPf = C.web3.utils.fromWei(rBtcDocPf.toString(), "Ether");
        rBtcDocPf = parseFloat(rBtcDocPf).toFixed(5);

        //usdt
        let rBtcUsdtAmm = await this.getPriceFromAmm(C.contractSwaps, conf.testTokenRBTC, conf.USDTToken, amount);
        rBtcUsdtAmm = C.web3.utils.fromWei(rBtcUsdtAmm.toString(), "Ether");
        rBtcUsdtAmm = parseFloat(rBtcUsdtAmm).toFixed(5);
        let rBtcUsdtPf = await this.getPriceFromPriceFeed(C.contractPriceFeed, conf.testTokenRBTC, conf.USDTToken, amount);
        rBtcUsdtPf = C.web3.utils.fromWei(rBtcUsdtPf.toString(), "Ether");
        rBtcUsdtPf = parseFloat(rBtcUsdtPf).toFixed(5);

        //bpro
        /*
        let rBtcBproAmm = await this.getPriceFromAmm(C.contractSwaps, conf.testTokenRBTC, conf.BProToken, amount);
        rBtcBproAmm = C.web3.utils.fromWei(rBtcBproAmm.toString(), "Ether");
        let rBtcBproPf = await this.getPriceFromPriceFeed(C.contractPriceFeed, conf.testTokenRBTC, conf.BProToken, amount);
        rBtcBproPf = C.web3.utils.fromWei(rBtcBproPf.toString(), "Ether");*/

        return {"doc": [rBtcDocAmm, rBtcDocPf], "usdt": [rBtcUsdtAmm, rBtcUsdtPf], /*"bpro": [rBtcBproAmm, rBtcBproPf]*/};
    }

    /**
    * Amount is based in sourceToken
    * Returns price in wei
    */
    getPriceFromPriceFeed(contract, sourceToken, destToken, amount) {
        return new Promise(async (resolve) => {
            try {
                contract.methods["queryReturn"](sourceToken, destToken, amount).call((error, result) => {
                    if (error) {
                        console.error("error loading price from " + contract._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                        console.error(error);
                        return resolve(0);
                    }
                    resolve(result);
                });
            }
            catch (e) {
                console.error("error loading price from " + contract._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                console.error(e);
                resolve(0)
            }
        });
    }

    /**
     * Amount is based in sourceToken
     * Price need to be retrieven in 2 steps
     * 1. Call function conversionPath on to get the conversion path
     * 2. Call rateByPath assigning the conversion path and amount to get the actual price
     * Returns price in wei
     */
    getPriceFromAmm(contract, sourceToken, destToken, amount) {
        return new Promise(async (resolve) => {
            try {
                contract.methods["conversionPath"](sourceToken, destToken).call((error, result) => {
                    if (error) {
                        console.error("error loading conversion path 1 from " + contract._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                        console.error(error);
                        return resolve(0);
                    }

                    contract.methods["rateByPath"](result, amount).call((err, res) => {
                        if (err) {
                            console.error("error loading rate path from " + contract._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                            console.error(err);
                            return resolve(0);
                        }
                        resolve(res);
                    });
                });
            }
            catch (e) {
                console.error("error loading price from " + contract._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                console.error(e);
                resolve(0)
            }
        });
    }


    /**
     * Sending Doc or RBtc to the Amm
     * Amount in wei
     * todo: convert minReturn with web3-big-number lib
     */
    swap(amount, sourceCurrency, destCurrency, address) {
        console.log("Send " + amount + " src "+sourceCurrency+" dest "+destCurrency+" to the amm");
        let sourceToken, destToken;

        if(sourceCurrency === "doc") sourceToken = conf.docToken;
        else if(sourceCurrency === "usdt") sourceToken = conf.USDTToken;
        else if(sourceCurrency === "bpro") sourceToken = conf.BProToken;
        else sourceToken = conf.testTokenRBTC;

        if(destCurrency === "doc") destToken = conf.docToken;
        else if(destCurrency === "usdt") destToken = conf.USDTToken;
        else if(destCurrency === "bpro") destToken = conf.BProToken;
        else destToken = conf.testTokenRBTC;

        const contract1 = C.contractSwaps;
        const contract2 = C.wRbtcWrapper;
        const minReturn = 1; //amount / 100 * 99; //minReturn = 1 -> No assurance
        const beneficiary = address || A.arbitrage[0].adr;
        const affiliateAcc = "0x0000000000000000000000000000000000000000";
        const affiliateFee = 0;
        const val = sourceCurrency === "rbtc"? amount:0;
        const numberOfHops = destCurrency === "rbtc" || sourceCurrency === "rbtc" ? 3 : 5;

        return new Promise(async (resolve) => {
            try {
                contract1.methods["conversionPath"](sourceToken, destToken).call(async (error, result) => {
                    if (error || !result || result.length !== numberOfHops) {
                        console.error("error loading conversion path from " + contract1._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                        console.error(error);
                        return resolve();
                    }

                    const gasPrice = await C.getGasPrice();
                    contract2.methods["convertByPath"](result, amount, minReturn)
                        .send({ from: beneficiary, gas: 2500000, gasPrice: gasPrice, value: val })
                        .then(async (tx) => {
                            console.log("Arbitrage tx successful");
                            return resolve(tx);
                        })
                        .catch(async (err) => {
                            console.error("Error on arbitrage tx ");
                            console.error(err);
                            //await common.telegramBot.sendMessage(err);
                            return resolve();
                        });
                });
            }
            catch (e) {
                console.error("error loading price from " + contract2._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                console.error(e);
                resolve()
            }
        });

    }

    async calculateProfit(tx, btcPriceFeed){
        try {
            console.log("Calculate profit from arbitrage");
            const receipt = await C.web3.eth.getTransactionReceipt(tx.transactionHash);
            console.log(receipt);

            if (receipt && receipt.logs) {
                const logs = abiDecoder.decodeLogs(receipt.logs);
                const conversionEvent = (logs || []).find(log => log && log.name === "Conversion");
                console.log(JSON.stringify(logs, null, 2));

                if (conversionEvent && conversionEvent.events) {
                    const priceFeed = Number(btcPriceFeed)/conf.amountArbitrage;
                    console.log(priceFeed)
                    let {fromToken, toToken, fromAmount, toAmount, trader} = U.parseEventParams(conversionEvent.events);
                    let toAmountWithPFeed, trade;

                    fromAmount = Number(C.web3.utils.fromWei(fromAmount.toString(), 'ether'));
                    toAmount = Number(C.web3.utils.fromWei(toAmount.toString(), 'ether'));

                    console.log(fromAmount); console.log(toAmount);

                    if (fromToken.toLowerCase() === conf.testTokenRBTC.toLowerCase()) {
                        toAmountWithPFeed = Number(fromAmount) * priceFeed;
                        trade = 'sell btc';
                    } else {
                        toAmountWithPFeed = Number(fromAmount) / priceFeed;
                        trade = 'buy btc';
                    }
                    const profit = toAmount - toAmountWithPFeed;
                    console.log(profit)

                    console.log({trader,
                        fromToken, toToken,
                        fromAmount, toAmount,
                        profit,
                        trade
                    })

                    await db.addArbitrage({
                        adr: trader,
                        fromToken, toToken,
                        fromAmount, toAmount,
                        profit,
                        trade
                    })
                }
            }

        } catch (e) {
            console.error("Error when calculate arbitrage profit", e);
        }
    }

    /**
    * Converts RBtc to Doc on MoneyOnchain
    */
    convertOnMoc() {

    }
}

export default new Arbitrage();
