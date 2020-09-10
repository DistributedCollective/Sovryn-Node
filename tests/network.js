/**
 * Testing local node accessibility
 */

import Web3 from 'web3';
import conf from '../config/config_testnet';

let web3 = new Web3(conf.nodeProvider);
let web3S = new Web3('ws://127.0.0.1:4445/websocket');


async function t() {
    const b = await web3.eth.getBlockNumber();
    console.log(new Date(Date.now())+ " processing block http "+b);

    const s = await web3S.eth.getBlockNumber();
    console.log(new Date(Date.now())+ " processing block ws local "+s);
}

setInterval(()=> {
    t();    
},1000)

 

