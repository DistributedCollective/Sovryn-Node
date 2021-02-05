
import Web3 from 'web3';
import conf from '../config/config';
import wallets from '../secrets/accounts';
var web3 = new Web3(conf.nodeProvider);



for(let w in wallets) for (let a of wallets[w]) {
    const ks = web3.eth.accounts.encrypt(a.pKey, "pass");
    console.log(ks);
}

//let r = web3.eth.accounts.decrypt(ks, p);
//console.log(r);
