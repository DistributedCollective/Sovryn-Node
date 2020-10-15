/**
 * Wallet controller
 * Rsk currently only supports 4 simultaneos transactions per wallet
 */

import A from '../secrets/accounts';
import C from './contract';

class Wallet{
    constructor(){
        this.txFee = 1e14;

        let liquidationQueue = {};
        for(let liqWallet of A.liquidator)
            liquidationQueue[liqWallet.adr] = []

        let rolloverQueue = {};
        for(let rWallet of A.rollover)
            rolloverQueue[rWallet.adr] = []

        this.queue = {
            'liquidator': liquidationQueue,
            'rollover': rolloverQueue
        };
    }

    /**
     * Returns the next available wallet with sufficient funds (RBTC and token)
     * False if none could be found
     * @reqTokenBalance in wei
     */
    async getWallet(type, reqTokenBalance, token){
        console.log("Checking wallet of type "+type+", required balance: "+reqBalance+", tokenBalance: "+reqTokenBalance+", for token: "+token);
        for(let wallet of A[type]){
            if(this.queue[type][wallet.adr].length < 4){

                let wBalance;
                if(token=="rBtc") wBalance = await C.web3.eth.getBalance(wallet.adr);
                else wBalance = await C.getWalletTokenBalance(wallet.adr, token);
                
                if(wBalance>=(reqTokenBalance+this.txFee)) return wallet;
            }
        }
        return false;
    }


    /**
     * adds a transaction to the queue
     * @param which either 'liq' or 'rol'
     * @param address the wallet address
     * @param loanId the loan Id
     */
    addToQueue(which, address, loanId){
        this.queue[which][address].push(loanId);
    }

    /**
     * removes a transaction from the queue
     * @param which either 'liq' or 'rol'
     * @param address the wallet address
     * @param loanId the loan Id
     */
    removeFromQueue(which, address, loanId){
        this.queue[which][address] = this.removeLoan(this.queue[which][address], loanId);
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