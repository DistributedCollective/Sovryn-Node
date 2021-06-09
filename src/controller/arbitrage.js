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
import Web3 from 'web3';
import Extra from 'telegraf/extra';
import conf from '../config/config';
import  common from './common';
import abiDecoder from 'abi-decoder';
import abiSwap from "../config/abiSovrynSwapNetwork";
import db from "./db";

const BN = Web3.utils.BN;

export class ArbitrageOpportunity {
    /**
     * Construct an arbitrage opportunity DTO.
     *
     * @param {string} sourceTokenAddress The token to sell
     * @param {string} destTokenAddress The token to get in exchange
     * @param {BN} amount Amount of sourceTokenAddress to sell
     * @param {string} sourceTokenSymbol Symbol of the token to sell
     * @param {string} destTokenSymbol Symbol of the token to get in exchnage
     */
    constructor(sourceTokenAddress, destTokenAddress, amount, sourceTokenSymbol, destTokenSymbol) {
        this.sourceTokenAddress = sourceTokenAddress;
        this.destTokenAddress = destTokenAddress;
        this.amount = amount;
        this.sourceTokenSymbol = sourceTokenSymbol;
        this.destTokenSymbol = destTokenSymbol;
    }

    toString() {
        return (
            `<ArbitrageOpportunity(` +
            `source=${this.sourceTokenSymbol}(${this.sourceTokenAddress}), ` +
            `dest=${this.destTokenSymbol}(${this.destTokenAddress}), ` +
            `amount=${C.web3.utils.fromWei(this.amount)} (${this.amount.toString()} wei)` +
            `)>`
        )
    }
}

/**
 * Calculate the arbitrage opportunity for a token pair, given both actual contract balance and staked balance
 * in the liquidity pool for both.
 *
 * The calculation is based on the principles outlined in this article:
 * https://blog.bancor.network/calculating-dynamic-reserve-weights-in-bancorv2-538b901bcac4
 *
 * In summary, whenever the staked balance of a token exceeds the balance actually owned by the liquidity pool,
 * there exists an arbitrage opportunity to sell the token, and the optimal amount to sell is:
 *
 *     stakedBalance - contractBalance
 *
 * In case this is negative, we calculate the amount using the balances of the other token and sell it instead.
 * No complicated math should be required.
 *
 * Note that this calculation doesn't mean the opportunity is worth our time when all fees are considered.
 *
 * @param {string} token1Address Address of first token
 * @param {BN} token1ContractBalance Amount of first token actually owned by the liquidity pool
 * @param {BN} token1StakedBalance Amount of first token staked in the liquidity pool
 * @param {string} token1Symbol Symbol of first token
 * @param {string} token2Address Address of second token
 * @param {BN} token2ContractBalance Amount of second token actually owned by the liquidity pool
 * @param {BN} token2StakedBalance Amount of second token staked in the liquidity pool
 * @param {string} token2Symbol Symbol of second token token
 * @param {object} opts Extra options
 * @returns {(ArbitrageOpportunity|null)} DTO representing the opportunity, or null if none found
 */
export function calculateArbitrageOpportunity(
    token1Address,
    token1ContractBalance,
    token1StakedBalance,
    token1Symbol,
    token2Address,
    token2ContractBalance,
    token2StakedBalance,
    token2Symbol,
    opts = {},
) {
    const token1Delta = token1StakedBalance.sub(token1ContractBalance);
    const token2Delta = token2StakedBalance.sub(token2ContractBalance);
    if(opts || opts.log) {
        console.log(
            `${token1Symbol} amm balances:`,
            C.web3.utils.fromWei(token1StakedBalance),
            C.web3.utils.fromWei(token1ContractBalance),
            C.web3.utils.fromWei(token1Delta)
        );
        console.log(
            `${token2Symbol} amm balances:`,
            C.web3.utils.fromWei(token2StakedBalance),
            C.web3.utils.fromWei(token2ContractBalance),
            C.web3.utils.fromWei(token2Delta)
        );
    }

    if(token1Delta.isZero() && token2Delta.isZero()) {
        // perfect equilibrium - no arbitrage
        return null;
    }

    // TODO: figure out the best way to handle the following edge cases:
    // - It's possible for stakedBalance - contractBalance to be negative for one token and 0 for the other
    // - It's possible for stakedBalance - contractBalance to be negative for both tokens
    // - It's possible for stakedBalance - contractBalance to be positive for both tokens
    if((token1Delta.isNeg() || token1Delta.isZero()) && (token2Delta.isNeg() || token2Delta.isZero())) {
        return null;
    }

    let sourceTokenAddress, destTokenAddress, amount, sourceTokenSymbol, destTokenSymbol;
    if(token1Delta.isNeg()) {
        sourceTokenAddress = token2Address;
        destTokenAddress = token1Address;
        amount = token2Delta;
        sourceTokenSymbol = token2Symbol;
        destTokenSymbol = token1Symbol;
    } else {
        sourceTokenAddress = token1Address;
        destTokenAddress = token2Address;
        amount = token1Delta;
        sourceTokenSymbol = token1Symbol;
        destTokenSymbol = token2Symbol;
    }

    if(amount.isZero()) {
        // no opportunity here
        return null;
    }
    return new ArbitrageOpportunity(
        sourceTokenAddress,
        destTokenAddress,
        amount,
        sourceTokenSymbol,
        destTokenSymbol,
    )
}


