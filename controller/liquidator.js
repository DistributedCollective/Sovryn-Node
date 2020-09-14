/**
 * Liquidation handler
 * If liquidation successful removes position from liquidation list
 * If it fails, check if the liquidation criteria are still met. 
 * If no, delete it from the liquidation list. If yes, send an error notification to a telegram groupfor manual processing. 
 * Todo: If the tx was not confirmed after some time (10 minutes), resend the transaction with a higher (double) gas fee.
 */

const TelegramBot = require('node-telegram-bot-api');
import C from './contract';
import U from '../util/helper';
import Wallet from './wallet';

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
                const w = Wallet.getWallet("liquidator");
                let nonce = await C.web3.eth.getTransactionCount(w.adr, 'pending');
                this.liquidate(p, w.adr, pos.maxLiquidatable, nonce);                
            }
            console.log("Completed liquidation round at " + new Date(Date.now()));
            await U.wasteTime(this.conf.waitBetweenRounds);
        }
    }

    /*
    * Tries to liquidate a position
    */
    liquidate(loanId, wallet, receiver, amount, nonce) {
        console.log("trying to liquidate loan " + loanId);
        Wallet.addToQueue("liq", wallet, p);

        C.contractSovryn.methods.liquidate(loanId, receiver, amount)
            .send({ from: wallet, gas: 2500000, nonce:nonce })
            .then(async (tx) => {
                console.log("loan " + loanId + " liquidated!");
                console.log(tx);
                this.handleSuccess(wallet, loanId);
            })
            .catch((err) => {
                console.error("Error on liquidating loan " + loanId);
                console.error(err);
                
            });
    }

    handleSuccess(wallet, loanId){
        Wallet.removeFromQueue("liq", wallet, loanId);
        delete this.liquidations[loanId];
    }

    handleError(loanId){
        const updatedLoan = await C.getPositionStatus(loanId)
        if (updatedLoan.maxLiquidatable > 0) {
            console.log("loan " + p + " should still be liquidated. Please check manually");
            this.telegramBotWatcher.sendMessage(this.conf.sovrynInternalTelegramId, this.conf.network + "net-liquidation of loan " + p + " failed.");
        }
        delete this.liquidations[p];
    }
}

export default new Liquidator();