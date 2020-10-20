/**
 * 0. Define the amount for which we seek arbitrage. We start with the maximum trading amount, currently 105$.
 * This need to be improved after the trading limits were released.
 * Start an endless loop:
 * 1. Get the price from the amm. This returns the expected return form the Sovryn network.
 * 2. Get the price from the price feed contract. This returns the oracle price.
 * 3. Compare the prices. If the difference is >= 2% then sell 105$ of liquidity of the respective currency to the amm,
 * Inform the telegram group about a successful arbitrage trade and save statistic in db
 */

const Telegram = require('telegraf/telegram');
import C from './contract';
import U from '../util/helper';
import Wallet from './wallet';

class Arbitrage {
    init(conf){
        this.conf=conf;
        this.telegramBotWatcher = new Telegram(conf.errorBotWatcherTelegramToken);
        this.amount = 0.009; //105; todo: convert 105$ to current btc-price
    }

    /**
     * Wrapper for checking arbitrage opportunities
     * 1. Compare rBtc prices
     * 2. Compare Doc prices
     * 
     *  
buy the tokens which are too many
= take the one from bigger
     */
    async checkAmmForArbitrage() {
        while (true) {
            console.log("started checking prices at " + new Date(Date.now()));
           
            let p = await this.getRBtcPrices();
            let arb = this.calcArbitrage(p[0,p[1], this.conf.thresholdArbitrage]);
            if(arb==p[0]) this.sendRbtc(p[1]);
            else if(arb==p[1]) this.sendDoc(p[0]);

            console.log("Completed checking prices at " + new Date(Date.now()));
            await U.wasteTime(this.conf.arbitrageScanInterval);
        }
    }

    /**
     * If price difference between p1 and p2 >= threshold return Min(p1,p2)
     * else return 0
     */
    calcArbitrage(p1, p2, threshold){
        const smallerAmount = Math.min(p1,p2);
        if((Math.abs(p1-p2)/smallerAmount*100)>=threshold) return smallerAmount; 
        return 0; 
    }

    async getRBtcPrices(){
        const amount = C.web3.utils.toWei(this.amount.toString(), "Ether");
        let docPriceAmm = await this.getPriceFromAmm(C.contractSwaps, this.conf.testTokenRBTC, this.conf.docToken, amount);
        docPriceAmm = C.web3.utils.fromWei(docPriceAmm.toString(), "Ether");
        console.log("Doc Price amm: "+docPriceAmm);
        let docPricePf = await this.getPriceFromPriceFeed(C.contractPriceFeed, this.conf.testTokenRBTC, this.conf.docToken, amount);
        docPricePf = C.web3.utils.fromWei(docPricePf.toString(), "Ether");
        console.log("Doc Price pricefeed: "+docPricePf);
        return[docPriceAmm, docPricePf];
    }

    /**
    * Amount is based in sourceToken
    * Price need to be retrieven in 2 steps
    * 1. Call conversion path
    * 2. Call rateByPath
    * Returns price in wei
    */
    getPriceFromPriceFeed(contract, sourceToken, destToken, amount){
        return new Promise(async (resolve) => {
            try {
                contract.methods["queryReturn"](sourceToken, destToken, amount).call((error, result) => {
                    if (error) {
                        console.error("error loading price from "+contract._address+" for src "+sourceToken+", dest "+destToken+" and amount: "+amount);
                        console.error(error);
                        return resolve(0);
                    }
                    resolve(result);
                });
            }
            catch (e) {
                console.error("error loading price from "+contract._address+" for src "+sourceToken+", dest "+destToken+" and amount: "+amount);
                console.error(e);
                resolve(0)
            }
        });
    }

    /**
    * Amount is based in sourceToken
    * Returns price in wei
    */
   getPriceFromAmm(contract, sourceToken, destToken, amount){
    return new Promise(async (resolve) => {
        try {
            contract.methods["conversionPath"](sourceToken, destToken).call((error, result) => {
                if (error) {
                    console.error("error loading price from "+contract._address+" for src "+sourceToken+", dest "+destToken+" and amount: "+amount);
                    console.error(error);
                    return resolve(0);
                }

                contract.methods["rateByPath"](result, amount).call((err, res) => {
                    if (err) {
                        console.error("error loading price from "+contract._address+" for src "+sourceToken+", dest "+destToken+" and amount: "+amount);
                        console.error(err);
                        return resolve(0);
                    }
                    resolve(res);
                });
            });
        }
        catch (e) {
            console.error("error loading price from "+contract._address+" for src "+sourceToken+", dest "+destToken+" and amount: "+amount);
            console.error(e);
            resolve(0)
        }
    });
}


    
    sendDoc(){
        console.log("Sending Doc")
    }

    sendRBtc(){
        console.log("Sending RBtc")
    }

    convertOnMoc() {

    }
}

export default new Arbitrage();