/**
 * Main arbitrage controller
 */
class Arbitrage {
    constructor() {
        abiDecoder.addABI(abiSwap);
        this.BN = C.web3.utils.toBN;
    }

    /**
     * Wrapper checking arbitrage opportunities
     * 1. Compare RBtc prices from Amm with the oracle
     * 2. If arbitrage opportunity is found: buy the tokens which are too many:
     * Token x if price(Amm) < price(PriceFeed), RBtc otherwise
     */

    async start(arbitrageDeals) {
        if(conf.enableDynamicArbitrageAmount) {
            await this.startDynamicAmount(arbitrageDeals);
        } else {
            await this.startFixedAmount(arbitrageDeals);
        }
    }

    async startDynamicAmount(arbitrageDeals = null) {
        const tokens = [
            ['usdt', conf.USDTToken],
            ['doc', conf.docToken],
        ];
        while(true) {
            console.log("started checking prices (dynamic)");

            for(const [tokenSymbol, tokenAddress] of tokens) {
                try {
                    await this.handleDynamicArbitrageForToken(tokenSymbol, tokenAddress, arbitrageDeals);
                } catch(e) {
                    console.error(`Error handling arbitrage for token ${tokenSymbol}`, e);
                }
            }

            console.log("Completed checking prices");
            await U.wasteTime(conf.arbitrageScanInterval);
        }
    }

    async handleDynamicArbitrageForToken(tokenSymbol, tokenAddress, arbitrageDeals) {
        console.log(`checking token ${tokenSymbol}`);
        const arbitrageOpportunity = await this.findArbitrageOpportunityForToken(tokenSymbol, tokenAddress);
        if(!arbitrageOpportunity) {
            console.log(`no arbitrage opportunity found for ${tokenSymbol}`)
            return;
        }
        console.log(
            `Found arbitrage opportunity: ${C.web3.utils.fromWei(arbitrageOpportunity.amount)} ` +
            `${arbitrageOpportunity.sourceTokenSymbol} -> ${arbitrageOpportunity.destTokenSymbol}`
        );

        const [priceAmm, pricePriceFeed] = await this.getAmmAndPriceFeedPrices(arbitrageOpportunity);
        console.log('prices: amm: ', priceAmm.toFixed(5), ' pricefeed: ', pricePriceFeed.toFixed(5));

        const arbitragePercentage = await this.calculateArbitragePercentage(priceAmm, pricePriceFeed);
        console.log('arbitrage%', arbitragePercentage.toFixed(5));
        if(arbitragePercentage < conf.thresholdArbitrage) {
            console.log(`arbitrage too low for threshold ${conf.thresholdArbitrage}`);
            return;
        }

        const arbitrageTx = await this.executeArbitrage(arbitrageOpportunity, tokenSymbol, tokenAddress);
        if(arbitrageTx) {
            await this.handleSuccessfulArbitrage(arbitrageTx, arbitrageOpportunity, pricePriceFeed, arbitrageDeals);
        } else {
            console.warn('Arbitrage not executed.')
        }
        return arbitrageTx;
    }

