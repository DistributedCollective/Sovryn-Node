/**
 * Bot opens and closes positions
 */
import Web3 from 'web3';
import conf from '../config/config';
import A from '../secrets/accounts';
import abiLoanToken from '../tests/abi/abiLoanToken';
import abiComplete from '../config/abiComplete';
import abiDocToken from "../config/abiTestToken";
const abiDecoder = require('abi-decoder');

var contractISUSD, contractIRBTC, contractSovryn, contractDocToken;

class TradeCtrl {
    constructor() {
        this.openPos = {
            "long": [],
            "short": []
        };
        abiDecoder.addABI(abiComplete);
        this.web3=new Web3(conf.nodeProvider);
    }

    async init() {
        console.log("init tradectrl");
        contractISUSD = new this.web3.eth.Contract(abiLoanToken.concat(abiComplete), conf.loanTokenSUSD);
        contractIRBTC = new this.web3.eth.Contract(abiLoanToken.concat(abiComplete), conf.loanTokenRBTC);
        contractSovryn = new this.web3.eth.Contract(abiComplete, conf.sovrynProtocolAdr);
        contractDocToken = new this.web3.eth.Contract(abiDocToken, conf.docToken);

        // Open long position with 0.0001 RBTC
        setInterval(async () => {
            await this.createShort(A.liquidator[0].adr.toLowerCase(), A.liquidator[0].pKey, (Math.random() * 0.001).toFixed(6), 4)       
        }, 30000)
    }

    async createLong(traderAdr, traderPKey, amount, leverage = 3) {
        this.web3.eth.accounts.wallet.add(traderPKey);
        let p = await this.openLongPosition(contractISUSD, amount.toString(), leverage.toString(), traderAdr.toLowerCase());
        console.log(p);
        this.openPos["long"].push(p);
        return p;
    }

    async createShort(traderAdr, traderPKey, amount, leverage = 3) {
        this.web3.eth.accounts.wallet.add(traderPKey);
        await contractDocToken.methods.approve(conf.loanTokenRBTC, (Number(amount)*(10**18)).toString()).send({from: traderAdr, gas: "50000"});
        let p = await this.openShortPosition(contractIRBTC, amount.toString(), leverage.toString(), traderAdr.toLowerCase());
        console.log(p);
        this.openPos["short"].push(p);
        return p;
    }

    async closePos(loanId, trader) {
        return await this.closePosition(contractSovryn, loanId, trader.toLowerCase(), trader.toLowerCase());
    }

    /*
    **************************************************************************
    ********************helpers***********************************************
    **************************************************************************
    */

    /**
     * Opens a long position on the loan token contract
     * @amount, @leverage = strings
     */
    async openLongPosition(contract, amount, leverage, from) {
        let p=this;
        return new Promise(async (resolve) => {
            console.log("send long tx with " + leverage + " leverage" + " deposit amount " + amount);
            const loanId = "0x0000000000000000000000000000000000000000000000000000000000000000"; // 0 if new loan
            const leverageAmount = p.web3.utils.toWei(leverage, 'ether');
            const loanTokenSent = 0;

            const collateralTokenSent = p.web3.utils.toWei(amount, 'ether');
            const loanDataBytes = "0x"; //need to be empty
            let t = await this.marginTrade(contract, loanId, leverageAmount, loanTokenSent, collateralTokenSent, conf.testTokenRBTC, from, loanDataBytes);
            resolve(t);
        });
    }


    /**
     * Opens a short position on the loan token contract
     * @amount, @leverage = strings
     */
    async openShortPosition(contract, amount, leverage, from) {
        let p=this;
        return new Promise(async (resolve) => {
            console.log("send short tx with " + leverage + " leverage" + " deposit amount " + amount);
            const loanId = "0x0000000000000000000000000000000000000000000000000000000000000000"; // 0 if new loan
            const leverageAmount = p.web3.utils.toWei(leverage, 'ether');
            const loanTokenSent = 0;

            const collateralTokenSent = p.web3.utils.toWei(amount, 'ether');
            const loanDataBytes = "0x"; //need to be empty
            let t = await this.marginTrade(contract, loanId, leverageAmount, loanTokenSent, collateralTokenSent, conf.docToken, from, loanDataBytes);
            resolve(t);
        });
    }

    async closePosition(contractToken, loanId, trader, receiver) {
        console.log("closing " + loanId + " from " + trader + " win goes to " + receiver);
        
        const gasPrice = await tihs.web3.eth.getGasPrice();
        //>100% collateral results in 100% of the position will be closed
        const collateral = this.web3.utils.toWei("10000", 'ether');
        const loanDataBytes = "0x"; //need to be empty
        const p = this;
        return new Promise(resolve => {
            //true = get paid back in collateral tokens (the one we have sent when opening the position)
            contractToken.methods.closeWithSwap(loanId, receiver, collateral, true, loanDataBytes)
                .send({ from: trader, gas: conf.gasLimit, gasPrice: gasPrice })
                .then(async (tx) => {
                    //console.log("close position Transaction: ");
                    //console.log(tx);
                    resolve(tx.transactionHash);
                })
                .catch((err) => {
                    console.error("Error on closing the position");
                    console.error(err);
                    resolve();
                });
        });
    }

    /**
     * Creates a margin trade on the loan token contract
     */
    async marginTrade(contractToken, loanId, leverageAmount, loanTokenSent, collateralTokenSent, testTokenAdr, trader, loanDataBytes) {
        const gasPrice = await this.web3.eth.getGasPrice();
        const val = testTokenAdr == conf.docToken ? 0 : collateralTokenSent;
        const p = this;

        return new Promise(resolve => {
            //collateral can be in SUSD or RBTC
            //it needs to be passed in the margin trade function either as loanTokenSent or collateralTokenSent depending on the iToken
            contractToken.methods.marginTrade(
                loanId,
                leverageAmount,
                loanTokenSent,
                collateralTokenSent,
                testTokenAdr, //in case of ISUSD the collateral is RBTC
                trader,
                loanDataBytes
            )
                .send({ from: trader, gas: conf.gasLimit, gasPrice: gasPrice, value: val })
                .then(async (tx) => {
                    //console.log("marginTrade Transaction: ");
                    //console.log(tx);
                    const loanId = await p.parseLog(tx.transactionHash);
                    console.log("Created position " + loanId)
                    resolve(loanId);
                })
                .catch((err) => {
                    console.error("Error on creating a trade");
                    console.error(err);
                    resolve();
                });
        });
    }

    /**
    * parse the marginTrade event log and returns the loan-id
    */
    parseLog(txHash) {
        console.log("parsing log for " + txHash);
        let p=this;
        return new Promise(resolve => {
            p.web3.eth.getTransactionReceipt(txHash, (e, receipt) => {
                if (e) {
                    console.error("Error parsing log");
                    console.log(e);
                    return resolve(0);
                }
                const decodedLogs = abiDecoder.decodeLogs(receipt.logs);

                for (let i = 0; i < decodedLogs.length; i++) {
                    //if(decodedLogs[i] && decodedLogs[i].events) console.log(decodedLogs[i].events)
                    if (decodedLogs[i] && decodedLogs[i].events && decodedLogs[i].name && decodedLogs[i].name == "Trade") {
                        return resolve(decodedLogs[i].events[2].value);
                    }
                }
                return resolve(0);
            });
        });
    }
}

const tradeController = new TradeCtrl();
tradeController.init()

//export default new TradeCtrl();
