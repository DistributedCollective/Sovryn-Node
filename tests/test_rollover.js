import c from '../config/config_testnet';
global.conf = c;
import abiLoanToken from '../config/abiLoanToken';
import A from '../secrets/accounts';

/**
 * Contract tester
*/
const assert = require('assert');
import TransactionController from '../controller/transaction';
const txCtrl = new TransactionController();
const contractISUSD = new txCtrl.web3.eth.Contract(abiLoanToken, c.loanTokenSUSD);
var requiredC=0;


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

        it('should borrow 10 usd from the contract', async () => {
            const withdrawAmount = txCtrl.web3.utils.toWei("10", 'ether');
            const b = await borrow(requiredC*2, withdrawAmount, conf.testTokenRBTC, A.owner.adr, A.liquidator.adr);
            console.log(b);
            assert(true);
        });    


        /*
        //1. borrow (duration 1 minute)
        //2. rollover
        //wait 1 minute, then doit

        withdrawAmount = 10e18 #i want to borrow 10 USD
        # compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
        collateralTokenSent = sovryn.getRequiredCollateral(SUSD.address,RBTC.address,withdrawAmount,50e18, True)

        tx = loanToken.borrow(
            "0",                            # bytes32 loanId
            withdrawAmount,                 # uint256 withdrawAmount
            durationInSeconds,              # uint256 initialLoanDuration
            collateralTokenSent,            # uint256 collateralTokenSent
            RBTC.address,                   # address collateralTokenAddress
            accounts[0],                    # address borrower
            accounts[1],                    # address receiver
            b''                             # bytes memory loanDataBytes
        )
*/
   
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
            txCtrl.contractBzx.methods.getRequiredCollateral(loanToken, collateralToken, principal, marginAmount, true).call((error, result) => {
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
                //console.log(tx);
                resolve(tx.transactionHash);
            })
            .catch((err) => {
                console.error("Error in borrowing from the contract");
                console.error(err);
            });
    });
}