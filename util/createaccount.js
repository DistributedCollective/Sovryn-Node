import Web3 from 'web3';
import conf from '../config/config_testnet';

var web3 = new Web3(conf.nodeProvider);



function createAccount(nr) {
    for(let i=0;i<nr;i++) {
        var account = web3.eth.accounts.create();
        console.log(account);
    }
}


createAccount(1);
