/**
 * Utility functions to prepare wallets
 */

import Web3 from 'web3';
import conf from '../config/config_testnet';
import A from '../secrets/accounts';
import abiDocToken from '../config/abiTestToken';

var web3 = new Web3(conf.nodeProvider);
var docContract = new web3.eth.Contract(abiDocToken, conf.docToken);


function createAccount(nr) {
    for(let i=0;i<nr;i++) {
        var account = web3.eth.accounts.create();
        let out = {adr: account.address, pKey:account.privateKey};
        //console.log(out);
        console.log("'"+account.address.toLowerCase()+"',");
    }
}

async function transfer(from, to, amount) {
    console.log(from);
    await web3.eth.accounts.wallet.add(from.pKey);

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

createAccount(110);
//transfer(A.owner[1], A.arbitrage[0].adr, "0.2");
//transferToken(A.liquidator[2], A.liquidator[1].adr, "20");

