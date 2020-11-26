/**
 * general tests for interacting with the node.
 */

import c from '../config/config_testnet';
import abiComplete from '../config/abiComplete';
import abiLoanToken from './abi/abiLoanToken';
import abiLoanOpeningEvents from './abi/abiLoanOpeningEvents';
import Web3 from 'web3';
const abiDecoder = require('abi-decoder');
var assert = require('assert');
import tx from './tx_log_example';
var web3, contractISUSD;
abiDecoder.addABI(abiComplete);

describe('Process blocks', () => {
  describe('#events', () => {
    before('should instanciate web3 and connect to the node', async () => {
      web3 = new Web3(c.nodeProvider);
      contractISUSD = new web3.eth.Contract(abiLoanToken.concat(abiLoanOpeningEvents), c.loanTokenSUSD);
      const b = await web3.eth.getBlockNumber();
      console.log("current block " + b);
      assert(b > 0);
    });

    it('should return some events', () => {
      contractISUSD.getPastEvents('Mint', {
        fromBlock: 1205639,
        toBlock: 'latest'
      }, (error, events) => {
        if (error) {
          console.log("had an error"); console.log(error);
        }
        console.log("no err")
        console.log(events);
        assert(true);
      });
    });
/*
    it('should decode the event log', () => {
      for(let ev in tx.events) {
        //console.log(tx.events[ev])
        if(!tx.events[ev].raw || !tx.events[ev].raw.topics) continue;

        //console.log(tx.events[ev].raw);
        const decodedLogs = abiDecoder.decodeLogs([tx.events[ev].raw]);
        if(!decodedLogs[0] || !decodedLogs[0].events) continue;
        //console.log("decoded");
        //console.log(decodedLogs[0].events);
        let ids=[];
        for(let e of decodedLogs[0].events) if(e.name=="loanId") {
          console.log("found loan id: " +e.value);
          ids.push(e.value);
        }
        for(let i in ids) assert(ids[i].length==66);
      }
    })*/
  });
});