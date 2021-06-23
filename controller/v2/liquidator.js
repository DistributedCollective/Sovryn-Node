/**
 * Liquidator V2 with Watcher contract.
 *
 * Quick and dirty implementation extending the existing Liquidator controller
 */

import C from '../contract';
import U from '../../util/helper';
import Wallet from '../wallet';
import conf from '../../config/config';
import common from '../common'
import Extra from 'telegraf/extra';
import {Liquidator} from "../liquidator";


class LiquidatorV2 extends Liquidator {
    // return [wallet so send liquidation from, balance available for liquidation]
    async getWallet(pos, token) {
        const requiredExecutorBalance = 0; // executor doesn't need any balance
        const [wallet] = await Wallet.getWallet("liquidator", requiredExecutorBalance, token, C.web3.utils.toBN);

        // return the watcher contract balance for checking
        const tokenContract = C.getTokenInstance(pos.loanToken);
        const watcherBalance = C.web3.utils.toBN(await tokenContract.methods.balanceOf(C.contractWatcher._address).call());
        return [wallet, watcherBalance]
    }

    // this is a silly fork to not mess up with gas costs
    async calculateLiquidateAmount(wBalance, pos, token, wallet) {
        const toBN = C.web3.utils.toBN;
        const BN = C.web3.utils.BN;
        const maxLiquidatable = toBN(pos.maxLiquidatable);
        let liquidateAmount = BN.min(maxLiquidatable, wBalance);
        const gasPrice = await C.getGasPrice();
        const executorRbtcBalance = toBN(await C.web3.eth.getBalance(wallet.adr));
        const txFees = toBN(conf.gasLimit).mul(toBN(gasPrice));

        if (txFees.gt(executorRbtcBalance)) {
            console.log("executor does not have enough RBTC balance on wallet to pay fees");
            return;
        } else if (maxLiquidatable.lt(wBalance)) {
            console.log("enough balance on wallet");
        } else if (wBalance.isZero()) {
            console.log("not enough balance on wallet");
            return;
        } else {
            if (liquidateAmount.lte(toBN('0'))) {
                console.log("not enough balance on wallet");
                return;
            }
            console.log("not enough balance on wallet. only use "+liquidateAmount.toString());
        }
        return liquidateAmount;
    }

    // also mostly a fork, but handle liquidation using Watcher V2 contract
    async liquidate(loanId, wallet, amount, token, nonce) {
        console.log("trying to liquidate loan " + loanId + " from wallet " + wallet + ", amount: " + amount);
        Wallet.addToQueue("liquidator", wallet, loanId);
        const isRbtcToken = (token.toLowerCase() === 'rbtc' || token.toLowerCase() === conf.testTokenRBTC.toLowerCase());
        console.log("Nonce: " + nonce);

        if (this.liquidations && Object.keys(this.liquidations).length > 0) {
            //delete position from liquidation queue, regardless of success or failure because in the latter case it gets added again anyway
            delete this.liquidations[loanId];
        }

        const p = this;
        const gasPrice = await C.getGasPrice();

        const pos = isRbtcToken ? 'long' : 'short';

        let tx;
        try {
            tx = await C.contractWatcher.methods.liquidate(loanId, amount.toString()).send({
                from: wallet,
                gas: conf.gasLimit,
                gasPrice: gasPrice,
                nonce: nonce,
            });
        } catch (err) {
            console.error("Error on liquidating loan " + loanId);
            console.error(err);

            let errorDetails;
            if(err.receipt) {
                errorDetails = `${conf.blockExplorer}tx/${err.receipt.transactionHash}`;
            } else {
                errorDetails = err.toString().slice(0, 200);
            }
            await common.telegramBot.sendMessage(
                `<b><u>L</u></b>\t\t\t\t ⚠️<b>ERROR</b>⚠️\n Error on liquidation tx: ${errorDetails}\n` +
                `LoanId: ${U.formatLoanId(loanId)}`,
                Extra.HTML()
            );
            await p.handleLiqError(wallet, loanId, amount, pos);
            return;
        }

        console.log("loan " + loanId + " liquidated!");
        console.log(tx.transactionHash);
        await p.handleLiqSuccess(wallet, loanId, tx.transactionHash, amount, token);
        await p.addLiqLog(tx.transactionHash, pos);
        // remove swapback for now since it doesn't work too well
        // TODO: this could be handled in the smartcontract!
        //if (!isRbtcToken) await p.swapBackAfterLiquidation(amount.toString(), token.toLowerCase(), collateralToken.toLowerCase(), wallet);
    }
}

export default new LiquidatorV2();
