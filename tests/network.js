/**
 * Testing local/remote node accessibility
 */

import Web3 from 'web3';

let web3 = new Web3('https://mainnet2.sovryn.app/rpc');
let web3S = new Web3('wss://mainnet2.sovryn.app/ws');
let web3Iov = new Web3('https://public-node.testnet.rsk.co');

async function t() {
    
    const b = await web3.eth.getBlockNumber();
    const s = await web3S.eth.getBlockNumber();
    const i = await web3Iov.eth.getBlockNumber();
    console.log(new Date(Date.now())+ " processing blocks: rpc "+b+", wss: "+s+"  iov: "+i);
}

setInterval(()=> {
    t();    
},1000)

 

