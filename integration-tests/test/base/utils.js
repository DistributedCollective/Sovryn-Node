import C from '../../../controller/contract';
const { BN } = require("@openzeppelin/test-helpers");
import abiTestToken from '../../../config/abiTestToken';
import {ether} from "@openzeppelin/test-helpers";

export async function transferAlmostAllRbtc({
    from,
    to,
    desiredRbtcBalance = ether('0.001'),
    increment,
}) {
    if(!increment) {
        increment = BN.min(
            desiredRbtcBalance.div(new BN('10')),
            new BN('100')
        );
    }
    //const gas = 0.0001 * 100000000;
    const gas = 21000; // minimum possible gas price, OK for hardhat

    // do a big transaction first
    // for whatever reason, this will fail if we try to transfer too much RBTC away at first
    // (Error: Returned error: sender doesn't have enough funds to send tx. The upfront cost is:
    // 99999999999998658496000000000 and the sender's account only has: 99999999999998590496000000000)
    let rbtcBalance = new BN(await web3.eth.getBalance(from));
    //const initialRbtcLeft = ether('0.1');
    const initialRbtcLeft = ether('0.01')
    if(rbtcBalance.gt(initialRbtcLeft)) {
        await web3.eth.sendTransaction({
            to,
            value: rbtcBalance.sub(initialRbtcLeft),
            from,
            gas,
        });
    }

    // do a lot of small transactions after that
    let i = 0;
    while(true) {
        rbtcBalance = new BN(await web3.eth.getBalance(from));
        //console.log(`RBTC balance #${i}: ${web3.utils.fromWei(rbtcBalance)}`);
        if(rbtcBalance.lte(desiredRbtcBalance)) {
            return rbtcBalance;
        }
        try {
            await web3.eth.sendTransaction({
                to,
                value: increment,
                from,
                gas,
            });
        } catch(e) {
            //console.log('cannot send away more RBTC -> breaking');
            return rbtcBalance;
        }
        i++;
    }
}

export async function printAccountDetails({
    accounts = [],
    tokenAddresses = [],
}) {
    console.log('ACCOUNT DETAILS');
    for (let tokenAddress of tokenAddresses) {
        let tokenContract = C.getTokenInstance(tokenAddress)
        if(!tokenContract) {
            console.log(` NOTE: Contract not found for token ${tokenAddress} from controller`);
            tokenContract = new C.web3.eth.Contract(abiTestToken, tokenAddress);
            try {
                const symbol = await tokenContract.methods.symbol().call();
                console.log(`  Token: ${symbol} (${tokenAddress})`);
            } catch (e) {
                // swallow
            }
            return;
        }

        const symbol = await tokenContract.methods.symbol().call();
        console.log(`  Token: ${symbol} (${tokenAddress})`);
        for(let account of accounts) {
            const balance = new BN(await tokenContract.methods.balanceOf(account).call());
            console.log(`    ${symbol}.balanceOf(${account}) = ${balance.toString()}`);
        }
    }
}

export async function findContract(contractMap, address) {
    for (let [ name, contract ] of Object.entries(contractMap)) {
        //console.log(`Checking ${name}`)

        //if (Array.isArray(contract)) {
        //    const tmpMap = {};
        //    contract.forEach((c, i) => {
        //        tmpMap[`${name}[${i}]`] = c;
        //    })
        //    const tmp = findContract(tmpMap, address);
        //    if (tmp) {
        //        return tmp;
        //    }
        //    continue;
        //}
        let contractAddress;
        if (typeof contract === "string") {
            contractAddress = contract;
        } else if (contract.address) {
            contractAddress = contract.address;
        } else {
            //if (typeof contract === 'object') {
            //    const tmpMap = {};
            //    for(let [tmpName, tmpValue] of Object.entries(contract)) {
            //        tmpMap[`${name}.${tmpName}`] = tmpValue;
            //    }
            //    const tmp = findContract(tmpMap, address);
            //    if (tmp) {
            //        return tmp;
            //    }
            //}
            continue;
        }
        if (contractAddress.toLowerCase() === address.toLowerCase()) {
            console.log(`Contract for ${address} is ${name}`);
            return contract;
        }
    }
    //console.log(`Contract not found for ${address}`);
    return null;
}