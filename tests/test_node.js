/**
 * general tests for interacting with the node.
 * */

import c from '../config/config';
import abiComplete from '../config/abiComplete';
import abiLoanToken from '../config/abiLoanToken';
import abiLoanOpeningEvents from '../config/abiLoanOpeningEvents';

import Rsk3 from '@rsksmart/rsk3';
import Web3 from 'web3';
const abiDecoder = require('abi-decoder');

import tx from './tx';


var assert = require('assert');

var rsk3, web3, contractSUSD;
abiDecoder.addABI(abiComplete);

describe('Process blocks', () => {
  describe('#events', () => {

    //also a pre-condition
    it('should instanciate web3,rsk3 and connect to the node', async () => {
      rsk3 = new Rsk3('http://18.138.223.132:4444');
      web3 = new Web3('http://18.138.223.132:4444');
      //console.log(rsk3);
      contractSUSD = new rsk3.Contract(abiLoanToken.concat(abiLoanOpeningEvents), c.loanTokenRBTC);
      const b = await rsk3.getBlockNumber();
      console.log("current block " + b);
      assert(b > 0);
    });

    it('should return some events', () => {
      contractSUSD.getPastEvents('Transfer', {
        fromBlock: 10000,
        toBlock: 'latest'
      }, (error, events) => {
        if (error) {
          console.log("had an error"); console.log(error);
        }
        console.log("no err")
        console.log(events[0]);
        assert(events && events.length > 0);
      });
    });

    it('should return a tx receipt', () => {
      web3.eth.getTransactionReceipt("0x57cd76e2c8656178b91a234160a5e618da0adb410dd28f83200d96b6ba3a1183", (e, receipt)=> {
        if(e) assert(false);
        else //console.log(receipt);
        assert(true);
      });
    });

    it('should decode the event log', () => {
      for(let ev in tx.events) {
        //console.log(tx.events[ev])
        if(!tx.events[ev].raw || !tx.events[ev].raw.topics) continue;

        //console.log(tx.events[ev].raw);
        const decodedLogs = abiDecoder.decodeLogs([tx.events[ev].raw]);
        if(!decodedLogs[0] || !decodedLogs[0].events) continue;
        //console.log("decoded");
        //console.log(decodedLogs[0].events);
        let id="";
        for(let e of decodedLogs[0].events) if(e.name=="loanId") {
          console.log("found loan id: " +e.value);
          id=e.value;
        }
        assert(id!="");
      }
    })
  });

});


/*
//next step:

interval (1/minute)
for every openpos in queue:
check if loan healthy ()
= call getLoan(loanId)
//decode return struct with abi????

*/