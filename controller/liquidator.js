/**
 * Liquidation handler
 * If liquidation successful removes position from liquidation list
 * If it fails, check if the liquidation criteria are still met. 
 * If no, delete it from the liquidation list. If yes, send an error notification to a telegram group for manual processing. 
 * 
 * todo: If the contract returns WRBTC when liquidating long positions -> swap the WRBTC For RBTC to avoid bankrupcy of the wallet
 * alternative: liquidate only with wrbtc
 */

const Telegram = require('telegraf/telegram');
import C from './contract';
import U from '../util/helper';
import Wallet from './wallet';
import conf from '../config/config';

class Liquidator {
    constructor(){
        this.telegramBotWatcher = new Telegram(conf.errorBotTelegram);
    }
    
    start(liquidations) {
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
            console.log("started liquidation round");
            console.log(Object.keys(this.liquidations).length + " positions need to be liquidated");

            for (let p in this.liquidations) {
                const pos = this.liquidations[p];
                const token = pos.loanToken == conf.testTokenRBTC ? "rBtc" : pos.loanToken;

                //Position already in liquidation wallet-queue
                if (Wallet.checkIfPositionExists(p)) continue;

                const w = await Wallet.getWallet("liquidator", pos.maxLiquidatable, token);
                if (!w) {
                    this.handleNoWalletError(p);
                    continue;
                }
                const nonce = await C.web3.eth.getTransactionCount(w.adr, 'pending');

                this.liquidate(p, w.adr, pos.maxLiquidatable, pos.loanToken, nonce);
                await U.wasteTime(1); //1 second break to avoid rejection from node                
            }
            console.log("Completed liquidation round");
            await U.wasteTime(conf.liquidatorScanInterval);
        }
    }

    /*
    * Tries to liquidate a position
    * If Loan token == WRBTC -> pass value
    * wallet = sender and receiver address
    */
    liquidate(loanId, wallet, amount, token, nonce) {
        console.log("trying to liquidate loan " + loanId + " from wallet " + wallet+", amount: "+amount);
        Wallet.addToQueue("liquidator", wallet, loanId);
        const val = token=="rBtc"? amount : 0;
        console.log("Sending val: "+val);
        console.log("Nonce: "+nonce);

        const p=this;
        C.contractSovryn.methods.liquidate(loanId, wallet, amount)
            .send({ from: wallet, gas: 2500000, nonce: nonce, value: val })
            .then(async (tx) => {
                console.log("loan " + loanId + " liquidated!");
                console.log(tx.txHash);
                p.handleLiqSuccess(wallet, loanId, tx.transactionHash);
            })
            .catch((err) => {
                console.error("Error on liquidating loan " + loanId);
                console.error(err);
                p.handleLiqError(wallet, loanId);
        });
    }

    handleLiqSuccess(wallet, loanId, txHash) {
        Wallet.removeFromQueue("liquidator", wallet, loanId);
        delete this.liquidations[loanId];
        const msg = conf.network + "net-liquidation of loan " + loanId + " successful. \n " + txHash;
        this.telegramBotWatcher.sendMessage(conf.sovrynInternalTelegramId, msg);
    }

    /**
     * Possible errors: 
     * 1. Another user was faster -> position is already liquidated
     * 2. Btc price moved in opposite direction and the amount cannot be liquidated anymore
     */
    async handleLiqError(wallet, loanId) {
        Wallet.removeFromQueue("liquidator", wallet, loanId);
        const updatedLoan = await C.getPositionStatus(loanId)
        if (updatedLoan.maxLiquidatable > 0) {
            console.log("loan " + loanId + " should still be liquidated. Please check manually");
            this.telegramBotWatcher.sendMessage(conf.sovrynInternalTelegramId, conf.network + "net-liquidation of loan " + loanId + " failed.");
        }
        delete this.liquidations[loanId];
    }

    handleNoWalletError(loanId) {
        console.error("Liquidation of loan " + loanId + " failed because no wallet with enough funds was available");
        this.telegramBotWatcher.sendMessage(conf.sovrynInternalTelegramId, conf.network + "net-liquidation of loan " + loanId + " failed because no wallet with enough funds was found.");
        delete this.liquidations[loanId];
    }
}

export default new Liquidator();