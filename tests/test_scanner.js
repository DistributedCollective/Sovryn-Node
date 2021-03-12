/**
 * Test the position scanner loop
 * Set config file in /config.config.js manually because mocha.js overwrites process.arg
*/
import abiComplete from '../config/abiComplete';
import PosScanner from '../controller/scanner';
import C from '../controller/contract';
import common from '../controller/common'
const assert = require('assert');
const abiDecoder = require('abi-decoder');
abiDecoder.addABI(abiComplete);
import config from "../config/config";

let positions = {}
let liquidations = {};

describe('Scanner', async () => {
    describe('#Open positions', async () => {
        before('init', async () => {
            PosScanner.positions=positions;
            PosScanner.liquidations=liquidations;
            PosScanner.positionsTmp={};
        });

        it('should find open positions on the Sovryn contract', async () => {
            await common.getCurrentActivePositions()
            assert(true);
        });
        
        it('should find open positions with margin < 50%', async () => {
            for(let p in PosScanner.positions){
                //console.log(PosScanner.positions[p])
                let margin = PosScanner.positions[p].currentMargin/1e18;
                let mMargin = PosScanner.positions[p].maintenanceMargin/1e18;
                if(margin<70) console.log("Current margin: "+margin+" maintenance margin: "+mMargin+", loanId: "+p);
            }
        });

        it('should calc value of all open pos', async () => {
            let totalSum = 0, sumDoc = 0;
            for(let p in PosScanner.positions){
                // console.log(PosScanner.positions[p])
                let margin = PosScanner.positions[p].currentMargin/1e18;
                let mMargin = PosScanner.positions[p].maintenanceMargin/1e18;
                if(margin<70) console.log("Current margin: "+margin+" maintenance margin: "+mMargin+", loanId: "+p);

                totalSum += (Number(PosScanner.positions[p].collateral) || 0);
                if (PosScanner.positions[p].collateralToken.toLowerCase() === config.docToken) {
                    sumDoc += (Number(PosScanner.positions[p].collateral) || 0);
                }
            }

            console.log("total value of all positions", totalSum/1e18);
            console.log("total value of all open DOC positions", sumDoc/1e18);
            console.log("total value of all open RBTC positions", (totalSum - sumDoc)/1e18);
        });


        /*
        it('should process all open pos', async () => {
            for(let p in PosScanner.positions){
                let ev = await loadEvent(p);  
                console.log(p+" "+ev.user);             
            }
            assert(true);
        });*/
    });
});




/*
**************************************************************************
********************helpers***********************************************
**************************************************************************
*/



/**
 * Parse the loan event log and returns the loan-id
 */
function parseLog(txHash) {
    console.log("parsing log");
    return new Promise(resolve => {
        C.web3.eth.getTransactionReceipt(txHash, function (e, receipt) {
            const decodedLogs = abiDecoder.decodeLogs(receipt.logs);

            for (let i = 0; i < decodedLogs.length; i++) {
                if (decodedLogs[i] && decodedLogs[i].events && decodedLogs[i].name && decodedLogs[i].name == "Borrow") {
                    //console.log(decodedLogs[i].events)
                    return resolve(decodedLogs[i].events[2].value);
                }
            }
        });
    });
}


function loadEvent(loanId) {
    return new Promise(resolve => {
        C.contractSovryn.getPastEvents('Trade', {
            fromBlock: 2742418,
            toBlock: 'latest',
            filter: {loanId: loanId}
        }, (error, events) => {
            if (error) {
                //console.log("had an error"); console.log(error);
                return resolve({});
            }
            //console.log(events[0].returnValues);
            //console.log(events[0]);
            if(events[0]&&events[0].returnValues) return resolve(events[0].returnValues);

            resolve({});
        });
    });
}