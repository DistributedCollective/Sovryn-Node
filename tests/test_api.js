/**
 * Api tester
 */
import c from '../config/config_testnet';
import io from 'socket.io-client';

const assert = require('assert');

var socket;

describe('Api', async () => {
    describe('#Open positions', async () => {
        before(async () => {
            console.log("init");
            socket = io('http://localhost:'+c.serverPort);
        });

        it('should return number of open positions', async () => {
            let res = await emitReq("openPos");
            console.log(res+" current open positions in the queue");
            assert(res >0);
        });

        it('should return position details', async () => {
            let res = await emitReq("getOpenPositionsDetails");
            let arr = Object.keys(res);
            console.log("Last open positions");
            console.log(res[arr[arr.length-1]]);
            assert(arr.length>0);
        });
    });
});


//helper

function emitReq(req) {
    return new Promise(resolve=>{
        socket.emit(req, (res) => {
            resolve(res);
        });
    });
}