    async findArbitrageOpportunityForToken(tokenSymbol, tokenAddress) {
        const rbtcAddress = conf.testTokenRBTC;
        const rbtcContract = C.contractTokenRBTC;
        const liquidityPool = await C.getLiquidityPoolByTokens(rbtcAddress, tokenAddress);
        const tokenContract = C.getTokenInstance(tokenAddress);

        const rbtcContractBalance = this.BN(await rbtcContract.methods.balanceOf(liquidityPool._address).call());
        const rbtcStakedBalance = this.BN(await liquidityPool.methods.reserveStakedBalance(rbtcAddress).call());
        const tokenContractBalance = this.BN(await tokenContract.methods.balanceOf(liquidityPool._address).call());
        const tokenStakedBalance = this.BN(await liquidityPool.methods.reserveStakedBalance(tokenAddress).call());

        const opportunity = calculateArbitrageOpportunity(
            rbtcAddress,
            rbtcContractBalance,
            rbtcStakedBalance,
            'rbtc',
            tokenAddress,
            tokenContractBalance,
            tokenStakedBalance,
            tokenSymbol,
            {
                log: true,
            }
        );

        if(opportunity) {
            // limit amount according to balance and/or config
            let arbitragerBalance;
            const fromAddress = A.arbitrage[0].adr;
            const sourceContract = C.getTokenInstance(opportunity.sourceTokenAddress);

            if(sourceContract._address === C.contractTokenRBTC._address) {
                // because of the RBTC wrapper proxy, we only care about RBTC balance and not WRBTC balance
                arbitragerBalance = this.BN(await C.web3.eth.getBalance(fromAddress));
                // Add some buffer for gas. Exact amount is up for debate...
                arbitragerBalance = arbitragerBalance.sub(this.BN(C.web3.utils.toWei('0.0001')));
            } else {
                arbitragerBalance = this.BN(await sourceContract.methods.balanceOf(fromAddress).call());
            }
            if(arbitragerBalance.isZero() || arbitragerBalance.isNeg()) {
                console.log('no balance held in wallet -- cannot do anything')
                return null;
            }

            let configMaxAmountWei = null;
            if(conf.dynamicArbitrageMaxAmounts) {
                const configMaxAmountStr = conf.dynamicArbitrageMaxAmounts[opportunity.sourceTokenSymbol] || conf.dynamicArbitrageMaxAmounts.default;
                if(configMaxAmountStr) {
                    configMaxAmountWei = this.BN(C.web3.utils.toWei(configMaxAmountStr));
                }
            }

            if(!configMaxAmountWei || arbitragerBalance.lt(configMaxAmountWei)) {
                // config max not specified or balance < config max
                if(opportunity.amount.gt(arbitragerBalance)) {
                    console.log(
                        `Limiting amount to held balance ${C.web3.utils.fromWei(arbitragerBalance)} ${opportunity.sourceTokenSymbol} ` +
                        `instead of ${C.web3.utils.fromWei(opportunity.amount)} ${opportunity.sourceTokenSymbol} `
                    );
                    opportunity.amount = arbitragerBalance;
                }
            } else if(opportunity.amount.gt(configMaxAmountWei)) {
                // config max amount specified and less than amount
                console.log(
                    `Limiting amount to max amount specified in config: ${C.web3.utils.fromWei(configMaxAmountWei)} ${opportunity.sourceTokenSymbol} ` +
                    `instead of ${C.web3.utils.fromWei(opportunity.amount)} ${opportunity.sourceTokenSymbol}`
                );
                opportunity.amount = configMaxAmountWei;
            }
        }

        return opportunity;
    }

    async getAmmAndPriceFeedPrices(arbitrageOpportunity) {
        const priceAmmWei = await this.getPriceFromAmm(
            C.contractSwaps,
            arbitrageOpportunity.sourceTokenAddress,
            arbitrageOpportunity.destTokenAddress,
            arbitrageOpportunity.amount
        );
        const pricePriceFeedWei = await this.getPriceFromPriceFeed(
            C.contractPriceFeed,
            arbitrageOpportunity.sourceTokenAddress,
            arbitrageOpportunity.destTokenAddress,
            arbitrageOpportunity.amount
        );
        if(priceAmmWei.isZero() || priceAmmWei.isNeg()) {
            throw new Error("Invalid AMM price: " + priceAmmWei.toString());
        }
        if(pricePriceFeedWei.isZero() || pricePriceFeedWei.isNeg()) {
            throw new Error("Invalid price feed price: " + pricePriceFeedWei.toString());
        }
        const priceAmm = parseFloat(C.web3.utils.fromWei(priceAmmWei, 'Ether'));
        const pricePriceFeed = parseFloat(C.web3.utils.fromWei(pricePriceFeedWei, 'Ether'));
        return [priceAmm, pricePriceFeed];
    }

