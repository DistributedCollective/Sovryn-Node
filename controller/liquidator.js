/**
 * Liquidation handler
 * If liquidation is successful removes position from liquidation list
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
import abiDecoder from 'abi-decoder';
import abiComplete from "../config/abiComplete";
import dbCtrl from './db';

class Liquidator {
    constructor() {
        this.telegramBotSovrynNode = new Telegram(conf.errorBotTelegram);
        this.liquidationErrorList=[];
        abiDecoder.addABI(abiComplete);
    }

    start(liquidations) {
        this.liquidations = liquidations;
        this.checkPositionsForLiquidations();
    }

    /**
     * Wrapper for liquidations
     * 1. Get a wallet with enough funds in required tokens and which is not busy at the moment, then
     * 2. Try to liquidate position
     */
    async checkPositionsForLiquidations() {
        while (true) {
            console.log("started liquidation round");
            console.log(Object.keys(this.liquidations).length + " positions need to be liquidated");

            for (let p in this.liquidations) {
                const pos = this.liquidations[p];
                const token = pos.loanToken === conf.testTokenRBTC ? "rBtc" : pos.loanToken;

                //Position already in liquidation wallet-queue
                if (Wallet.checkIfPositionExists(p)) continue;
                //failed too often -> have to check manually
                if(this.liquidationErrorList[p]>=5) continue;

                const [wallet, wBalance] = await Wallet.getWallet("liquidator", pos.maxLiquidatable, token);
                if (!wallet) {
                    await this.handleNoWalletError(p);
                    continue;
                } 
                const liquidateAmount = pos.maxLiquidatable<wBalance?pos.maxLiquidatable:wBalance;
                if(pos.maxLiquidatable<wBalance) console.log("enough balance on wallet");
                else if (wBalance === 0) { console.log("not enough balance on wallet"); return; }
                else console.log("not enough balance on wallet. only use "+wBalance);

                const nonce = await C.web3.eth.getTransactionCount(wallet.adr, 'pending');

                await this.liquidate(p, wallet.adr, liquidateAmount, token, nonce);
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
    async liquidate(loanId, wallet, amount, token, nonce) {
        console.log("trying to liquidate loan " + loanId + " from wallet " + wallet + ", amount: " + amount);
        Wallet.addToQueue("liquidator", wallet, loanId);
        const val = token === "rBtc" ? amount : 0;
        console.log("Sending val: " + val);
        console.log("Nonce: " + nonce);

        //delete position from liquidation queue, regardless of success or failure because in the latter case it gets added again anyway
        delete this.liquidations[loanId];

        const p = this;
        const gasPrice = await C.getGasPrice();
        C.contractSovryn.methods.liquidate(loanId, wallet, amount.toString())
            .send({ from: wallet, gas: 2500000, gasPrice: gasPrice, nonce: nonce, value: val })
            .then(async (tx) => {
                console.log("loan " + loanId + " liquidated!");
                console.log(tx.transactionHash);
                await p.handleLiqSuccess(wallet, loanId, tx.transactionHash);
                p.addLiqLog(tx.transactionHash);
            })
            .catch(async (err) => {
                console.error("Error on liquidating loan " + loanId);
                console.error(err);
                await p.handleLiqError(wallet, loanId);
            });
    }

    async handleLiqSuccess(wallet, loanId, txHash) {
        Wallet.removeFromQueue("liquidator", wallet, loanId);
        this.liquidationErrorList[loanId]=null;
        const msg = conf.network + "net-liquidation of loan " + loanId + " successful. \n " + txHash;
        await this.telegramBotSovrynNode.sendMessage(conf.sovrynInternalTelegramId, msg);
    }

    /**
     * Possible errors:
     * 1. Another user was faster -> position is already liquidated
     * 2. Btc price moved in opposite direction and the amount cannot be liquidated anymore
     */
    async handleLiqError(wallet, loanId) {
        Wallet.removeFromQueue("liquidator", wallet, loanId);
        if(!this.liquidationErrorList[loanId]) this.liquidationErrorList[loanId]=1;
        else this.liquidationErrorList[loanId]++;

        const updatedLoan = await C.getPositionStatus(loanId)
        if (updatedLoan.maxLiquidatable > 0) {
            console.log("loan " + loanId + " should still be liquidated. Please check manually");
            await this.telegramBotSovrynNode.sendMessage(conf.sovrynInternalTelegramId, conf.network + "net-liquidation of loan " + loanId + " failed.");
        }
    }

    async handleNoWalletError(loanId) {
        console.error("Liquidation of loan " + loanId + " failed because no wallet with enough funds was available");
        await this.telegramBotSovrynNode.sendMessage(conf.sovrynInternalTelegramId, conf.network + "net-liquidation of loan " + loanId + " failed because no wallet with enough funds was found.");
    }

    async addLiqLog(txHash) {
        console.log("Add liquidation "+txHash+" to db");
        try {
            const receipt = await C.web3.eth.getTransactionReceipt(txHash);
            
            if (receipt && receipt.logs) {
                const logs = abiDecoder.decodeLogs(receipt.logs) || [];
                const liqEvent = logs.find(log => log && log.name === 'Liquidate');
                console.log(liqEvent)
                const {
                    user, liquidator, loanId, loanToken, collateralToken, collateralWithdrawAmount
                } = U.parseEventParams(liqEvent && liqEvent.events);

                console.log(user);
                console.log(liquidator);
                console.log(loanId)

                if (user && liquidator && loanId) {
                    console.log("user found");
                    console.log(user);
                    console.log(liquidator);
                    console.log(loanId);
                    const path = await C.contractSwaps.methods['conversionPath'](collateralToken, loanToken).call();
                    const numberOfHops = loanToken === "rbtc" ? 3 : 5

                    if (!path || path.length !== numberOfHops) return;

                    const balBefore = await C.getWalletTokenBalance(liquidator, loanToken);
                    const affiliateAcc = "0x0000000000000000000000000000000000000000";
                    const gasPrice = await C.getGasPrice();
                    const approved = await C.approveToken(C.getTokenInstance(collateralToken), liquidator, conf.swapsImpl, collateralWithdrawAmount);
                    const swapTx = await C.contractSwaps.methods['convertByPath'](path, collateralWithdrawAmount, 1, liquidator, affiliateAcc, 0).send({
                        from: liquidator,
                        gas: 2500000,
                        gasPrice: gasPrice
                    });

                    const balAfter = await C.getWalletTokenBalance(liquidator, loanToken);
                    const profit = parseFloat(balAfter) - parseFloat(balBefore);
                    //wrong -> update
                    const pos = loanToken.toLowerCase() === conf.testTokenRBTC.toLowerCase() ? 'long' : 'short';

                    const addedLog = await dbCtrl.addLiquidate({
                        liquidatorAdr: liquidator,
                        liquidatedAdr: user,
                        amount: collateralWithdrawAmount,
                        pos: pos,
                        loanId: loanId,
                        profit: profit,
                        txHash: txHash
                    });
                    return addedLog;
                }
            }

        } catch (e) {
            console.error(e);
        }
    }
}

export default new Liquidator();
