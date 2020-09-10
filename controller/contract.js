/**
 * 
 * 
 */

import Web3 from 'web3';
import abiComplete from '../config/abiComplete';
import abiTestToken from '../config/abiTestToken';

class Contract {
    /**
     * Creates a Sovryn contract intance to query current open positions
     */
    init(conf) {
        this.web3 = new Web3(conf.nodeProvider);
        //this.web3.eth.accounts.wallet.add(A.liquidator[0].pKey);
        this.contractSovryn = new this.web3.eth.Contract(abiComplete, conf.sovrynProtocolAdr);
        this.contractTokenSUSD = new this.web3.eth.Contract(abiTestToken, conf.testTokenSUSD);
        this.contractTokenRBTC = new this.web3.eth.Contract(abiTestToken, conf.testTokenRBTC);
   }

    /**
     * Loads complete position info from the Sovryn contract
     */
    getPositionStatus(loanId) {
        let p = this;
        return new Promise(resolve => {
            try {
                p.contractSovryn.methods.getLoan(loanId).call((error, result) => {
                    if (error) {
                        console.error("error loading loan " + loanId);
                        console.error(error);
                        return resolve(false);
                    }
                    resolve(result);
                });
            }
            catch (e) {
                console.error("error on retrieving loan status for loan-id " + loanId);
                console.error(e);
                resolve(false)
            }
        });
    }

    /**
    * Tokenholder approves the loan token contract to spend tokens on his behalf
    * This is needed in order to be able to liquidate a position and should be executed once in the beginning
    * todo: add wallet to web3 first, gas and gasPrice is missing
    */
    approveToken(tokenCtr, from, receiver, amount) {
        return new Promise(resolve => {
            tokenCtr.methods.approve(receiver, amount)
                .send({ from: from })
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

export default new Contract();