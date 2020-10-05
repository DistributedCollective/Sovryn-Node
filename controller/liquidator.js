/**
 * Liquidation handler
 * If liquidation successful removes position from liquidation list
 * If it fails, check if the liquidation criteria are still met. 
 * If no, delete it from the liquidation list. If yes, send an error notification to a telegram group for manual processing. 
 * 
 * todo: If the contract returns WRBTC when liquidating long positions -> swap the WRBTC For RBTC to avoid bankrupcy of the wallet
 * alternative: liquidate only with wrbtc
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
     * 1. Get wallet with enough funds in required tokens and not busy atm, then 
     * 2. Try to liquidate position
     */
    async checkPositionsForLiquidations() {
        while (true) {
            console.log("started liquidation round at " + new Date(Date.now()));
            console.log(Object.keys(this.liquidations).length + " positions need to be liquidated");

            for (let p in this.liquidations) {
                const pos = this.liquidations[p];
                //replace 0.001 with correct needed amount
                const w = await Wallet.getWallet("liquidator", 0.001, pos.maxLiquidatable, pos.loanToken);
                if(!w) return handleNoWalletError(p);
                const nonce = await C.web3.eth.getTransactionCount(w.adr, 'pending');
                const rBtc= pos.loanToken == this.conf.loanTokenRBTC? true:false;  //need to change later to wRBTC

                this.liquidate(p, w.adr, pos.maxLiquidatable, rBtc, nonce);
                await U.wasteTime(1); //1 second break to avoid rejection from node                
            }
            console.log("Completed liquidation round at " + new Date(Date.now()));
            await U.wasteTime(this.conf.waitBetweenRounds);
        }
    }

    /*
    * Tries to liquidate a position
    * If Loan token == WRBTC -> pass value
    */
    liquidate(loanId, wallet, receiver, amount, rBtc, nonce) {
        console.log("trying to liquidate loan " + loanId);
        Wallet.addToQueue("liquidator", wallet, loanId);
        const val = rBtc?amount:0;

        C.contractSovryn.methods.liquidate(loanId, receiver, amount)
            .send({ from: wallet, gas: 2500000, nonce:nonce, value:val })
            .then(async (tx) => {
                console.log("loan " + loanId + " liquidated!");
                console.log(tx);
                this.handleLiqSuccess(wallet, loanId);
            })
            .catch((err) => {
                console.error("Error on liquidating loan " + loanId);
                console.error(err);
                this.handleLiqError(loanId);
        });
    }

    handleLiqSuccess(wallet, loanId){
        Wallet.removeFromQueue("liquidator", wallet, loanId);
        delete this.liquidations[loanId];
    }

    async handleLiqError(loanId){
        const updatedLoan = await C.getPositionStatus(loanId)
        if (updatedLoan.maxLiquidatable > 0) {
            console.log("loan " + loanId + " should still be liquidated. Please check manually");
            this.telegramBotWatcher.sendMessage(this.conf.sovrynInternalTelegramId, this.conf.network + "net-liquidation of loan " + p + " failed.");
        }
        delete this.liquidations[p];
    }

    handleNoWalletError(loanId) {
        console.error("Liquidation of loan "+loanId+" failed because no wallet with enough funds was available");
        this.telegramBotWatcher.sendMessage(this.conf.sovrynInternalTelegramId, this.conf.network + "net-liquidation of loan " + p + " failed because no wallet with enough funds was found.");
        delete this.liquidations[loanId];
    }
}

export default new Liquidator();