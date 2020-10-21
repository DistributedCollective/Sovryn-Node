/**
 * Wallet token approvals
 * These approvals should be executed for every liquidator and arbitrage wallet once in order for liquidation or interacting with the 
 * Swap contract can work flawlessly
*/
import conf from '../config/config_testnet';
import C from '../controller/contract';
import W from '../secrets/accounts';
C.init(conf);


const amount = C.web3.utils.toWei("1000000000", 'ether');


approveArbitrageWallets();
//approveLiquidatorWallets();


async function approveLiquidatorWallets() {
    console.log("start")
    await C.addWallets(W.liquidator);

    const from = W.liquidator[1].adr.toLowerCase();
    let approved;

    //should approve the Sovryn contract to spend RBTC for the main account
    console.log("approving " + from + " " + conf.sovrynProtocolAdr + " for " + amount)
    approved = await C.approveToken(C.contractTokenRBTC, from, conf.sovrynProtocolAdr, amount);
    console.log(approved);


    //should approve the Sovryn contract to spend SUSD (doc) for the main account
    console.log(from + " approving " + conf.sovrynProtocolAdr + " for " + amount)

    approved = await C.approveToken(C.contractTokenSUSD, from, conf.sovrynProtocolAdr, amount);
    console.log(approved);

    //should approve the rBTC IToken contract to spend sUSD (doc) for the main account
    approved = await C.approveToken(C.contractTokenSUSD, from, conf.loanTokenRBTC, amount);
    console.log(approved);


    //should approve the rBTC IToken contract to spend rBTC for the main account
    //approved = await C.approveToken(C.contractTokenRBTC, from, conf.loanTokenRBTC, amount);
    //console.log(approved);

    //should approve the sUSD IToken contract to spend rBTC for the main account
    //approved = await C.approveToken(C.contractTokenRBTC, from, conf.loanTokenSUSD, amount);
    //console.log(approved);

    //should approve the sUSD IToken contract to spend sUSD (doc) for the main account
    approved = await C.approveToken(C.contractTokenSUSD, from, conf.loanTokenSUSD, amount);
    console.log(approved);
}


async function approveArbitrageWallets() {
    console.log("start")
    await C.addWallets([W.arbitrage]);

    const from = W.arbitrage.adr.toLowerCase();
    let approved;

    //should approve the swap network contract (conf.swapsImpl) to spend Doc for the main account
    console.log("approving " + from + " " + conf.sovrynProtocolAdr + " for " + amount)
    //approved = await C.approveToken(C.contractTokenSUSD, from, conf.swapsImpl, amount);
    //console.log(approved);

    //should approve the swap network contract to spend WrBTC for the main account
    approved = await C.approveToken(C.contractTokenRBTC, from, conf.swapsImpl, amount);
    console.log(approved);
}