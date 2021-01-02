/**
 * Wallet token approvals
 * These approvals should be executed for every liquidator and arbitrage wallet once in order for liquidation or interacting with the 
 * Swap contract can work flawlessly
*/
import conf from '../config/config';
import C from '../controller/contract';
import W from '../secrets/accounts';


    let converterDoc = "0xd715192612F03D20BaE53a5054aF530C9Bb0fA3f";
    let converterUsdt = "0x448c2474b255576554EeD36c24430ccFac131cE3";
    let converterBPro = "0x26463990196B74aD5644865E4d4567E4A411e065";
   

start();

async function start() {
    await getInfo();
}


async function getInfo() {
    console.log("Converter Doc")
    let b = await C.contractTokenSUSD.methods.balanceOf(converterDoc.toLowerCase()).call();
    console.log(C.web3.utils.fromWei(b.toString(), "Ether"));
    b = await C.contractTokenRBTC.methods.balanceOf(converterDoc.toLowerCase()).call();
    console.log(C.web3.utils.fromWei(b.toString(), "Ether"));
   
    console.log("Converter Usdt")
    b = await C.contractTokenUSDT.methods.balanceOf(converterUsdt.toLowerCase()).call();
    console.log(C.web3.utils.fromWei(b.toString(), "Ether"));
    b = await C.contractTokenRBTC.methods.balanceOf(converterUsdt.toLowerCase()).call();
    console.log(C.web3.utils.fromWei(b.toString(), "Ether"));
   
    console.log("Converter BPro")
    b = await C.contractTokenBPRO.methods.balanceOf(converterBPro.toLowerCase()).call();
    console.log(C.web3.utils.fromWei(b.toString(), "Ether"));
    b = await C.contractTokenRBTC.methods.balanceOf(converterBPro.toLowerCase()).call();
    console.log(C.web3.utils.fromWei(b.toString(), "Ether"));
   
    return;
}

