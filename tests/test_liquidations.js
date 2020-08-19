import c from '../config/config_testnet';
global.c=c;
import abiComplete from '../config/abiComplete';
import abiLoanToken from '../config/abiLoanToken';
import abiTestToken from '../config/abiTestToken';
import abiPriceFeed from '../config/priceFeed';
import Web3 from 'web3';

//only owner can change the price
import owner from '../secrets/account';
const abiDecoder = require('abi-decoder');
const assert = require('assert');

import TransactionController from '../controller/transaction';

const txCtrl1 = new TransactionController(c.loanTokenSUSD);
var web3, contractISUSD, contractTokenSUSD, contractPriceFeed;
const adrPriceFeed = "0xf2e9fD37912aB53D0FEC1eaCE86d6A14346Fb6dD";


describe('Liquidation', async () => {
    describe('#liquidate a position', async() => {
        before(() => {
            console.log("init");
            web3 = new Web3(c.nodeProvider);
            web3.eth.accounts.privateKeyToAccount(owner.pKey);
            contractISUSD = new web3.eth.Contract(abiLoanToken, c.loanTokenSUSD);
            contractTokenSUSD = new web3.eth.Contract(abiTestToken, c.testTokenSUSD);
            contractPriceFeed = new web3.eth.Contract(abiPriceFeed, adrPriceFeed);
            abiDecoder.addABI(abiComplete);
        });

        /*
        //done on client side until node is synced
        //should return loan-id, remaining margin, maintenance margin
        it('should create a position with 2x leverage)', async () => {
            let p = await openLongPosition("0.01", "2");
            let newLoanId = await parseLog(p);
            assert(p.approved && p.trade);
        });

        //done on client side until node is synced
        //should return loan-id, remaining margin, maintenance margin
        it('should create a position with 4x leverage)', async () => {
            let p = await openLongPosition("0.01", "4");
            let newLoanId = await parseLog(p);
            assert(p.approved && p.trade);
        });*/

        //need loan-id until node works
        it('should read status of the open positions', async()=> {
            const loanId="0xd93e64dfa3f103d0584d8e513a19bad7555f75a86cd83eb7a9585cea9c98eacf";
            let status = await txCtrl1.getLoanStatus(loanId);
            assert(status, 1);
        });

        //
        //startMargin: '50000000000000000000',
        //maintenanceMargin: '15000000000000000000',
        //currentMargin: '49851979178082186731',
        it('should change the rate at the price feed contract, so that remaining margin < maintenance of the high leverage position only', async()=> {
            

        });
        
    });
});



/*
d. Make sure the high leverage position gets liquidated
e. Change the rate at the price feed contract to an amount which is that low that the remaining margin becomes negative and see if it’s handled correctly
f. Add a new position to the list and make sure the script picks it up

*/




/*
**************************************************************************
*helpers******************************************************************
**************************************************************************
*/

/**
 * Opens a long position on the loan token contract 
 * @amount, @leverage = strings
 */
async function openLongPosition(amount, leverage) {
    return new Promise(async (resolve) => {
        console.log("send long tx with " + leverage + " leverage" + " deposit amount " + amount);
        const loanId = "0x0000000000000000000000000000000000000000000000000000000000000000"; // 0 if new loan
        const leverageAmount = web3.utils.toWei(leverage, 'ether');
        const loanTokenSent = 0;

        //passs a vale from the user from 0-5
        const collateralTokenSent = web3.utils.toWei(amount, 'ether');
        const loanDataBytes = "0x"; //need to be empty

        let a = await approveToken(contractTokenSUSD, c.loanTokenSUSD, collateralTokenSent);
        let t = await marginTrade(contractISUSD, loanId, leverageAmount, loanTokenSent, collateralTokenSent, c.testTokenRBTC, owner.adr, loanDataBytes);
        resolve({approved:a, trade:t});
    });
}

/**
 * Creates a margin trade on the loan token contract
 */
function marginTrade(contractToken, loanId, leverageAmount, loanTokenSent, collateralTokenSent, testTokenAdr, trader, loanDataBytes) {
    return new Promise(resolve => {

        //collateral can be in SUSD or RBTC
        //it needs to be passed in the margin trade function either as loanTokenSent or collateralTokenSent depending on the iToken
        contractToken.methods.marginTrade(
            loanId,
            leverageAmount,
            loanTokenSent,
            collateralTokenSent,
            testTokenAdr, //in case of ISUSD the collateral is RBTC 
            trader,
            loanDataBytes
        )
            .send({ from: owner.adr })
            .then(async (tx) => {
                console.log("marginTrade Transaction: ", tx);
                /*
                let result = [0, 0];
                if (tx.transactionHash) result = await this.parseLog(tx.transactionHash);
                tx.positionSize = result[0];
                tx.entryPrice = result[1];*/
                resolve(tx.transactionHash);
            })
            .catch((err) => {
                console.error("Error on creating a trade");
                console.lerror(err);
            });
    });
}



/**
  * Tokenholder approves the loan token contract to spend tokens on his behalf
  */
function approveToken(tokenCtr, loanToken, collateralToken) {
    return new Promise(resolve => {
        tokenCtr.methods.approve(loanToken, collateralToken)
            .send({ from: owner.adr })
            .then((tx) => {
                console.log("Approved Transaction: ", tx)
                resolve(tx.transactionHash);
            });
    });
}

/**
   * parse the marginTrade event log and returns the loan-id
   */
  function parseLog(txHash) {
    console.log("parsing log");
    return new Promise(resolve => {
      web3.eth.getTransactionReceipt(txHash, function(e, receipt) {
        const decodedLogs = abiDecoder.decodeLogs(receipt.logs);
        console.log(decodedLogs);
        
        for(let i=0;i<decodedLogs.length;i++) {
          if(decodedLogs[i] && decodedLogs[i].events) {
            console.log(decodedLogs[i].events);
            //const posP = parseFloat(web3utils.fromWei(decodedLogs[i].events[5].value, 'ether')).toFixed(4);
            //const entryP = parseFloat(web3utils.fromWei(decodedLogs[i].events[9].value, 'ether')).toFixed(4);
            return resolve(0);
            
          }
        }
      });
    });
  }
  

/*
* Change the conversion rate usd/btc on the contract (?)
* only owner
*/

