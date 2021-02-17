/**
 * Wallet token approvals
 * These approvals should be executed for every liquidator and arbitrage wallet once in order for liquidation or interacting with the 
 * Swap contract can work flawlessly
*/
import Web3 from 'web3';
import C from '../controller/contract';
import W from '../secrets/accounts';
import tokensDictionary from '../config/tokensDictionary.json'
import abiTestToken from '../config/abiTestToken';
import abiRBTCWrapperProxy from '../config/abiRBTCWrapperProxy';
import conf from '../config/config';

const web3 = new Web3(conf.nodeProvider);
const tokenContracts = Object.keys(tokensDictionary[conf.network])
const amount = C.web3.utils.toWei("1000000000", 'ether');

setTimeout(()=> {
approve();
},2000);

async function approve() {
    await approveLiquidatorWallets();
    await approveArbitrageWallets();
}


async function approveLiquidatorWallets() {
    console.log("start approving liquidator wallets")

    for (let w in W.liquidator) {
        const from = W.liquidator[w].adr.toLowerCase();
        let approved;

        for (let tokenContract in tokenContracts) {
            if (tokenContract !== C.contractTokenRBTC) tokenContract = new web3.eth.Contract(abiRBTCWrapperProxy, tokenContract.toLowerCase());
            else tokenContract = new web3.eth.Contract(abiTestToken, tokenContract.toLowerCase());

            //should approve the Sovryn contract to spend the token for the main account
            console.log("approving " + from + " " + conf.sovrynProtocolAdr + " for " + amount)
            approved = await C.approveToken(tokenContract, from, conf.sovrynProtocolAdr, amount);
            console.log(approved);
        }
 
        //should approve the rBTC IToken contract to spend sUSD (doc) for the main account
        //only needed for opening positions (tests)
        //approved = await C.approveToken(C.contractTokenSUSD, from, conf.loanTokenRBTC, amount);
        //console.log(approved);

        //only needed for opening positions (tests)
        //should approve the rBTC IToken contract to spend rBTC for the main account
        //approved = await C.approveToken(C.contractTokenRBTC, from, conf.loanTokenRBTC, amount);
        //console.log(approved);

        //only needed for opening positions (tests)
        //should approve the sUSD IToken contract to spend rBTC for the main account
        //approved = await C.approveToken(C.contractTokenRBTC, from, conf.loanTokenSUSD, amount);
        //console.log(approved);

        //should approve the sUSD IToken contract to spend sUSD (doc) for the main account
        //only needed for opening positions (tests)
        //approved = await C.approveToken(C.contractTokenSUSD, from, conf.loanTokenSUSD, amount);
        //console.log(approved);
    }
    return;
}


async function approveArbitrageWallets() {
    console.log("start approving arbitrage wallet")

    const from = W.arbitrage[0].adr.toLowerCase();
    let approved;

    for (let tokenContract in tokenContracts) {
        tokenContract = new web3.eth.Contract(abiTestToken, tokenContract.toLowerCase());
        //should approve the swap network contract (conf.swapsImpl) to spend the token for the main account
        console.log("approving " + from + " " + conf.sovrynProtocolAdr + " for " + amount)
        approved = await C.approveToken(tokenContract, from, conf.swapsImpl, amount);
        console.log(approved);

        if (tokenContract !== C.contractTokenRBTC) {
            //should approve the wRBTC wrapper contract to spend the token for the main account
            approved = await C.approveToken(tokenContract, from, conf.wRbtcWrapper, amount);
            console.log(approved);
        }
    }
}