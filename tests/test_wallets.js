/**
 * Wallet tester
 * Set config file in /config.config.js manually because mocha.js overwrites process.arg
*/
const assert = require('assert');
import conf from '../config/config';
import C from '../controller/contract';
import A from '../secrets/accounts';
import Wallet from '../controller/wallet';
import U from '../util/helper';

var liqQueue={};

describe('Wallet', async () => {
    describe('#Read wallet', async () => {
        it('should return all liquidator rbtc wallet balances', async () => {
            for(var w of A.liquidator) {
                let bal = await C.getWalletBalance(w.adr);
                console.log("RBTC balance of "+w.adr+":"+ bal);
                assert(bal>0);
            }
        });    

        /*
        //not needed anymore, new contracts working with real rbtc
        it('should return all liquidator rbtc-token wallet balances', async () => {
            for(var w of A.liquidator) {
                let bal = await C.getWalletTokenBalance(w.adr, conf.testTokenRBTC);
                console.log("RBTC testtoken balance of "+w.adr+":"+ bal);
                assert(bal>0);
            }
        });*/

        it('should return all liquidator doc-token wallet balances', async () => {
            for(var w of A.liquidator) {
                let bal = await C.getWalletTokenBalance(w.adr, conf.docToken);
                bal = C.web3.utils.fromWei(bal, "Ether");
                console.log("Doc testtoken balance of "+w.adr+":"+ bal);
                assert(bal>0);
            }
        });   

        it('should verify all liquidator wallets approved the sovryn contract to spend doc-token on their behalf', async () => {
            for(var w of A.liquidator) {
                let bal = await C.getWalletTokenAllowance(w.adr, conf.sovrynProtocolAdr, conf.docToken);
                console.log("Doc allowance for sovryn contract:"+ bal);
                assert(bal>0);
            }
        });
        
        /*
        //Not needed for new contracts
        it('should verify all liquidator wallets approved the sovryn contract to spend rbtc-token on their behalf', async () => {
            for(var w of A.liquidator) {
                let bal = await C.getWalletTokenAllowance(w.adr, conf.sovrynProtocolAdr, conf.testTokenRBTC);
                console.log("RBTC allowance for sovryn contract:"+ bal);
                assert(bal>0);
            }
        });*/

        it('should performa a complete liquidation wallet check', async()=> {
            for(var w of A.liquidator) {
                let checked = await C.completeWalletCheck(w.adr);
                console.log("wallet: "+w.adr+" passed the check: "+checked);
                assert(checked);
            }
        });

        it('should fill all open slots for the liquidator queue', async()=> {
            const reqBal = C.web3.utils.toWei("0.001", "Ether");
            for(let i=0;i<A.liquidator.length;i++) {
                const w = await Wallet.getWallet("liquidator", reqBal, "rBtc");
                
                for(let j=0;j<4;j++) {
                    const loanId = Math.random()*100000;
                    liqQueue[loanId]=w.adr;
                    console.log("Add loan "+loanId+" for address "+w.adr);
                    Wallet.addToQueue("liquidator", w.adr, loanId);
                }
            }
            for(let p in Wallet.queue["liquidator"]) assert(Wallet.queue["liquidator"][p].length==4);
        });

        it('should fail to return a wallet because all wallets are busy', async()=> {
            const lastWallet = await Wallet.getWallet("liquidator", 0, "rBtc");
            assert(!lastWallet);
        });

        it('should recognize all loan-Ids are already in queue', async()=> {
            for(let l in liqQueue){
                const inQueue = await Wallet.checkIfPositionExists(parseFloat(l));
                assert(inQueue);
            }
        });

        it('should remove all positions from the liquidator queue', async()=> {
            for(let l in liqQueue){
                console.log("Remove loan "+l+" associated to address "+liqQueue[l]);
                Wallet.removeFromQueue("liquidator", liqQueue[l], parseFloat(l));
            }
            assert(Object.keys(Wallet.queue["liquidator"]).length === 0);
        });

    });

    /*
    describe('#Send tx', async () => {
        it('should send 4 tx at once', async () => {
            const w = await Wallet.getWallet("liquidator", 0.1, "rBtc");
            C.addWallets([w]);
            const to = A.liquidator[0].adr;
            
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
    });*/
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