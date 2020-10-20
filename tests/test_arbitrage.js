/**
 * Arbitrage tester
 */

import conf from '../config/config_testnet';
import C from '../controller/contract';
import Arbitrage from '../controller/arbitrage';
import A from '../secrets/accounts';
const assert = require('assert');

C.init(conf);
C.addWallets([A.arbitrage]);

Arbitrage.init(conf);


describe('Arbitrage', async () => {
    describe('#Retrieving prices', async () => {
    
        it('Should get the RBtc price in doc from amm', async () => {
            const amount = C.web3.utils.toWei("1", "Ether");
            let p = await Arbitrage.getPriceFromAmm(C.contractSwaps, conf.testTokenRBTC, conf.docToken, amount);
            p = C.web3.utils.fromWei(p.toString(), "Ether");
            console.log(p);
            assert(p>0);
        });
        
        it('Should get Rbtc price in doc from price feed', async () => {
            const amount = C.web3.utils.toWei("1", "Ether");
            let p = await Arbitrage.getPriceFromPriceFeed(C.contractPriceFeed, conf.testTokenRBTC, conf.docToken, amount);
            p = C.web3.utils.fromWei(p.toString(), "Ether");
            console.log(p);
            assert(p>0);
        });

        it('Should detect 50% arbitrage', async () => {
            const threshold = 5; //in %
            for(let i=0;i<10;i++) {
                const p1=100;
                const p2=100+i;
                const a = Arbitrage.calcArbitrage(p1,p2,threshold);
                console.log(a);
                if(i<5) assert(a==0);
                else assert(a>0);
            }
        });

    });
});




/*
**************************************************************************
********************helpers***********************************************
**************************************************************************
*/
