/**
 * Wallet controller
 * Rsk currently only supports 4 simultaneos transactions per wallet. In order to avoid to use 4x more wallets a transaction queue is needed
 */

import conf from '../config/config';
import A from '../secrets/accounts';
import C from './contract';

class Wallet {
    constructor() {
        this.txFee = 1e14;

        let liquidationQueue = {};
        for (let liqWallet of A.liquidator)
            liquidationQueue[liqWallet.adr] = []

        let rolloverQueue = {};
        for (let rWallet of A.rollover)
            rolloverQueue[rWallet.adr] = []

        this.queue = {
            'liquidator': liquidationQueue,
            'rollover': rolloverQueue
        };
    }

    /**
     * Returns the next available wallet with sufficient funds (RBTC or token)
     * False if none could be found
     * @reqTokenBalance in wei
     * Careful: Consider decimals for tokens. Rbtc and Doc have 18
     */
    async getWallet(type, reqTokenBalance, token) {
        console.log("Checking wallet of type " + type + ", required token Balance: " + reqTokenBalance + ", for token: " + conf.tokensDictionary[token.toLowerCase()]);
        for (let wallet of A[type]) {
            if (this.queue[type][wallet.adr].length >= 4) continue;

            let wBalance;
            if (token === "rBtc") wBalance = await C.web3.eth.getBalance(wallet.adr);
            else wBalance = await C.getWalletTokenBalance(wallet.adr, token);

            if (parseFloat(wBalance) >= parseFloat(reqTokenBalance)) return [wallet, parseFloat(wBalance)];
        }

        //No wallet with enough funds found, return first one with balance > 0
        //todo: return the one with the highest balance
        for (let wallet of A[type]) {
            if (this.queue[type][wallet.adr].length >= 4) continue;

            let wBalance;
            if (token === "rBtc") wBalance = await C.web3.eth.getBalance(wallet.adr);
            else wBalance = await C.getWalletTokenBalance(wallet.adr, token);

            if (parseFloat(wBalance) >= 0) return [wallet, parseFloat(wBalance)];
        }

        //completely drained or busy or both
        return [null, null];
    }


    /**
     * adds a transaction to the queue
     * @param which either 'liq' or 'rol'
     * @param address the wallet address
     * @param loanId the loan Id
     */
    addToQueue(which, address, loanId) {
        this.queue[which][address].push(loanId);
    }

    checkIfPositionExists(loanId) {
        for(let p in this.queue["liquidator"]) {
            if(this.queue["liquidator"][p].indexOf(loanId)!=-1) return true;
        }
        return false;
    }

    /**
     * removes a transaction from the queue
     * @param which either 'liquidator' or 'rollover'
     * @param address the wallet address
     * @param loanId the loan Id
     */
    removeFromQueue(which, address, loanId) {
        console.log("Remove wallet "+address+" loanId "+loanId+" from queue");
        this.queue[which][address] = this.removeLoan(this.queue[which][address], loanId);
        console.log(this.queue[which][address]);
    }

    removeLoan(queue, loanId) {
        var index = queue.indexOf(loanId);
        if (index > -1) {
            queue.splice(index, 1);
        }
        return queue;
    }
}

export default new Wallet();