    async calculateArbitragePercentage(priceAmm, pricePriceFeed) {
        // since we always calculate the price of the token we are selling, we must
        // always require that the amm price is higher than the price feed price
        return priceAmm / pricePriceFeed * 100 - 100;
    }

    async executeArbitrage(arbitrageOpportunity) {
        const fromAddress = A.arbitrage[0].adr;

        const sourceSymbol = arbitrageOpportunity.sourceTokenSymbol;
        const destSymbol = arbitrageOpportunity.destTokenSymbol;

        const amount = arbitrageOpportunity.amount;
        console.log(`EXECUTING ARBITRAGE! SELL ${C.web3.utils.fromWei(amount)} ${sourceSymbol}, BUY ${destSymbol}!`)

        // TODO: this should include minAmount to avoid race conditions
        return await this.swap(amount, sourceSymbol, destSymbol, fromAddress);
    }

    async handleSuccessfulArbitrage(arbitrageTx, arbitrageOpportunity, pricePriceFeed, arbitrageDeals) {
        if(arbitrageDeals) {
            arbitrageDeals.push({from: arbitrageOpportunity.sourceTokenSymbol, to: arbitrageOpportunity.destTokenSymbol});
        }

        let rbtcPrice, rbtcAmount;
        if(arbitrageOpportunity.sourceTokenAddress.toLowerCase() === conf.testTokenRBTC.toLowerCase()) {
            rbtcPrice = pricePriceFeed;
            rbtcAmount = parseFloat(C.web3.utils.fromWei(arbitrageOpportunity.amount));
        } else {
            // when selling tokenAmount TOKEN, pricePriceFeed is the amount of RBTC you get for tokenAmount TOKEN.
            // hence, rbtcPrice = tokenAmount and rbtcAmount = price feed price.
            rbtcPrice = parseFloat(C.web3.utils.fromWei(arbitrageOpportunity.amount));
            rbtcAmount = pricePriceFeed;
        }
        await this.calculateProfit(arbitrageTx, rbtcPrice, rbtcAmount);
    }

