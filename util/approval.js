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
import wallets from '../secrets/accounts';

const web3 = new Web3(conf.nodeProvider);
const tokenContracts = tokensDictionary[conf.network]
const amount = C.web3.utils.toWei("1000000000", 'ether');

//Add wallets to web3, so they are ready for sending transactions
for(let w in wallets) for (let a of wallets[w]) {
    let pKey = a.pKey?a.pKey:web3.eth.accounts.decrypt(a.ks, process.argv[3]).privateKey;
    web3.eth.accounts.wallet.add(pKey);
}

setTimeout(()=> {
approve();
},2000);

async function approve() {
    await approveLiquidatorWallets();
    await approveArbitrageWallets();
    await approveRolloverWallets();
}


async function approveLiquidatorWallets() {
    console.log("start approving liquidator wallets")

    for (let w in W.liquidator) {
        const from = W.liquidator[w].adr.toLowerCase();
        let approved;
        let tokenContract;

        for (let tokenContractAddress in tokenContracts) {
            if (tokenContract === conf.wRbtcWrapper) tokenContract = new web3.eth.Contract(abiRBTCWrapperProxy, tokenContractAddress);
            else tokenContract = new web3.eth.Contract(abiTestToken, tokenContractAddress);

            //should approve the Sovryn contract to spend the token for the main account
            console.log("approving " + from + " " + conf.sovrynProtocolAdr + " for " + amount + " " + tokenContracts[tokenContractAddress])
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
    let tokenContract;

    for (let tokenContractAddress in tokenContracts) {
        if (tokenContract === conf.wRbtcWrapper) tokenContract = new web3.eth.Contract(abiRBTCWrapperProxy, tokenContractAddress);
        else tokenContract = new web3.eth.Contract(abiTestToken, tokenContractAddress);
        
        //should approve the swap network contract (conf.swapsImpl) to spend the token for the main account
        console.log("approving " + from + " " + conf.sovrynProtocolAdr + " for " + amount + " " + tokenContracts[tokenContractAddress])
        approved = await C.approveToken(tokenContract, from, conf.swapsImpl, amount);
        console.log(approved);

        if (tokenContract !== conf.wRbtcWrapper) {
            //should approve the wRBTC wrapper contract to spend the token for the main account
            approved = await C.approveToken(tokenContract, from, conf.wRbtcWrapper, amount);
            console.log(approved);
        }
    }
}


async function approveRolloverWallets() {
    console.log("start approving rollover wallets")

    for (let w in W.rollover) {
        const from = W.rollover[w].adr.toLowerCase();
        let approved;
        let tokenContract;

        for (let tokenContractAddress in tokenContracts) {
            if (tokenContract === conf.wRbtcWrapper) tokenContract = new web3.eth.Contract(abiRBTCWrapperProxy, tokenContractAddress);
            else tokenContract = new web3.eth.Contract(abiTestToken, tokenContractAddress);

            //should approve the Sovryn contract to spend the token for the main account
            console.log("approving " + from + " " + conf.sovrynProtocolAdr + " for " + amount + " " + tokenContracts[tokenContractAddress])
            approved = await C.approveToken(tokenContract, from, conf.sovrynProtocolAdr, amount);
            console.log(approved);
        }
    }
}