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
            const approved = await approveToken(txCtrl.contractTokenRBTC, conf.bzxProtocolAdr);
            assert(approved.length == 66);
        });    

        it('should approve the Sovryn contract to spend SUSD for the main account', async () => {
            const approved = await approveToken(txCtrl.contractTokenSUSD, conf.bzxProtocolAdr);
            assert(approved.length == 66);
        }); 

        it('should approve the IToken contract to spend RBTC for the main account', async () => {
            const approved = await approveToken(txCtrl.contractTokenSUSD, conf.loanTokenRBTC);
            assert(approved.length == 66);
        }); 

        it('should approve the IToken contract to spend SUSD for the main account', async () => {
            const approved = await approveToken(txCtrl.contractTokenRBTC, conf.loanTokenSUSD);
            assert(approved.length == 66);
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
async function approveToken(contract, receiver) {
    return new Promise(async (resolve) => {
        const amount = txCtrl.web3.utils.toWei("1000000000", 'ether');
        let a = await txCtrl.approveToken(contract, receiver, amount);
        resolve(a);
    });
}

