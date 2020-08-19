import Web3 from 'web3';
import Rsk3 from '@rsksmart/rsk3';

let web3 = new Web3('http://18.138.223.132:4444');
let rsk3 = new Rsk3('http://18.138.223.132:4444');
      

async function t() {
    const b = await web3.eth.getBlockNumber();
    console.log(new Date(Date.now())+ " processing block eth "+b);

    //const c = await rsk3.getBlockNumber();
    //console.log(new Date(Date.now())+ " processing block rsk "+c);
}

setInterval(()=> {
    t();  
},1000)




//curl http://18.138.223.132:4444 -X POST -H "Content-Type: application/json"  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'
//curl http://13.251.148.208:4444 -X POST -H "Content-Type: application/json"  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
//curl http://18.138.223.132:4444 -X POST -H "Content-Type: application/json"  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

//curl http://localhost:4444 -X POST -H "Content-Type: application/json"  --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xe2b59CD37D173D550D75e9891376bf21b3f996F1"],"id":1}'