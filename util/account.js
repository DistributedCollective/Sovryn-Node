/**
 * Utility functions to prepare wallets
 */

import Web3 from 'web3';
import conf from '../config/config_mainnet';
import A from '../secrets/accounts';
import abiDocToken from '../config/abiTestToken';

//var web3 = new Web3(conf.nodeProvider);
var web3 = new Web3("https://public-node.rsk.co");
var docContract = new web3.eth.Contract(abiDocToken, conf.docToken);


function createAccount(nr) {
    for(let i=0;i<nr;i++) {
        var account = web3.eth.accounts.create();
        console.log(account);
    }
}

async function transfer(from, to, amount) {
    console.log(from);
    web3.eth.accounts.wallet.add(from.pKey);

    let res = await web3.eth.sendTransaction({
        to: to,
        from: from.adr,
        value: web3.utils.toWei(amount, "ether"),
        gas: 22000
    });
    console.log(res);
}

async function transferToken(from, to, val) {
    let amount = web3.utils.toWei(val, "ether")
    try {    
        const signedTx = await web3.eth.accounts.signTransaction({
            from: from.adr,
            to: conf.docToken,
            data: docContract.methods.transfer(to, amount).encodeABI(),
            gas: "200000"
        }, from.pKey);
        const res = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    } catch (e) {
        console.log(e);
    }
}

//createAccount(1);
transfer(A.liquidator[0], A.liquidator[1].adr, "0.00005");
//transferToken(A.liquidator[2], A.liquidator[1].adr, "20");