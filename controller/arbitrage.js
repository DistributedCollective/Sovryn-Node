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
        this.amount = 0.28; //105; todo: 
    }

    start() {
        this.checkAmmForArbitrage();
    }

    /**
     * Wrapper for checking arbitrage opportunities
     * 1. Compare rBtc prices
     * 2. Compare Doc prices
     */
    async checkAmmForArbtrage() {
        while (true) {
            console.log("started checking prices at " + new Date(Date.now()));
           
            let p = await this.getDocPrices();

            console.log("Completed checking prices at " + new Date(Date.now()));
            await U.wasteTime(this.conf.arbitrageScanInterval);
        }
    }

    async getDocPrices(){
        const amount = C.web3.utils.toWei(this.amount.toString(), "Ether");
        let docPriceAmm = await this.getPriceFromContract(C.contractSwaps, "internalExpectedRate", this.conf.testTokenRBTC, this.conf.docToken, amount);
        console.log("Doc Price amm: "+docPriceAmm);
        let docPricePf = await this.getPriceFromContract(C.contractPriceFeed, "queryReturn", this.conf.testTokenRBTC, this.conf.docToken, amount);
        console.log("Doc Price pricefeed: "+docPricePf);
        return[0, docPricePf];
    }


    /**
    * Amount is based in sourceToken
    * Returns price in wei
    */
    getPriceFromContract(contract, method, sourceToken, destToken, amount){
        return new Promise(async (resolve) => {
            try {
                contract.methods[method](sourceToken, destToken, amount).call((error, result) => {
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
    
}

export default new Arbitrage();