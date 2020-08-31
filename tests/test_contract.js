import c from '../config/config_testnet';
global.conf = c;

/**
 * Contract tester
*/
const assert = require('assert');
import TransactionController from '../controller/transaction';
const txCtrl = new TransactionController();

describe('Contract', async () => {
    describe('#basic function', async () => {
        
        it('should approve the Sovryn contract to spend RBTC for the main account', async () => {
            const approved = await approveToken(txCtrl.contractTokenRBTC, conf.sovrynProtocolAdr);
            assert(approved.length == 66);
        });    

        it('should approve the Sovryn contract to spend SUSD for the main account', async () => {
            const approved = await approveToken(txCtrl.contractTokenSUSD, conf.sovrynProtocolAdr);
            assert(approved.length == 66);
        }); 

        it('should approve the rBTC IToken contract to spend sUSD for the main account', async () => {
            const approved = await approveToken(txCtrl.contractTokenSUSD, conf.loanTokenRBTC);
            assert(approved.length == 66);
        }); 

        it('should approve the rBTC IToken contract to spend rBTC for the main account', async () => {
            const approved = await approveToken(txCtrl.contractTokenRBTC, conf.loanTokenRBTC);
            assert(approved.length == 66);
        }); 

        it('should approve the sUSD IToken contract to spend rBTC for the main account', async () => {
            const approved = await approveToken(txCtrl.contractTokenRBTC, conf.loanTokenSUSD);
            assert(approved.length == 66);
        }); 

        it('should approve the sUSD IToken contract to spend sUSD for the main account', async () => {
            const approved = await approveToken(txCtrl.contractTokenSUSD, conf.loanTokenSUSD);
            assert(approved.length == 66);
        }); 

        it('should check wheter the Itoken contract is allowed to spend sUSD for the main account', async() => {
            //todo check wheter above tx have desired result
            assert(true);
        })
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
async function approveToken(contract, receiver) {
    return new Promise(async (resolve) => {
        const amount = txCtrl.web3.utils.toWei("1000000000", 'ether');
        let a = await txCtrl.approveToken(contract, receiver, amount);
        resolve(a);
    });
}

async function checkAllowance(contract, adr, token) {
    return new Promise(async (resolve) => {
        try {
            p.contractSovryn.methods.getLoan(loanId).call((error, result) => {
                if (error) {
                    console.error("error loading loan "+loanId);
                    console.error(error);
                    return resolve(false);
                }
                resolve(result);
            });
        }
        catch (e) {
            console.error("error on retrieving loan status for loan-id "+loanId);
            console.error(e);
            resolve(false)
        }
    });
}