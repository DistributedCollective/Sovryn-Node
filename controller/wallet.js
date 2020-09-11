/**
 * Wallet controller
 * Rsk currently only supports 4 simultaneos transactions per wallet
 */

import A from '../secrets/accounts';

class Wallet{
    constructor(){
        let liquidationQueue = {};
        for(let liqWallet of A.liquidator)
            liquidationQueue[liqWallet.adr] = []

        let rolloverQueue = {};
        for(let rWallet of A.rollover)
            rolloverQueue[rWallet.adr] = []

        this.queue = {
            'liq': liquidationQueue,
            'rol': rolloverQueue
        };
    }

    /**
     * 
     * returns the next available liquidation wallet. False if none could be found
     */
    getLiquidationWallet(){
        for(let wallet of A.liquidator){
            if(this.queue.liq[wallet.adr].length < 4)//todo check sufficient funds
                return wallet;
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

    /**
     * 
     * returns the next available rollover wallet. False if none could be found
     */
    getRolloverWallet(){
        for(let wallet of A.rollover){
            if(this.queue.rol[wallet.adr].length < 4)//todo check sufficient funds
                return wallet;
        }
        return false;
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