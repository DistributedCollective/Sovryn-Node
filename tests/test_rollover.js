import c from '../config/config_testnet';
global.conf = c;
import abiComplete from '../config/abiComplete';
import abiLoanToken from '../config/abiLoanToken';
import A from '../secrets/accounts';

/**
 * Contract tester
*/
const assert = require('assert');
import TransactionController from '../controller/transaction';
const abiDecoder = require('abi-decoder');
abiDecoder.addABI(abiComplete);

const txCtrl = new TransactionController();
const contractISUSD = new txCtrl.web3.eth.Contract(abiLoanToken, c.loanTokenSUSD);
var requiredC=0;
var loanId="";

describe('Contract', async () => {
    describe('#rollover', async () => {
        
        it('should return required collateral for a loan', async () => {
            const withdrawAmount = txCtrl.web3.utils.toWei("10", 'ether');
            const marginAmount = txCtrl.web3.utils.toWei("50", 'ether');
            const rC = await getRequiredCollateral(conf.testTokenSUSD, conf.testTokenRBTC, withdrawAmount, marginAmount);
            console.log("required collateral "+txCtrl.web3.utils.fromWei(rC, 'ether'));
            requiredC=rC;
            assert(rC>0);
        });    

        /*
        //just for curiosity 
        it('should return avg interest rate', async () => {
            const withdrawAmount = txCtrl.web3.utils.toWei("10", 'ether');
            const intRate = await getAvgInterestRate(withdrawAmount);
            console.log("interest rate is ");
            console.log(intRate);
            assert(true);
        }); */  
        
        
        it('should borrow 10 usd from the contract', async () => {
            const withdrawAmount = txCtrl.web3.utils.toWei("10", 'ether');
            const b = await borrow(requiredC, withdrawAmount, conf.testTokenRBTC, A.owner.adr, A.liquidator.adr);
            loanId = await parseLog(b);
            console.log("Borrowing successful. Loan-id: "+loanId);
            assert(b.length==66);
        });    

        //the position need to be expired (min time = 24h)
        it('should rollover an existing loan', async () => {
            const loanDataBytes = "0x"; //need to be empty
            const r = await rollover(loanId, loanDataBytes);
            console.log(r);
            assert(r.length==66);
        });
    });
});




/*
**************************************************************************
********************helpers***********************************************
**************************************************************************
*/


function getRequiredCollateral(loanToken, collateralToken, principal, marginAmount) {
    return new Promise(async (resolve) => {
        try {
            //loanToken, collateralToken, principal, marginAmount, isTorqueLoan
            txCtrl.contractSovryn.methods.getRequiredCollateral(loanToken, collateralToken, principal, marginAmount, true).call((error, result) => {
                if (error) {
                    console.error("error loading required collateral "+loanId);
                    console.error(error);
                    return resolve(false);
                }
                resolve(result);
            });
        }
        catch (e) {
            console.error("error on retrieving required collateral");
            console.error(e);
            resolve(false)
        }
    });
}



/**
 * Borrows from the ISUD contract
 */
function borrow(collateralTokenSent, withdrawAmount, collateralTokenAddress, adrBorrower, adrReceiver) {
    return new Promise(async (resolve) => {
        const loanId = "0x0000000000000000000000000000000000000000000000000000000000000000"; // 0 if new loan
        const durationInSeconds = 60*60*24;
        const loanDataBytes = "0x"; //need to be empty

        contractISUSD.methods.borrow(
            loanId, 
            withdrawAmount,
            durationInSeconds, 
            collateralTokenSent, 
            collateralTokenAddress, 
            adrBorrower.toLowerCase(), 
            adrReceiver.toLowerCase(), 
            loanDataBytes
            )
            .send({ from: A.owner.adr, gas: 2500000 })
            .then((tx) => {
                console.log("borrow Transaction: ");
                console.log(tx);
                resolve(tx.transactionHash);
            })
            .catch((err) => {
                console.error("Error in borrowing from the contract");
                console.error(err);
            });
    });
}



/**
 * Extend deadline for open position (loan or trade)
 */
function rollover(loanId, loanDataBytes) {
    console.log("Rollover "+loanId);
    return new Promise(async (resolve) => {
        txCtrl.contractSovryn.methods.rollover(loanId, loanDataBytes)
            .send({ from: A.owner.adr, gas: 2500000 })
            .then((tx) => {
                console.log("rollover Transaction: ");
                //console.log(tx);
                resolve(tx.transactionHash);
            })
            .catch((err) => {
                console.error("Error in rolling over a position from the contract");
                console.error(err);
            });
    });
}


function getAvgInterestRate(amn) {
    return new Promise(async (resolve) => {
        try {
            contractISUSD.methods.totalAssetBorrow().call((error, result) => {
                if (error) {
                    console.error("error loading interest rate ");
                    console.error(error);
                    return resolve(false);
                }
                resolve(result);
            });
        }
        catch (e) {
            console.error("error on retrieving interest rate");
            console.error(e);
            resolve(false)
        }
    });
}



/**
 * parse the loan event log and returns the loan-id
 */
function parseLog(txHash) {
    console.log("parsing log");
    return new Promise(resolve => {
        txCtrl.web3.eth.getTransactionReceipt(txHash, function (e, receipt) {
            const decodedLogs = abiDecoder.decodeLogs(receipt.logs);
            
            for (let i = 0; i < decodedLogs.length; i++) {
                
                if (decodedLogs[i] && decodedLogs[i].events && decodedLogs[i].name && decodedLogs[i].name == "Borrow") {
                    //console.log(decodedLogs[i].events)
                    return resolve(decodedLogs[i].events[2].value);
                }
            }
        });
    });
}