/**
 * Liquidation tester
 * The liquidator account need to have sufficient tokens approved to be able to liquidate the open positions
 * This tests only works with the old contracts where the price can be changed manually
 * 
 *  Set test/mainnet in file /config.config.js manually because mocha.js overwrites process.arg
 */

import conf from '../config/config';

import abiComplete from '../config/abiComplete';
import abiLoanToken from './abi/abiLoanToken';
import C from '../controller/contract';
import Liquidator from '../controller/liquidator';
import A from '../secrets/accounts';

const abiDecoder = require('abi-decoder');
const assert = require('assert');

var loanIdHigh, loanIdLow, loanHigh, loanLow;


describe('Liquidation', async () => {
    describe('#liquidate a position', async () => {
        before(async () => {
            console.log("init");
            abiDecoder.addABI(abiComplete);
            C.contractTokenSUSD = new C.web3.eth.Contract(abiLoanToken, conf.loanTokenSUSD); 
        });
         
        it('should set the start price for btc to 10000', async () => {
            let a = await changePrice(conf.testTokenRBTC, conf.docToken, 10000);
            assert(a.length == 66);
        });

        it('should create a position with 2x leverage)', async () => {
            let p = await openLongPosition("0.001", "2");
            loanIdLow = await parseLog(p);
            console.log("loan id low " + loanIdLow)
            assert(p.length == 66);
        });
        
        it('should create a position with 4x leverage)', async () => {
            let p = await openLongPosition("0.001", "4");
            loanIdHigh = await parseLog(p);
            console.log("loan id high " + loanIdHigh)
            assert(p.length == 66);
        });

        it('should read the status of the open positions', async () => {
            loanLow = await C.getPositionStatus(loanIdLow);
            loanHigh = await C.getPositionStatus(loanIdHigh);
            if (loanLow.loanToken == "0x0000000000000000000000000000000000000000" || loanHigh.loanToken == "0x0000000000000000000000000000000000000000") {
                console.log("loanId of loan changed");
                return assert(true);
            }
            assert(loanLow.maxLiquidatable == "0");
            assert(loanHigh.maxLiquidatable == "0");
        });

        it('should change the rate at the price feed contract, so that remaining margin < maintenance of the high leverage position only', async () => {
            //maxPriceMovement = 1 - (1 + maintenanceMargin) * leverage / (leverage + 1);
            if (loanLow.loanToken == "0x0000000000000000000000000000000000000000" || loanHigh.loanToken == "0x0000000000000000000000000000000000000000") {
                console.log("loanId of loan changed");
                return assert(true);
            }
            let maxPriceMovement = 1 - (1.15 * 4 / 5);
            let newPrice = 10000 * (1 - maxPriceMovement) - 1;
            console.log("setting the price to " + newPrice);
            let a = await changePrice(conf.testTokenRBTC, conf.docToken, newPrice);
            assert(a.length == 66);
        });

        it('should read the status of the open positions again and make sure the high leverage position is flagged for liquidation', async () => {
            loanLow = await C.getPositionStatus(loanIdLow);
            loanHigh = await C.getPositionStatus(loanIdHigh);
            if (loanLow.loanToken == "0x0000000000000000000000000000000000000000" || loanHigh.loanToken == "0x0000000000000000000000000000000000000000") {
                console.log("loanId of loan changed");
                return assert(true);
            }
            assert(loanLow.maxLiquidatable == "0");
            assert(parseInt(loanHigh.maxLiquidatable) > 0);
        });

        it('should fail to liquidate the low leverage position', async () => {
            if (loanLow.loanToken == "0x0000000000000000000000000000000000000000" || loanHigh.loanToken == "0x0000000000000000000000000000000000000000") {
                console.log("loanId of loan changed");
                return assert(true);
            }
            let liquidated = await Liquidator.liquidate(loanIdHigh, A.liquidator[0].adr, loanHigh.maxLiquidatable);
            assert(!liquidated);
        });

        it('should read the status of the open position again and make sure the low leverage position is flagged for liquidation', async () => {
            if (loanLow.loanToken == "0x0000000000000000000000000000000000000000" || loanHigh.loanToken == "0x0000000000000000000000000000000000000000") {
                console.log("loanId of loan changed");
                return assert(true);
            }
            let statusLow = await C.getPositionStatus(loanIdLow);
            assert(parseInt(statusLow.maxLiquidatable) > 0);
        });

        it('should change the rate at the price feed contract, so that remaining margin < maintenance of the low leverage position', async () => {
            if (loanLow.loanToken == "0x0000000000000000000000000000000000000000" || loanHigh.loanToken == "0x0000000000000000000000000000000000000000") {
                console.log("loanId of loan changed");
                return assert(true);
            }
            let a = await changePrice(conf.testTokenRBTC, conf.docToken, 8000);
            assert(a.length == 66);
        });

        it('should liquidate the low leverage position', async () => {
            if (loanLow.loanToken == "0x0000000000000000000000000000000000000000" || loanHigh.loanToken == "0x0000000000000000000000000000000000000000") {
                console.log("loanId of loan changed");
                return assert(true);
            }
            let liquidated = await Liquidator.liquidate(loanIdLow, A.liquidator[0].adr, loanLow.maxLiquidatable);
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
        const leverageAmount = C.web3.utils.toWei(leverage, 'ether');
        const loanTokenSent = 0;

        const collateralTokenSent = C.web3.utils.toWei(amount, 'ether');
        const loanDataBytes = "0x"; //need to be empty
        const from = A.liquidator[0].adr.toLowerCase();
        let t = await marginTrade(C.contractTokenSUSD, loanId, leverageAmount, loanTokenSent, collateralTokenSent, conf.testTokenRBTC, from, loanDataBytes);
        resolve(t);
    });
}


/**
 * Creates a margin trade on the loan token contract
 */
async function marginTrade(contractToken, loanId, leverageAmount, loanTokenSent, collateralTokenSent, testTokenAdr, trader, loanDataBytes) {
    const gasPrice = await C.web3.eth.getGasPrice();

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
            .send({ from: trader, gas: 2500000, gasPrice: gasPrice * 2 })
            .then(async (tx) => {
                //console.log("marginTrade Transaction: ");
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
* Change the conversion rate usd/btc on the pricefeed contract
* only owner, only on old contracts
*/
async function changePrice(srcToken, destToken, rate) {
    console.log("change price to " + rate);

    const gasPrice = await C.web3.eth.getGasPrice();

    return new Promise(resolve => {
        C.contractPriceFeed.methods.setRates(srcToken, destToken, C.web3.utils.toWei(rate.toString(), 'Ether'))
            .send({ from: A.owner[0].adr, gas: 2500000, gasPrice: gasPrice })
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

/*
function liquidate(loanId, wallet, amount) {
    C.contractSovryn.methods.liquidate(loanId, wallet, amount)
            .send({ from: wallet, gas: 2500000, value: val })
            .then(async (tx) => {
                console.log("loan " + loanId + " liquidated!");
                console.log(tx.txHash);
                this.handleLiqSuccess(wallet, loanId, tx.transactionHash);
            })
            .catch((err) => {
                console.error("Error on liquidating loan " + loanId);
                console.error(err);
                this.handleLiqError(loanId);
        });
}*/


/**
 * parse the marginTrade event log and returns the loan-id
 */
function parseLog(txHash) {
    console.log("parsing log");
    return new Promise(resolve => {
        C.web3.eth.getTransactionReceipt(txHash, function (e, receipt) {
            const decodedLogs = abiDecoder.decodeLogs(receipt.logs);

            for (let i = 0; i < decodedLogs.length; i++) {
                if (decodedLogs[i] && decodedLogs[i].events && decodedLogs[i].name && decodedLogs[i].name == "Trade") {
                    // console.log(decodedLogs[i].events); principal _> [6]
                    return resolve(decodedLogs[i].events[2].value);
                }
            }
        });
    });
}
