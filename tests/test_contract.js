/**
 * Contract tester
 * These approvals should be executed for every liquidator wallet once
*/
const assert = require('assert');
import conf from '../config/config_mainnet';
import C from '../controller/contract';
import W from '../secrets/accounts';
C.init(conf);


const amount = C.web3.utils.toWei("1000000000", 'ether');
const from = W.liquidator[2].adr.toLowerCase();

describe('Contract', async () => {
    describe('#basic function', async () => {
        before(async()=> {
            console.log("start")
            await C.addWallets(W.liquidator);
        });
       /* it('should approve the Sovryn contract to spend RBTC for the main account', async () => {
            console.log("approving "+from+ " "+conf.sovrynProtocolAdr+" for "+amount)
            const approved = await C.approveToken(C.contractTokenRBTC, from, conf.sovrynProtocolAdr, amount);
            assert(approved.length == 66);
        });  */  
        
        it('should approve the Sovryn contract to spend SUSD (doc) for the main account', async () => {
            console.log("approving "+from+ " "+conf.sovrynProtocolAdr+" for "+amount)
            
            const approved = await C.approveToken(C.contractTokenSUSD, from, conf.sovrynProtocolAdr, amount);
            assert(approved.length == 66);
        }); 

        it('should approve the rBTC IToken contract to spend sUSD for the main account', async () => {
            const approved = await C.approveToken(C.contractTokenSUSD, from, conf.loanTokenRBTC, amount);
            assert(approved.length == 66);
        }); 
/*
        it('should approve the rBTC IToken contract to spend rBTC for the main account', async () => {
            const approved = await C.approveToken(C.contractTokenRBTC, from, conf.loanTokenRBTC, amount);
            assert(approved.length == 66);
        }); 

        it('should approve the sUSD IToken contract to spend rBTC for the main account', async () => {
            const approved = await C.approveToken(C.contractTokenRBTC, from, conf.loanTokenSUSD, amount);
            assert(approved.length == 66);
        }); */

        it('should approve the sUSD IToken contract to spend sUSD for the main account', async () => {
            const approved = await C.approveToken(C.contractTokenSUSD, from, conf.loanTokenSUSD, amount);
            assert(approved.length == 66);
        }); 

        it('should check wheter the Itoken contract is allowed to spend sUSD for the main account', async() => {
            //todo check wheter above tx have desired result
            assert(true);
        })
    });
});