var contractSUSD, contractBzx;

let cSUSDadr = "0xC6Aa9E9C18021Db79eDa87a8E58dD3c146A6b1E5";
let bzxProtocolAdr = "0xBAC609F5C8bb796Fa5A31002f12aaF24B7c35818";


var web3;

//let abi = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"sender","type":"address"},{"name":"recipient","type":"address"},{"name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"account","type":"address"},{"name":"amount","type":"uint256"}],"name":"mint","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"renounceOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"isOwner","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"account","type":"address"}],"name":"addMinter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"renounceMinter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"who","type":"address"},{"name":"value","type":"uint256"}],"name":"burn","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"recipient","type":"address"},{"name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"isMinter","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":false,"stateMutability":"nonpayable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"account","type":"address"}],"name":"MinterAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"account","type":"address"}],"name":"MinterRemoved","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"}];
//adr = "0xb2d705097d9f80d47289efb2a25bc78fee9d3e80";



window.addEventListener('load', () => {
  if (window.ethereum) {
    console.log("web3 provider found");
    web3 = new Web3(window.ethereum);
    window.ethereum.enable();
  }
  else web3 = new Web3(Web3.givenProvider);

  console.log("web3 loaded");
  console.log(web3);
  contractSUSD = new web3.eth.Contract(superAbi, cSUSDadr);
  contractBzx = new web3.eth.Contract(superAbi, bzxProtocolAdr);
});


async function start() {
  console.log("start");

  //let res = await loadEvents(1103049, 1103053, 'Transfer');
  //console.log(res);
  //listen()
  //let l = await getLoan("0x0f5254f95dc22ea94f84e2b0f57a16fa7622087855bc1298fa73eb42671f5011");
  //let u = await getUserLoans("0x1BB2B1bEeDA1FB25Ee5da9CAE6c0F12CeD831128", 0, 100, 0, false, false);

  let a = await getActiveLoans(10, 12, false);
  console.log("done")
  console.log(a);
}




async function getLoan(loanId) {
  contractBzx.methods.getLoan(loanId).call((error, result) => {
    if (error) console.log(error);

    console.log("loan details");
    console.log(result);

    if (result.currentMargin && result.maintenanceMargin) {
      let curr = parseInt(result.currentMargin);
      let mM = parseInt(result.maintenanceMargin);
      console.log("current margin: " + curr);
      console.log("maintenance margin: " + mM);
      if (curr <= mM) console.log("loan need to be liquidated. Current margin <= maintenanceMargin.");
    }
  });
}


async function listen() {

  console.log("listen for new events");

  contractSUSD.events.allEvents({ fromBlock: 1091837 }, function (error, event) {
    if (error) {
      console.log("error"); console.log(error);
    }
    else {
      console.log("worked");
      console.log(event);
    }

  })

    .on('data', function (event) {
      console.log("data")
      console.log(event); // same results as the optional callback above
    })
    .on('changed', function (event) {
      // remove event from local database
      console.log("changed"); console.log(event)
    })
    .on('error', console.error);

}


async function loadEvents(from, to, eventName) {
  console.log("parsing " + eventName + " event from block-id " + from + " to: " + to);

  return new Promise(resolve => {
    contractSUSD.getPastEvents(eventName, {
      fromBlock: from,
      toBlock: to
    }, async (error, events) => {
      if (error) {
        console.log("error processing past events");
        console.log(error);
        return resolve(-1);
      }
      if (events) resolve(events)
      else resolve(-1);
    });
  });
}




// Only returns data for loans that are active
// loanType 0: all loans
// loanType 1: margin trade loans
// loanType 2: non-margin trade loans
// only active loans are returned
async function getUserLoans(user, start, count, loanType, isLender, unsafeOnly) {
  console.log("get loans for " + user);

  return new Promise(resolve => {
    contractBzx.methods.getUserLoans(user, start, count, loanType, isLender, unsafeOnly).call((error, res) => {
      if (error) {
        console.log("error receiving user loans");
        console.log(error);
        return resolve(-1);
      }
      if (res) resolve(res)
      else resolve(-1);
    });
  });
}


async function getActiveLoans(start, count, unsafeOnly) {
  console.log("get active loans");

  return new Promise(resolve => {
    contractBzx.methods.getActiveLoans(start, count, unsafeOnly).call((error, res) => {
      if (error) {
        console.log("error receiving user loans");
        console.log(error);
        return resolve(-1);
      }
      if (res) resolve(res)
      else resolve(-1);
    });
  });
}


/*
import web3utils from 'web3-utils'

//using the abi of the loan token logic for the loan token contract because loan token contract use the delegate call on the loan token logic
import abiLoanToken from "../config/abiLoanToken.js";
import abiTestToken from "../config/abiTestToken.js";
import abiLoanOpeningEvents from "../config/abiLoanopeningEvents.js";
import { testTokenSUSD, testTokenRBTC, loanTokenSUSD, loanTokenRBTC } from "../config/addresses.js"
const abiDecoder = require('abi-decoder');


//Empty comment

class Test {
  constructor(props) {
    super(props)
    this._isMounted = false
    this.state = {
      account: "",
      modalOpen: false
    }
    this.openLongPosition = this.openLongPosition.bind(this);
    this.openShortPosition = this.openShortPosition.bind(this);
    abiDecoder.addABI(abiLoanOpeningEvents);
  }


  //init web3 and contracts
  async loadBlockchainData() {
    console.log("init web3");
    let web3;
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      window.ethereum.enable();
    }
    else web3 = new Web3(Web3.givenProvider);
    this.contractISUSD = new web3.eth.Contract(abiLoanToken, loanTokenSUSD);
    this.contractIRBTC = new web3.eth.Contract(abiLoanToken, loanTokenRBTC);
    this.contractTokenSUSD = new web3.eth.Contract(abiTestToken, testTokenSUSD);
    this.contractTokenRBTC = new web3.eth.Contract(abiTestToken, testTokenRBTC);
    const accounts = await web3.eth.getAccounts();
    this.web3 = web3;
    this._isMounted && this.setState({ account: accounts[0] });
  }





  /**
   * parse the marginTrade event log
   * events[5] = position size
   * events[9] = entry price
   *
  parseLog(txHash, abi) {
    console.log("parsing log");
    return new Promise(resolve => {
      this.web3.eth.getTransactionReceipt(txHash, function(e, receipt) {
        const decodedLogs = abiDecoder.decodeLogs(receipt.logs);
        console.log(decodedLogs);

        for(let i=0;i<decodedLogs.length;i++) {
          if(decodedLogs[i] && decodedLogs[i].events) {
            if(decodedLogs[i].events[5]!=null && decodedLogs[i].events[9]!=null) {
            const posP = parseFloat(web3utils.fromWei(decodedLogs[i].events[5].value, 'ether')).toFixed(4);
            const entryP = parseFloat(web3utils.fromWei(decodedLogs[i].events[9].value, 'ether')).toFixed(4);
            return resolve([posP, entryP]);
            }
          }
        }
        resolve([0,0]);
      });
    });
  }



*/
