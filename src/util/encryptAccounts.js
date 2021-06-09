/**
 * Prints a version of accounts with keystores instead of private keys
 */
import accounts from '../secrets/accounts';
import C from '../controller/contract';
const readline = require("readline");

function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Password: ', (password) => {
        encryptAccounts(password);
        rl.close();
    });
}

function encryptAccounts(password) {
    const web3 = C.web3;
    const newAccounts = {liquidator: [], rollover: [], arbitrage: []};
    for(let type of ['liquidator', 'rollover', 'arbitrage']) {
        for(let i = 0; i < accounts[type].length; i++) {
            const account = accounts[type][i];
            console.log(`${type} ${i}: ${account.adr}`)
            if(account.ks) {
                console.log('Account already has configured keystore');
                newAccounts[type].push({
                    adr: account.adr,
                    ks: account.ks,
                });
            } else if(!account.pKey) {
                console.log('No private key');
            } else {
                const encrypted = web3.eth.accounts.encrypt(account.pKey, password);
                newAccounts[type].push({
                    adr: account.adr,
                    ks: encrypted,
                });
            }
        }
    }

    console.log('export default ' + JSON.stringify(newAccounts, null, 4));

    // Testing only:
    //for(let type of ['liquidator', 'rollover', 'arbitrage']) {
    //    for (let account of newAccounts[type]) {
    //        const decrypted = web3.eth.accounts.decrypt(account.ks, password);
    //        console.log(account.adr, decrypted);
    //    }
    //}
}

if(require.main === module) {
    main();
}


