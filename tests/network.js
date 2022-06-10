/**
 * Testing local/remote node accessibility
 */

import Web3 from 'web3';
import C from '../controller/contract';

let web3Private = new Web3('http://0.0.0.0/');
let web3Private2 = new Web3('http://0.0.0.0');
let web3S = new Web3('https://mainnet.sovryn.app/rpc');
let web3Iov = new Web3('https://public-node.testnet.rsk.co');

const sampleWallets = [
    '0xA3687E68EB2038556bCA01C50CD982aD87b86F42',
    '0xa669e3ea4aca96231ce8cdd563a0b23f6538a312',
    '0xf7e11fdd5f388673333243f6c8612dddf7489e09',
    '0xf24a017b59bbe74b262a01976097f4ea102c7b14'
];

const sampleTxs = [
    '0xa588ec0c3af24371290e96ee710739018a28472f0292d21badd74de2eb919d63',
    '0xb05005d190756c4dc33ea5456c0ebcf450b714007c78eeec587ba32af55fabb5',
    '0x6e54d497c0546154a8101c74eb6bee2af687d21f2df83f558e5dce466dacc2bf',
    '0xfedf35980050138c80384455aecf40ad8fb95ccd55edc74ab573e15d8a8c7fdb',
];

(async () => {
    await test(web3Private, 20);
    await test(web3Private2, 20);
    await test(web3S, 20);
    await test(web3Iov, 20);
})();


async function test(web3, nrTests = 10) {
    const spendingTimes = {
        getBlock: [],
        getBalance: [],
        getOpenPos: [],
        getTxLog: []
    };

    for (let i = 0; i < nrTests; i++) {
        console.log('# Test', i+1);
        
        const s1 = await testGetBlockNr(web3);
        spendingTimes.getBlock.push(s1);
        console.log(`   * Get Block: ${fSeconds(s1)}, avg: ${avgSeconds(spendingTimes.getBlock)}`);
        console.log();

        console.log('   * Get Balance');
        for (const adr of sampleWallets) {
            const s2 = await testGetBalance(web3, adr);
            spendingTimes.getBalance.push(s2);
            console.log(`       - Balance ${adr}: ${fSeconds(s2)}`);
        }
        console.log(`      avg: ${avgSeconds(spendingTimes.getBalance)}\n`);

        const s3 = await testLoadOpenPositions(web3);
        spendingTimes.getOpenPos.push(s3);
        console.log(`   * Get 100 Open positions: ${fSeconds(s3)}, avg: ${avgSeconds(spendingTimes.getOpenPos)}`);
        console.log();

        console.log('   * Get Tx Logs:')
        for (const i in sampleTxs) {
            const hash = sampleTxs[i];
            const s4 = await testTxLog(web3, hash);
            spendingTimes.getTxLog.push(s4);
            console.log(`      - Tx Log #${i}: ${fSeconds(s4)}, avg: ${avgSeconds(spendingTimes.getTxLog)}`);
        }
        console.log(`      avg: ${avgSeconds(spendingTimes.getTxLog)}\n`);
    }

    console.log(`avg Get Block: ${avgSeconds(spendingTimes.getBlock)}`);
    console.log(`avg Get Balance: ${avgSeconds(spendingTimes.getBalance)}`);
    console.log(`avg Get 100 Open Pos: ${avgSeconds(spendingTimes.getOpenPos)}`);
    console.log(`avg Get Tx Log: ${avgSeconds(spendingTimes.getTxLog)}`);
    console.log("==========================\n")

}

const fSeconds = (ms) => (ms/1000).toFixed(3) + ' seconds';
const avgSeconds = (list) => fSeconds(list.reduce((e, t) => t + e, 0) / list.length);

async function testGetBlockNr(web3) {
    const start = Date.now();
    await web3.eth.getBlockNumber();
    return Date.now() - start;
}

async function testGetBalance(web3, adr) {
    const start = Date.now();
    await web3.eth.getBalance(adr);
    return Date.now() - start;
}

async function testTxLog(web3, hash) {
    const start = Date.now();
    await web3.eth.getTransactionReceipt(hash);
    return Date.now() - start;
}

async function testLoadOpenPositions(web3, count = 100) {
    const start = Date.now();
    await C.contractSovryn.methods.getActiveLoans(0, count, false).call();
    return Date.now() - start;
}

 

