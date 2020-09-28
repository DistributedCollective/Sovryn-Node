/**
 * Wallet controller
 * Rsk currently only supports 4 simultaneos transactions per wallet
 */

import A from '../secrets/accounts';
import C from './contract';

class Wallet{
    constructor(){
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
     * Returns the next available liquidation/rollover wallet with sufficient funds (RBTC and token)
     * False if none could be found
     * todo: define min wallet balance for sending tx
     */
    async getWallet(type, reqBalance, reqTokenBalance, token){
        for(let wallet of A[type]){
            if(this.queue[type][wallet.adr].length < 4){

                let rBtcBal = await C.web3.eth.getBalance(wallet.adr);
                rBtcBal = C.web3.utils.fromWei(rBtcBal, "Ether");
                if(rBtcBal<=reqBalance) continue;
                if(type=="rollover") return wallet;
                if(!reqTokenBalance) return wallet;

                let bal = await C.getWalletTokenBalance(wallet.adr, token);
                bal=C.web3.utils.fromWei(bal, "Ether");
                if(bal>=reqTokenBalance) return wallet;
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
        this.queue[which][address] = removeLoan(this.queue[which][address], loanId);
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