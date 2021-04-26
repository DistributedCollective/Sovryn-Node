/**
 * This test need to be executed in 2 steps
 * Day1: create open loans. Wait 24h
 * Day2: Execute it again. It will load open and expired positions from Day1 and tries to roll them over.
 * 
 * Set config file in /config.config.js manually because mocha.js overwrites process.arg
*/
import conf from '../config/config';
import abiComplete from '../config/abiComplete';
import A from '../secrets/accounts';
import C from '../controller/contract';
import Rollover from '../controller/rollover';
import PosScanner from '../controller/scanner';
import Wallet from '../controller/wallet';
import abiLoanToken from './abi/abiLoanToken';

const assert = require('assert');
const abiDecoder = require('abi-decoder');
abiDecoder.addABI(abiComplete);


const contractISUSD = new C.web3.eth.Contract(abiLoanToken, conf.loanTokenSUSD);

var requiredC=0;
var loanId="";
var rollover=[];

describe('Contract', async () => {
    describe('#rollover open positions', async () => {
        it('should return required collateral for a loan', async () => {
            const withdrawAmount = C.web3.utils.toWei("10", 'ether');
            const marginAmount = C.web3.utils.toWei("50", 'ether');
            const rC = await getRequiredCollateral(conf.docToken, conf.testTokenRBTC, withdrawAmount, marginAmount);
            console.log("required collateral "+C.web3.utils.fromWei(rC, 'ether'));
            requiredC=rC;
            assert(rC>0);
        });    
        
        //just for curiosity 
        it('should return avg interest rate', async () => {
            const withdrawAmount = C.web3.utils.toWei("10", 'ether');
            let intRate = await getAvgInterestRate(withdrawAmount);
            intRate = C.web3.utils.fromWei(intRate, "ether");
            console.log("interest rate is "+intRate);
            assert(intRate>0);
        });         
        /*
        it('should borrow 10 usd from the contract', async () => {
            const withdrawAmount = C.web3.utils.toWei("10", 'ether');
            const b = await borrow(requiredC, withdrawAmount, conf.testTokenRBTC, A.liquidator[0].adr, A.liquidator[0].adr);
            loanId = await parseLog(b);
            console.log("Borrowing successful. Loan-id: "+loanId);
            assert(b.length==66);
        }); */
        
        it('should find open positions with expired date on the contract', async () => {
            var pos = [1];
            let from = 0;
            let to = conf.nrOfProcessingPositions;
            let totalPos=0;

            while (pos.length>0) {
                pos = await PosScanner.loadActivePositions(from, to);
                if (pos) {
                    from = to;
                    to = from + conf.nrOfProcessingPositions;
                    console.log(pos.length + " active positions found");
                    totalPos+=pos.length;

                    for (let p in pos) {
                        const amn = C.web3.utils.fromWei(pos[p].collateral.toString(), "Ether");
                        if(pos[p].loanToken.toLowerCase() == conf.docToken && amn < 2) continue;
                        else if(pos[p].loanToken.toLowerCase() == conf.testTokenRBTC && amn < 0.0001) continue; 
                    
                        if(pos[p].endTimestamp < Date.now()/1000){
                            console.log("Found expired open position. "+pos[p].loanId+", amount: "+amn);
                            rollover.push(pos[p].loanId);
                        }
                    }
                }
            }
            console.log("Found "+totalPos+" open positions. "+rollover.length+" to rollover");
            assert(true);
        });   

        //the position need to be expired (min time = 24h)
        it('should rollover all expired loans', async () => {
            if(rollover.length==0) {
                console.log("Nothing todo here");
                return assert(true);
            }
            console.log("start rollover");
            for(let i in rollover) {
                const [w] = await Wallet.getWallet("rollover", 0.001, "rBtc");
                let nonce = await C.web3.eth.getTransactionCount(w.adr.toLowerCase(), 'pending');
                const r = await Rollover.rollover(rollover[i], w.adr.toLowerCase(), nonce);
                console.log(r);

                assert(r.length==66);
            }
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
            C.contractSovryn.methods.getRequiredCollateral(loanToken, collateralToken, principal, marginAmount, true).call((error, result) => {
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
    console.log("-----------")
    console.log(collateralTokenSent)
    console.log(withdrawAmount)
    console.log(collateralTokenAddress)
    console.log(adrBorrower)
    console.log(adrReceiver)
    return new Promise(async (resolve) => {
        const loanId = "0x0000000000000000000000000000000000000000000000000000000000000000"; // 0 if new loan
        const durationInSeconds = 60*60*24;
        const loanDataBytes = "0x"; //need to be empty

        //console.log(C.contractSovryn.methods)
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
            .send({ from: adrBorrower, gas: conf.gasLimit, value: collateralTokenSent })
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
 * Parse the loan event log and returns the loan-id
 */
function parseLog(txHash) {
    console.log("parsing log");
    return new Promise(resolve => {
        C.web3.eth.getTransactionReceipt(txHash, function (e, receipt) {
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