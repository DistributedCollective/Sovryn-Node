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
       
        it('Get doc price from amm', async () => {
            let p = await Arbitrage.getDocPrices();
            console.log(p);
            assert(p[0] > 0 && p[1]>0);
        });

       
    });
});




/*
**************************************************************************
********************helpers***********************************************
**************************************************************************
*/