    async startFixedAmount(arbitrageDeals) {
        while (true) {
            console.log("started checking prices");

            let res, arb, profit;
            let prices = await this.getRBtcPrices();
            console.log(prices)

            for(let p in prices) {
                //set arb to the lower price in USD (prices are actually return values given for `amount` rbtc)
                if(prices[p][0]>0 && prices[p][1]>0) arb = this.calcArbitrage(prices[p][0], prices[p][1], p, conf.thresholdArbitrage);

                //the AMM price is lower -> buy BTC
                if (arb && (arb === parseFloat(prices[p][0]).toFixed(5))) {
                    let convertedAmount = C.web3.utils.toWei(prices[p][0].toString(), "Ether");
                    res = await this.swap(convertedAmount, p, 'rbtc');
                    arbitrageDeals.push({from: C.getTokenSymbol(p), to: 'rBTC'});
                }
                //the oracle price is lower -> sell btc
                else if (arb && (arb === parseFloat(prices[p][1]).toFixed(5))) {
                    res = await this.swap(C.web3.utils.toWei(conf.amountArbitrage.toString()), 'rbtc', p);
                    arbitrageDeals.push({from: 'rBTC', to: C.getTokenSymbol(p)});
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
    * Returns price in wei (BN)
    */
    getPriceFromPriceFeed(contract, sourceToken, destToken, amount) {
        return new Promise(async (resolve) => {
            try {
                contract.methods["queryReturn"](sourceToken, destToken, amount).call((error, result) => {
                    if (error) {
                        console.error("error loading price from " + contract._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                        console.error(error);
                        return resolve(this.BN('0'));
                    }
                    resolve(this.BN(result));
                });
            }
            catch (e) {
                console.error("error loading price from " + contract._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                console.error(e);
                resolve(this.BN('0'))
            }
        });
    }

    /**
     * Amount is based in sourceToken
     * Price need to be retrieven in 2 steps
     * 1. Call function conversionPath on to get the conversion path
     * 2. Call rateByPath assigning the conversion path and amount to get the actual price
     * Returns price in wei (BN)
     */
    getPriceFromAmm(contract, sourceToken, destToken, amount) {
        return new Promise(async (resolve) => {
            try {
                contract.methods["conversionPath"](sourceToken, destToken).call((error, result) => {
                    if (error) {
                        console.error("error loading conversion path 1 from " + contract._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                        console.error(error);
                        return resolve(this.BN('0'));
                    }

                    contract.methods["rateByPath"](result, amount).call((err, res) => {
                        if (err) {
                            console.error("error loading rate path from " + contract._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                            console.error(err);
                            return resolve(this.BN('0'));
                        }
                        resolve(this.BN(res));
                    });
                });
            }
            catch (e) {
                console.error("error loading price from " + contract._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                console.error(e);
                resolve(this.BN('0'))
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
                        .send({ from: beneficiary, gas: conf.gasLimit, gasPrice: gasPrice, value: val })
                        .then(async (tx) => {
                            const msg = `Arbitrage tx successful: traded ${C.web3.utils.fromWei(amount.toString(), 'Ether')} ${C.getTokenSymbol(sourceToken)} for ${C.getTokenSymbol(destToken)}
                                \n${conf.blockExplorer}tx/${tx.transactionHash}`;
                            console.log(msg);
                            common.telegramBot.sendMessage(`<b><u>A</u></b>\t\t\t\t ${conf.network}-${msg}`, Extra.HTML())

                            return resolve(tx);
                        })
                        .catch(async (err) => {
                            console.error("Error on arbitrage tx ");
                            console.error(err);
                            let explorerLink = '(not available)';
                            if(err.receipt) {
                                explorerLink = `${conf.blockExplorer}tx/${err.receipt.transactionHash}`;
                            }
                            common.telegramBot.sendMessage(
                                `<b><u>A</u></b>\t\t\t\t ⚠️<b>ERROR</b>⚠️\n Error on arbitrage tx swapping ${C.web3.utils.fromWei(amount.toString(), 'Ether')} ${sourceCurrency} for ${destCurrency}\n` +
                                `Transaction hash: ${explorerLink}`,
                                Extra.HTML()
                            );

                            return resolve();
                        });
                });
            }
            catch (e) {
                console.error("error loading price from " + contract2._address + " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount);
                console.error(e);
                const trade = destToken.toLowerCase() === conf.testTokenRBTC.toLowerCase() ? 'buy btc' : 'sell btc';
                console.log('Storing failed transaction into DB');
                // store failed transaction in DB
                await db.addArbitrage({
                    adr: address,
                    fromToken: sourceCurrency, 
                    toToken: destCurrency,
                    fromAmount: amount, trade,
                    status: 'failed'
                })
                resolve()
            }
        });

    }

    async calculateProfit(tx, btcPriceFeed, amount){
        try {
            if(!amount) {
                amount = conf.amountArbitrage;
            }
            console.log("Calculate profit from arbitrage");
            const receipt = await C.web3.eth.getTransactionReceipt(tx.transactionHash);
            console.log(receipt);

            if (receipt && receipt.logs) {
                const logs = abiDecoder.decodeLogs(receipt.logs);
                const conversionEvent = (logs || []).find(log => log && log.name === "Conversion");
                console.log(JSON.stringify(logs, null, 2));

                if (conversionEvent && conversionEvent.events) {
                    const priceFeed = Number(btcPriceFeed)/amount;
                    console.log(priceFeed)
                    let {fromToken, toToken, fromAmount, toAmount} = U.parseEventParams(conversionEvent.events);
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

                    console.log({
                        trader: receipt.from,
                        fromToken, toToken,
                        fromAmount, toAmount,
                        profit,
                        trade
                    })

                    await db.addArbitrage({
                        adr: receipt.from,
                        fromToken, toToken,
                        fromAmount, toAmount,
                        profit, trade,
                        txHash: tx.transactionHash,
                        status: 'successful'
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
