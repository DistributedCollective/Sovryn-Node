/**
 * Liquidation handler
 * If liquidation successful removes position from liquidation list
 * If it fails, check if the liquidation criteria are still met. 
 * If no, delete it from the liquidation list. If yes, send an error notification to a telegram groupfor manual processing. 
 * Todo: If the tx was not confirmed after some time (10 minutes), resend the transaction with a higher (double) gas fee.
 */

const TelegramBot = require('node-telegram-bot-api');
import C from './contract';
import A from '../secrets/accounts';
import U from '../util/helper';

class Liquidator {
    start(conf, liquidations) {
        this.conf=conf;
        this.telegramBotWatcher = new TelegramBot(conf.errorBotWatcherTelegramToken, { polling: false });
        this.liquidations = liquidations;
        this.checkPositionsForLiquidations();
    }

    /**
     * Wrapper for liquidations
     */
    async checkPositionsForLiquidations() {
        while (true) {
            console.log("started liquidation round at " + new Date(Date.now()));
            console.log(Object.keys(this.liquidations).length + " positions need to be liquidated");

            for (let p in this.liquidations) {
                const pos = this.liquidations[p];

                const liquidated = await this.liquidate(p, A.liquidator[0].adr, pos.maxLiquidatable);
                if (liquidated) delete this.liquidations[p];
                else {
                    console.error("error liquidating loan " + p);
                    console.error(pos);
                    const updatedLoan = await C.getPositionStatus(p)
                    if (updatedLoan.maxLiquidatable > 0) {
                        console.log("loan " + p + " should still be liquidated. Please check manually");
                        this.telegramBotWatcher.sendMessage(this.conf.sovrynInternalTelegramId, this.conf.network + "net-liquidation of loan " + p + " failed.");
                    }
                    delete this.liquidations[p];
                }

            }
            console.log("completed liquidation round at " + new Date(Date.now()));
            await U.wasteTime(this.conf.waitBetweenRounds);
        }
    }

    /*
    * Tries to liquidate a position
    */
    liquidate(loanId, receiver, amount) {
        return new Promise(async (resolve) => {
            console.log("trying to liquidate loan " + loanId);

            C.contractSovryn.methods.liquidate(loanId, receiver, amount)
                .send({ from: A.liquidator[0].adr, gas: 2500000 })
                .then(async (tx) => {
                    console.log("loan " + loanId + " liquidated!");
                    console.log(tx);
                    resolve(true);
                })
                .catch((err) => {
                    console.error("Error on liquidating loan " + loanId);
                    console.error(err);
                    resolve(false);
                });
        });
    }
}

export default new Liquidator();