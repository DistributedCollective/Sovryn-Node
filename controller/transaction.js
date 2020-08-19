/**
 * Transaction controller
 * Reads all open positions from the blockchain by quereing "active loans" in a loop. Stores open positions in a queue
 * Monitors every position on the loantoken contract and checks if positions are open or closed and if they need to be liquidated or not
 */

import Rsk3 from '@rsksmart/rsk3';
import Web3 from 'web3';
import abiComplete from '../config/abiComplete';
import U from '../util/helper';

class TransactionController {
    /**
     * Creates a Bzx contract intance to query current open positions
     */
    constructor() {
        this.rsk3 = new Rsk3(c.nodeProvider);
        this.web3 = new Web3(c.nodeProvider);
        this.contractBzx = new this.web3.eth.Contract(abiComplete, c.bzxProtocolAdr);
        
        this.positions = {};
    }

    /**
     * Start processing active loans and liquidation
     */
    async start() {
        const b = await this.rsk3.getBlockNumber();
        console.log("Connected to rsk " + c.network + "-network. Current block " + b);
        this.processActiveLoans();
        this.watchLiquidations();
    }

    /**
     * Wrapper for processing active loans
     * Start endless loop loading old trades faster and then start polling in 10s interval
     * todo: consider closed or liquidated loans change the size of active-loans
     * todo2: read all over again, loan-ids can change(mining)
     * solution: regularly query all open pos again. performance ??
     */
    async processActiveLoans() {
        console.log("Start processing active loans");

        let from = 0;
        let to = from + c.nrOfProcessingLoans;

        while (true) {
            const loans = await this.loadActiveLoans(from, to);
            if (loans) await this.addLoans(loans);

            if (loans.length > 0) {
                from = to;
                to = from + c.nrOfProcessingLoans;
                await U.wasteTime(1);
            }
            //reached current state
            else {
                from += loans.length;
                to = from + c.nrOfProcessingLoans;
                await U.wasteTime(10); //chance of missing a block?
            }
        }
    }

    /**
     * Loading active loans from the contract
     * check order (0-10 = first 10 or last 10??)
     */
    loadActiveLoans(from, to) {
        console.log("loading active loans from id " + from + " to " + to);
        let p = this;

        return new Promise(resolve => {
            p.contractBzx.methods.getActiveLoans(from, to, false).call((error, res) => {
                if (error) {
                    console.error("error receiving user loans");
                    console.error(error);
                    return resolve();
                }
                resolve(res)
            });
        });
    }

    /**
     * Adding new loans to the queue
     */
    addLoans(loans) {
        for (let l of loans) {
            if (!l.loanId) continue;
            if (!this.positions[l.loanId]) this.positions[l.loanId] = l;
            else console.log("found duplicate loan-id "+l.loanId);
        }
    }

    /**
     * Wrapper for position liquidating
     */
    async watchLiquidations() {
        while(true) {
            for (let p in this.positions) {
                let status = await this.getLoanStatus(this.positions[p].loanId);
                if(status==2) this.liquidate(this.positions[p].loanId);
                else if(status==0) delete this.positions[p];
            }
            console.log("completed liquidation watching round");
            await U.wasteTime(10);
        }
    }

    /*
    * liquidates a position
    * if successful: removes trade from list
    */
    liquidate(loanId) {
        console.log("liquidating loan "+loanId);
    }


    /**
     * Loads complete loan info from the Bzx contract
     * Returns loan status: 0 = inactive, 1 = active, 2 = need to be liquidated
     * Liquidation status means current margin <= maintenance margin
     * todo: check actual result of inactive loans
     */
    async getLoanStatus(loanId) {
        let p=this;

        return new Promise(resolve => {
            this.contractBzx.methods.getLoan(loanId).call((error, result) => {
                if (error) {
                    console.log(error);
                    return resolve(0);
                }

                console.log("checking loan "+loanId);
                //console.log(result);
                if (result.currentMargin && result.maintenanceMargin) {
                    let curr = p.web3.utils.fromWei(result.currentMargin, 'ether'); //returns margin in %
                    let mM = p.web3.utils.fromWei(result.maintenanceMargin, 'ether'); //returns margin in %
           
                    //console.log("current margin: " + curr);
                    //console.log("maintenance margin: " + mM);
                    if (curr <= mM) {
                        console.log("loan "+loanId+" need to be liquidated. Current margin ("+curr+") <= maintenanceMargin ("+mM+").");
                        return resolve(2);
                    }
                    resolve(1);
                }
            });
        });
    }


    /*
    * api methods
    */
    async getCurrentBlock() {
        const b = await this.rsk3.getBlockNumber();
        //console.log("block is " + b);
        return b;
    }
}

export default TransactionController;