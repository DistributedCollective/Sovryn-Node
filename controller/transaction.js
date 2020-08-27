/**
 * Transaction controller
 * Reads all open positions from the blockchain by quereing "active loans" in a loop. Stores open positions in a queue "positions" and
 * positions flagged for liquidation in "liquidations".
 * Monitors every position on the loantoken contract and checks if it is still open and if it needs to be liquidated or not.
 * 
 * It is necessary to re-read from position 0 on every run because the position of open positions can change on the contract.
 * Poosible optimization: parse the event logs after reaching current state instead of quering of "getActiveLoans".
 *  
 * todo: consider partly liquidated positions
 * 
 */

import Web3 from 'web3';
import abiComplete from '../config/abiComplete';
import abiTestToken from '../config/abiTestToken';
import owner from '../secrets/account';
import U from '../util/helper';

class TransactionController {
    /**
     * Creates a Bzx contract intance to query current open positions
     */
    constructor() {
        this.web3 = new Web3(conf.nodeProvider);
        this.web3.eth.accounts.privateKeyToAccount(owner.pKey);
        this.contractBzx = new this.web3.eth.Contract(abiComplete, conf.bzxProtocolAdr);
        this.contractTokenSUSD = new this.web3.eth.Contract(abiTestToken, conf.testTokenSUSD);
        this.contractTokenRBTC = new this.web3.eth.Contract(abiTestToken, conf.testTokenRBTC);
        this.positions = {};
        this.liquidations = {};
    }


    /**
     * Start processing active loans and liquidation
     */
    async start() {
        const b = await this.web3.eth.getBlockNumber();
        console.log("Connected to rsk " + conf.network + "-network. Current block " + b);
        this.processActiveLoans();
        this.checkPositions();
    }

    /**
     * Wrapper for processing active loans
     * Start endless loop by loading all open positions from the contract until the end is reached, then start from scratch
     * This is because trades in the list can be replaced with trades from another position
     * 
     * The performance of this overhead need to be tested and optimized if needed
     * Known issues: new open positions can have a wrong LoanId
     */
    async processActiveLoans() {
        console.log("Start processing active loans");

        let from = 0;
        let to = conf.nrOfProcessingLoans;

        while (true) {
            const pos = await this.loadActivePositions(from, to);
            if (pos) this.addPosition(pos);
            console.log(pos.length+" positions found");

            if (pos.length > 0) {
                from = to;
                to = from + conf.nrOfProcessingPositions;
                await U.wasteTime(1);
            }
            //reached current state
            else {
                await U.wasteTime(conf.waitBetweenRounds);
                from = 0;
                to = conf.nrOfProcessingLoans;
                this.positions={};
            }
        }
    }

    /**
     * Loading active positions from the contract
     * check order (0-10 = first 10 or last 10??)
     */
    loadActivePosition(from, to) {
        console.log("loading active positions from id " + from + " to " + to);
        let p = this;

        return new Promise(resolve => {
            try {
                p.contractBzx.methods.getActiveLoans(from, to, false).call((error, res) => {
                    if (error) {
                        console.error("error receiving user loans");
                        console.error(error);
                        return resolve();
                    }
                    resolve(res)
                });
            }
            catch(e){
                console.error("error on retrieving active loans");
                console.error(e);
                resolve([]);
            }
        });
    }

    /**
     * Adding new positions to the positions queue, 
     * positions ready for liquidation to the liquidations queue
     */
    addPosition(loans) {
        for (let l of loans) {
            if (!l.loanId) continue;

            if (!this.positions[l.loanId]) {
                this.positions[l.loanId] = l;

                if (this.getLoanStatus(this.positions[p])) this.liquidations[p] = this.positions[p];
            }
            else console.log("found duplicate loan-id " + l.loanId);
        }
    }

    /**
     * Wrapper for position liquidating
     */
    async checkPositions() {
        for (let p in this.positions) {
            if (this.getLoanStatus(this.positions[p])) {
                this.liquidations[p] = this.positions[p];
                const liquidated = await this.liquidate(p, owner.adr, this.positions[p].principal);
                //todo error handling
            }
        }
        console.log("completed liquidation watching round at " + new Date(Date.now()));
    }

    /*
    * liquidates a position
    * if successful: removes position from liquidation list
    */
    liquidate(loanId, receiver, amount) {
        let p = this;
        return new Promise(async (resolve) => {
            console.log("trying to liquidate loan " + loanId);

            /*
            //wallet should have approved already enough tokens 
            let contract = p.getTokenInstance(this.positions[loanId].loanToken);
            let approved;
            try {
                approved = await this.approveToken(contract, conf.bzxProtocolAdr, this.positions[loanId].principal);
                if (!approved) {
                    console.error("error on approving tokens for loan " + loanId);
                    //todo: error handling
                    return resolve(false);
                }
            }
            catch(e){
                console.error("error on approving token for loan "+loanId);
                console.error(e);
                return resolve(false);
            }
            */
            
            try {
                p.contractBzx.methods.liquidate(loanId, receiver, amount)
                .send({ from: owner.adr, gas: 2500000 })
                .then(async (tx) => {
                    console.log("loan " + loanId + " liquidated!");
                    console.log(tx);
                    resolve(true);
                })
                .catch((err) => {
                    console.error("Error on liquidating loan " + loanId);
                    console.error(err);
                    //todo: error handling
                    resolve(false);
                });
            }
            catch(e){
                console.error("error on liquidating loan "+loanId);
                console.error(e);
                resolve(false);
            }
        });
    }

    /**
     * Returns loan status true if it needs to be liquidated, false otherwise
     * Liquidation status means current margin <= maintenance margin
     */
    async getLoanStatus(loan) {
        if (loan.currentMargin && loan.maintenanceMargin) {
            const curr = p.web3.utils.fromWei(loan.currentMargin, 'ether'); //returns margin in %
            const mM = p.web3.utils.fromWei(loan.maintenanceMargin, 'ether'); //returns margin in %

            //console.log("current margin: " + curr);
            //console.log("maintenance margin: " + mM);
            if (curr <= mM) {
                console.log("loan " + loan.loanId + " needs to be liquidated. Current margin (" + curr + ") <= maintenanceMargin (" + mM + ").");
                return true;
            }
        }
        return false;
    }

    /**
    * Tokenholder approves the loan token contract to spend tokens on his behalf
    * This is needed in order to be able to liquidate a position
    */
    approveToken(tokenCtr, receiver, amount) {
        return new Promise(resolve => {
            tokenCtr.methods.approve(receiver, amount)
                .send({ from: owner.adr })
                .then((tx) => {
                    console.log("Approved Transaction: ");
                    //console.log(tx);
                    if (tx.transactionHash) resolve(tx.transactionHash);
                    else resolve();
                });
        });
    }

    /**
     * helper function
     */
    getTokenInstance(adr) {
        if (adr == conf.testTokenSUSD) return this.contractTokenSUSD;
        else if (adr == conf.testTokenRBTC) return this.contractTokenRBTC;
    }
}

export default TransactionController;