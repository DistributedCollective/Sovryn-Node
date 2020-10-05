/**
 * Provides a web3- and contract instance for the Liquidation handler and rollover controllers 
 */

import Web3 from 'web3';
import abiComplete from '../config/abiComplete';
import abiTestToken from '../config/abiTestToken';

class Contract {
    /**
     * Creates all the contract intances to query open positions, balances
     */
    init(conf) {
        this.conf=conf;
        this.web3 = new Web3(conf.nodeProvider);
        this.contractSovryn = new this.web3.eth.Contract(abiComplete, conf.sovrynProtocolAdr);
        this.contractTokenSUSD = new this.web3.eth.Contract(abiTestToken, conf.docToken); 
        this.contractTokenRBTC = new this.web3.eth.Contract(abiTestToken, conf.testTokenRBTC);
   }

   /**
   * Add wallets to web3, so they are ready for sending transactions
   */
   addWallets(wallets) {
       for(let w of wallets) this.web3.eth.accounts.wallet.add(w.pKey);
       return;
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
    */
    approveToken(tokenCtr, from, receiver, amount) {
        return new Promise(resolve => {
            tokenCtr.methods.approve(receiver, amount)
                .send({ from: from, gas:200000 })
                .then((tx) => {
                    console.log("Approved Transaction: ");
                    //console.log(tx);
                    if (tx.transactionHash) resolve(tx.transactionHash);
                    else resolve();
                });
        });
    }

    /**
     * Returns wheter a wallet is ready to be used as liquidator
     * todo: add correct threshold of balances
     */
    async completeWalletCheck(adr) {
        const balRbtc = await this.getWalletBalance(adr);
        if(balRbtc<=0) return false;
        //const balRbtcToken = await this.getWalletTokenBalance(adr, this.conf.testTokenRBTC);
        //if(balRbtcToken<=0) return false;
        const balDocToken = await this.getWalletTokenBalance(adr, this.conf.docToken);
        if(balDocToken<=0) return false;
        const allowanceDoc = await this.getWalletTokenAllowance(adr, this.conf.sovrynProtocolAdr, this.conf.docToken);
        if(allowanceDoc<=0) return false;
        const alllowanceRbtc = await this.getWalletTokenAllowance(adr, this.conf.sovrynProtocolAdr, this.conf.testTokenRBTC);
        if(alllowanceRbtc<=0) return false;
        return true;
    }

    /**
     * Return the wallet RBtc balance
     */
    async getWalletBalance(adr) {
        let bal = await this.web3.eth.getBalance(adr);
        bal = this.web3.utils.fromWei(bal, 'Ether');
        return bal;
    }

    /**
     * Returns the wallet token balance
     */
    getWalletTokenBalance(adr, token) {
        const tokenCtr = this.getTokenInstance(token);

        return new Promise(async (resolve) => {
            try {
                tokenCtr.methods.balanceOf(adr).call((error, result) => {
                    if (error) {
                        console.error("error loading wallet token balance "+adr);
                        console.error(error);
                        return resolve(false);
                    }

                    //let bal = this.web3.utils.fromWei(result, 'Ether');
                    resolve(result);
                });
            }
            catch (e) {
                console.error("error on retrieving wallet status for  "+adr);
                console.error(e);
                resolve(false)
            }
        });
    }

    /**
     * Returns the allowance of token for address
     */
    getWalletTokenAllowance(adr1, adr2, token) {
        const tokenCtr = this.getTokenInstance(token);

        return new Promise(async (resolve) => {
            try {
                tokenCtr.methods.allowance(adr1, adr2).call((error, result) => {
                    if (error) {
                        console.error("error loading allowance "+adr);
                        console.error(error);
                        return resolve(false);
                    }

                    let bal = this.web3.utils.fromWei(result, 'Ether');
                    resolve(bal);
                });
            }
            catch (e) {
                console.error("error on retrieving allowance for  "+adr);
                console.error(e);
                resolve(false)
            }
        });
    }


    /**
     * helper function
     */
    getTokenInstance(adr) {
        if (adr == this.conf.docToken) return this.contractTokenSUSD;
        else if (adr == this.conf.testTokenRBTC) return this.contractTokenRBTC;
    }
}

export default new Contract();