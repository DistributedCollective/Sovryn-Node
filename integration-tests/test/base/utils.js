import C from '../../../controller/contract';
const { BN } = require("@openzeppelin/test-helpers");
import abiTestToken from '../../../config/abiTestToken';

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