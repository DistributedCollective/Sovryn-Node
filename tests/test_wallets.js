/**
 * Wallet tester
 * 
*/
const assert = require('assert');
import conf from '../config/config_testnet';
import C from '../controller/contract';
import A from '../secrets/accounts';

C.init(conf);

describe('Wallet', async () => {
    describe('#basic function', async () => {
        it('should return all liquidator rbtc wallet balances', async () => {
            for(var w of A.liquidator) {
                let bal = await C.getWalletBalance(w.adr);
                console.log("RBTC balance of "+w.adr+":"+ bal);
                assert(bal>0);
            }
        });    

        it('should return all liquidator rbtc-token wallet balances', async () => {
            for(var w of A.liquidator) {
                let bal = await C.getWalletTokenBalance(w.adr, conf.testTokenRBTC);
                console.log("RBTC testtoken balance of "+w.adr+":"+ bal);
                assert(bal>0);
            }
        }); 

        it('should return all liquidator susd-token wallet balances', async () => {
            for(var w of A.liquidator) {
                let bal = await C.getWalletTokenBalance(w.adr, conf.testTokenSUSD);
                console.log("SUSD testtoken balance of "+w.adr+":"+ bal);
                assert(bal>0);
            }
        });   

        it('should verify all liquidator wallets approved the sovryn contract to spend susd-token on their behalf', async () => {
            for(var w of A.liquidator) {
                let bal = await C.getWalletTokenAllowance(w.adr, conf.sovrynProtocolAdr, conf.testTokenSUSD);
                console.log("SUSD allowance for sovryn contract:"+ bal);
                assert(bal>0);
            }
        });

        it('should verify all liquidator wallets approved the sovryn contract to spend rbtc-token on their behalf', async () => {
            for(var w of A.liquidator) {
                let bal = await C.getWalletTokenAllowance(w.adr, conf.sovrynProtocolAdr, conf.testTokenRBTC);
                console.log("RBTC allowance for sovryn contract:"+ bal);
                assert(bal>0);
            }
        });

        it('should performa a complete liquidation wallet check', async()=> {
            for(var w of A.liquidator) {
                let checked = await C.completeWalletCheck(w.adr);
                console.log("wallet: "+w.adr+" passed the check: "+checked);
                assert(checked);
            }
        });
    });
});
