/**
 * Wallet tester
 * 
*/
const assert = require('assert');
import conf from '../config/config_testnet';
import C from '../controller/contract';
import A from '../secrets/accounts';
import Wallet from '../controller/wallet';
import U from '../util/helper';

C.init(conf);


describe('Wallet', async () => {
    describe('#Read wallet', async () => {
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

    describe('#Send tx', async () => {
        it('should send 4 tx at once', async () => {
            const w = Wallet.getWallet("liquidator");
            C.addWallets([w]);
            const to = "0xe2b59CD37D173D550D75e9891376bf21b3f996F1";
            
            for (let i = 0; i < 4; i++) {
                const amount = 0.001*(i+1);
                let nonce = await C.web3.eth.getTransactionCount(w.adr, 'pending');
                try {
                    sendTransaction(w.adr, w.adr, amount, nonce);
                    assert(true);
                }
                catch(e){
                    console.log("error sending tx");
                    assert(false);
                }
                await U.wasteTime(1);
            }
        });
    });
});



/**
 * Helper
 */

async function sendTransaction(from, to, amount, nonce) {
    console.log("Send tx with nonce: " + nonce+", amount: "+amount);
    let tx = await C.web3.eth.sendTransaction({
        from: from,
        to: to,
        value: C.web3.utils.toWei(amount.toString(), "Ether"),
        gas: 100000,
        nonce: nonce
    });
    console.log(tx);
}