import Web3 from 'web3';
import conf from '../config/config_testnet';

let web3 = new Web3(conf.nodeProvider);

async function t() {
    const b = await web3.eth.getBlockNumber();
    console.log(new Date(Date.now())+ " processing block "+b);
}

setInterval(()=> {
    t();  
},1000)
