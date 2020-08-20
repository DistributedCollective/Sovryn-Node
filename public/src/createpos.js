import c from '../../config/config_testnet';
import abiComplete from '../../config/abiComplete';
import abiLoanToken from '../../config/abiLoanToken';
import abiTestToken from '../../config/abiTestToken';
import Web3 from 'web3';
const abiDecoder = require('abi-decoder');

var contractISUSD, contractTokenSUSD, contractTokenRBTC;

abiDecoder.addABI(abiComplete);


async function start() {
    console.log("init");
    contractISUSD = new web3.eth.Contract(abiLoanToken, c.loanTokenSUSD);
    contractTokenSUSD = new web3.eth.Contract(abiTestToken, c.testTokenSUSD);
    contractTokenRBTC = new web3.eth.Contract(abiTestToken, c.testTokenRBTC);
            
    //contractIRBTC = new web3.eth.Contract(abiLoanToken, loanTokenRBTC);
    //contractTokenRBTC = new web3.eth.Contract(abiTestToken, testTokenRBTC);

    
    //it should create a position with 2x leverage)'
    let a = await openLongPosition("0.01", "2");

    //it should create a position with 4x leverage)'
    //let p = await openLongPosition("0.01", "4");
}



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

        let a = await approveToken(contractTokenRBTC, c.loanTokenSUSD, collateralTokenSent);
        let t = await marginTrade(contractISUSD, loanId, leverageAmount, loanTokenSent, collateralTokenSent, c.testTokenRBTC, window.acc, loanDataBytes);
        //let newLoanId = await parseLog(t);
        resolve({  trade: t });
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
            .send({ from: window.acc })
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
                console.error(err);
            });
    });
}



/**
  * Tokenholder approves the loan token contract to spend tokens on his behalf
  */
function approveToken(tokenCtr, loanToken, collateralToken) {
    return new Promise(resolve => {
        tokenCtr.methods.approve(loanToken, collateralToken)
            .send({ from: window.acc })
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
          if(decodedLogs[i] && decodedLogs[i].events && decodedLogs[i].name=="Trade") {
            console.log(decodedLogs[i].events);
            return resolve(decodedLogs[i].events[2].value);
          }
        }
      });
    });
  }
  

  window.start=start;