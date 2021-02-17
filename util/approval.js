/**
 * Wallet token approvals
 * These approvals should be executed for every liquidator and arbitrage wallet once in order for liquidation or interacting with the 
 * Swap contract can work flawlessly
*/
import conf from '../config/config';
import C from '../controller/contract';
import W from '../secrets/accounts';


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

        //should approve the Sovryn contract to spend RBTC for the main account
        console.log("approving " + from + " " + conf.sovrynProtocolAdr + " for " + amount)
        approved = await C.approveToken(C.contractTokenRBTC, from, conf.sovrynProtocolAdr, amount);
        console.log(approved);

        //should approve the Sovryn contract to spend SUSD (doc) for the main account
        console.log(from + " approving " + conf.sovrynProtocolAdr + " for " + amount)
        approved = await C.approveToken(C.contractTokenSUSD, from, conf.sovrynProtocolAdr, amount);
        console.log(approved);

        //should approve the Sovryn contract to spend USDT for the main account
        console.log(from + " approving " + conf.sovrynProtocolAdr + " for " + amount)
        approved = await C.approveToken(C.contractTokenUSDT, from, conf.sovrynProtocolAdr, amount);
        console.log(approved);

        //should approve the Sovryn contract to spend BPRO for the main account
        console.log(from + " approving " + conf.sovrynProtocolAdr + " for " + amount)
        approved = await C.approveToken(C.contractTokenBPRO, from, conf.sovrynProtocolAdr, amount);
        console.log(approved);
 
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

    //should approve the swap network contract (conf.swapsImpl) to spend Doc for the main account
    console.log("approving " + from + " " + conf.sovrynProtocolAdr + " for " + amount)
    approved = await C.approveToken(C.contractTokenSUSD, from, conf.swapsImpl, amount);
    console.log(approved);

    //should approve the swap network contract to spend WrBTC for the main account
    approved = await C.approveToken(C.contractTokenRBTC, from, conf.swapsImpl, amount);
    console.log(approved);

    //should approve the wRBTC wrapper contract to spend Doc for the main account
    approved = await C.approveToken(C.contractTokenSUSD, from, conf.wRbtcWrapper, amount);
    console.log(approved);

    //should approve the wRBTC wrapper contract to spend USDT for the main account
    approved = await C.approveToken(C.contractTokenUSDT, from, conf.wRbtcWrapper, amount);
    console.log(approved);

    //should approve the swap network contract to spend USDT for the main account
    approved = await C.approveToken(C.contractTokenUSDT, from, conf.swapsImpl, amount);
    console.log(approved);

    //should approve the swap network contract to spend USDT for the main account
    approved = await C.approveToken(C.contractTokenBPRO, from, conf.swapsImpl, amount);
    console.log(approved);
}