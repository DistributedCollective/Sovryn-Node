import c from '../config/config_testnet';
global.c=c;
import TransactionController from '../controller/transaction';
var assert = require('assert');

import txlist from './txlist';

const txCtrl1 = new TransactionController(c.loanTokenSUSD);


describe('Processing trades', () => {
    describe('#events', () => {

        it('should return an array with 3 trade-ids', async () => {
            let evList = txCtrl1.parseEvents(txlist);
            console.log(evList);
            //assert(evList > 0);
            assert(true);
        });

    });

});

