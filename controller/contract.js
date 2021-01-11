/**
 * Provides a web3- and contract instance for the watcher modules
 */

import Web3 from 'web3';
import abiComplete from '../config/abiComplete';
import abiTestToken from '../config/abiTestToken';
import abiSwaps from '../config/abiSovrynSwapNetwork';
import abiPriceFeed from '../config/abiPriceFeed';
import abiRBTCWrapperProxy from '../config/abiRBTCWrapperProxy';
import conf from '../config/config';
import wallets from '../secrets/accounts';

class Contract {
    /**
     * Creates all the contract instances to query open positions, balances, prices
     */
    constructor() {
        this.web3 = new Web3(conf.nodeProvider);
        this.contractSovryn = new this.web3.eth.Contract(abiComplete, conf.sovrynProtocolAdr);

        this.contractTokenSUSD = new this.web3.eth.Contract(abiTestToken, conf.docToken);
        this.contractTokenRBTC = new this.web3.eth.Contract(abiTestToken, conf.testTokenRBTC);
        this.contractTokenUSDT = new this.web3.eth.Contract(abiTestToken, conf.USDTToken);
        this.contractTokenBPRO = new this.web3.eth.Contract(abiTestToken, conf.BProToken);
    
        this.contractSwaps = new this.web3.eth.Contract(abiSwaps, conf.swapsImpl);
        this.contractPriceFeed = new this.web3.eth.Contract(abiPriceFeed, conf.priceFeed);
        this.wRbtcWrapper = new this.web3.eth.Contract(abiRBTCWrapperProxy, conf.wRbtcWrapper);
        //Add wallets to web3, so they are ready for sending transactions
        for(let w in wallets) for (let a of wallets[w]) this.web3.eth.accounts.wallet.add(a.pKey);
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
        return new Promise(async resolve => {
            const gasPrice = await this.getGasPrice();
            tokenCtr.methods.approve(receiver, amount)
                .send({ from: from, gas:200000, gasPrice: gasPrice })
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
     * todo: add new token-checks
     */
    async completeWalletCheck(adr) {
        const balRbtc = await this.getWalletBalance(adr);
        if(balRbtc<=0) return false;
        //const balRbtcToken = await this.getWalletTokenBalance(adr, conf.testTokenRBTC);
        //if(balRbtcToken<=0) return false;
        const balDocToken = await this.getWalletTokenBalance(adr, conf.docToken);
        if(balDocToken<=0) return false;
        const allowanceDoc = await this.getWalletTokenAllowance(adr, conf.sovrynProtocolAdr, conf.docToken);
        if(allowanceDoc<=0) return false;
        //const alllowanceRbtc = await this.getWalletTokenAllowance(adr, conf.sovrynProtocolAdr, conf.testTokenRBTC);
        //if(alllowanceRbtc<=0) return false;
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
     * Returns the wallet token balance in wei
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
     * Returns the allowance for adr2 to spend tokens of address adr1
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
        if (adr && adr.toLowerCase() === conf.docToken.toLowerCase()) return this.contractTokenSUSD;
        else if (adr && adr.toLowerCase() === conf.testTokenRBTC.toLowerCase()) return this.contractTokenRBTC;
        else if (adr && adr.toLowerCase() === conf.USDTToken.toLowerCase()) return this.contractTokenUSDT;
        else if (adr && adr.toLowerCase() === conf.BProToken.toLowerCase()) return this.contractTokenBPRO;
        return false;
    }

    async getGasPrice() {
        const gasPrice = await this.web3.eth.getGasPrice();
        return Math.round(gasPrice * (100 + conf.gasPriceBuffer) / 100);
    }
}

export default new Contract();
