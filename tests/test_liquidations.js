import c from '../config/config_testnet';
global.conf = c;
import abiComplete from '../config/abiComplete';
import abiLoanToken from '../config/abiLoanToken';
import abiTestToken from '../config/abiTestToken';
import abiPriceFeed from './abi/abiPriceFeed';

/**
 * 
 * Liquidation tester
 * todo: calc liquidation price 
 * 
 */

//only owner can change the price
import owner from '../secrets/account';
const abiDecoder = require('abi-decoder');
const assert = require('assert');

import TransactionController from '../controller/transaction';

const txCtrl = new TransactionController();
var contractISUSD, contractTokenSUSD, contractTokenRBTC, contractPriceFeed;
const adrPriceFeed = "0xf2e9fD37912aB53D0FEC1eaCE86d6A14346Fb6dD";

var loanIdHigh, loanIdLow;


describe('Liquidation', async () => {
    describe('#liquidate a position', async () => {
        before(() => {
            console.log("init");
            txCtrl.web3.eth.accounts.privateKeyToAccount(owner.pKey);
            contractISUSD = new txCtrl.web3.eth.Contract(abiLoanToken, conf.loanTokenSUSD);
            contractTokenSUSD = new txCtrl.web3.eth.Contract(abiTestToken, conf.testTokenSUSD);
            contractTokenRBTC = new txCtrl.web3.eth.Contract(abiTestToken, conf.testTokenRBTC);
            contractPriceFeed = new txCtrl.web3.eth.Contract(abiPriceFeed, adrPriceFeed);
            abiDecoder.addABI(abiComplete);
        });

        it('should set the start price for btc to 10000', async () => {
            let a = await changePrice(conf.testTokenRBTC, conf.testTokenSUSD, 10000);
            assert(a.length == 66);
        });

        //should return loan-id, remaining margin, maintenance margin
        it('should create a position with 2x leverage)', async () => {
            let p = await openLongPosition("0.01", "2");
            loanIdLow = await parseLog(p);
            assert(p.length == 66);
        });

        it('should create a position with 4x leverage)', async () => {
            let p = await openLongPosition("0.01", "4");
            loanIdHigh = await parseLog(p);
            assert(p.length == 66);
        });

        it('should read the status of the open positions', async () => {
            let statusLow = await txCtrl.getLoanStatus(loanIdLow);
            let statusHigh = await txCtrl.getLoanStatus(loanIdHigh);
            assert(statusLow, 1);
            assert(statusHigh, 1);
        });

        it('should change the rate at the price feed contract, so that remaining margin < maintenance of the high leverage position only', async () => {
            let a = await changePrice(conf.testTokenRBTC, conf.testTokenSUSD, 9500);
            assert(a.length == 66);
        });

        it('should read the status of the open positions again and make sure the high leverage position gets flagged for liquidation', async () => {
            let statusLow = await txCtrl.getLoanStatus(loanIdLow);
            let statusHigh = await txCtrl.getLoanStatus(loanIdHigh);
            assert(statusLow, 1);
            assert(statusHigh, 2);
        });

        it('should liquidate the high leverage position', async () => {
            let liquidated = await txCtrl.liquidate(loanIdHigh);
            assert(liquidated);
        });

        it('should fail to liquidate the low leverage position', async () => {
            let liquidated = await txCtrl.liquidate(loanIdHigh);
            assert(!liquidated);
        });

        it('should read the status of the open position again and make sure the low leverage position gets flagged for liquidation', async () => {
            let statusLow = await txCtrl.getLoanStatus(loanIdLow);
            assert(statusLow, 2);
        });

        it('should change the rate at the price feed contract, so that remaining margin < maintenance of the low leverage position', async () => {
            let a = await changePrice(conf.testTokenRBTC, conf.testTokenSUSD, 8000);
            assert(a.length == 66);
        });

        it('should liquidate the low leverage position', async () => {
            let liquidated = await txCtrl.liquidate(loanIdLow);
            assert(liquidated);
        });
    });
});




/*
**************************************************************************
********************helpers***********************************************
**************************************************************************
*/

/**
 * Opens a long position on the loan token contract 
 * @amount, @leverage = strings
 */
async function openLongPosition(amount, leverage) {
    return new Promise(async (resolve) => {
        console.log("send long tx with " + leverage + " leverage" + " deposit amount " + amount);
        const loanId = "0x0000000000000000000000000000000000000000000000000000000000000000"; // 0 if new loan
        const leverageAmount = txCtrl.web3.utils.toWei(leverage, 'ether');
        const loanTokenSent = 0;

        const collateralTokenSent = txCtrl.web3.utils.toWei(amount, 'ether');
        const loanDataBytes = "0x"; //need to be empty

        let a = await trxCtrl.approveToken(contractTokenRBTC, conf.loanTokenSUSD, collateralTokenSent);
        let t = await marginTrade(contractISUSD, loanId, leverageAmount, loanTokenSent, collateralTokenSent, conf.testTokenRBTC, owner.adr, loanDataBytes);
        resolve(t);
    });
}


/**
 * Creates a margin trade on the loan token contract
 */
function marginTrade(contractToken, loanId, leverageAmount, loanTokenSent, collateralTokenSent, testTokenAdr, trader, loanDataBytes) {
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
            .send({ from: owner.adr, gas: 2500000 })
            .then(async (tx) => {
                console.log("marginTrade Transaction: ");
                //console.log(tx);
                resolve(tx.transactionHash);
            })
            .catch((err) => {
                console.error("Error on creating a trade");
                console.error(err);
            });
    });
}




/*
* Change the conversion rate usd/btc on the contract (?)
* only owner
*/

function changePrice(srcToken, destToken, rate) {
    console.log("change price to " + rate);
    return new Promise(resolve => {
        contractPriceFeed.methods.setRates(srcToken, destToken, txCtrl.web3.utils.toWei(rate.toString(), 'Ether'))
            .send({ from: owner.adr })
            .then(async (tx) => {
                //console.log("change price Transaction: ", tx);
                resolve(tx.transactionHash);
            })
            .catch((err) => {
                console.error("Error on changing price");
                console.error(err);
            });
    });
}


/**
 * parse the marginTrade event log and returns the loan-id
 */
function parseLog(txHash) {
    console.log("parsing log");
    return new Promise(resolve => {
        txCtrl.web3.eth.getTransactionReceipt(txHash, function (e, receipt) {
            const decodedLogs = abiDecoder.decodeLogs(receipt.logs);
            //console.log(decodedLogs);

            for (let i = 0; i < decodedLogs.length; i++) {
                if (decodedLogs[i] && decodedLogs[i].events && decodedLogs[i].name && decodedLogs[i].name == "Trade") {
                    return resolve(decodedLogs[i].events[2].value);
                }
            }
        });
    });
}
