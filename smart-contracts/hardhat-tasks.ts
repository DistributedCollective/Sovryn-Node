import {task} from "hardhat/config";
import {addressType, FauxRBTC, loadAccountFromKeystoreOrPrivateKeyPath, sleep} from './hardhat-utils';
import erc20Abi from "./misc/erc20Abi.json";

task("accounts", "Prints the list of accounts", async (args, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

// TODO: consider using hardhat-deploy: https://hardhat.org/plugins/hardhat-deploy.html
task("deploy-watcher", "Deploys the Watcher contract")
    .addParam('sovrynProtocol', 'Main sovryn protocol contract address', undefined, addressType)
    .addParam('sovrynSwapNetwork', 'Swaps contract address', undefined, addressType)
    .addParam('priceFeeds', 'PriceFeeds contract address', undefined, addressType)
    .addParam('wrbtcToken', 'WRBTC token contract address', undefined, addressType)
    .addFlag('verify', 'Verify on tenderly')
    .addOptionalParam('keystore', 'Path to keystore file for deployer')
    .addOptionalParam('privateKey', 'Path to private key file for deployer')
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const {
            sovrynProtocol,
            sovrynSwapNetwork,
            priceFeeds,
            wrbtcToken,
            verify,
        } = args;

        const deployer = await loadAccountFromKeystoreOrPrivateKeyPath(args.keystore, args.privateKey, hre.ethers.provider);

        console.log('Deployer:', deployer.address);

        console.log("Compiling contracts")
        await hre.run("compile");
        const Watcher = await ethers.getContractFactory('Watcher', deployer);

        console.log('Deploying in 5s with args...')
        console.log({
            sovrynProtocol,
            sovrynSwapNetwork,
            priceFeeds,
            wrbtcToken,
        });
        await sleep(5000);

        console.log('Deploying!')
        const watcher = await Watcher.deploy(sovrynProtocol, sovrynSwapNetwork, priceFeeds, wrbtcToken);

        console.log(watcher);
        console.log('Deployed! Address:', watcher.address);

        if (verify) {
            console.log('Verifying contract on Tenderly...')
            await hre.tenderly.verify({
                name: 'Watcher',
                address: watcher.address,
            });
        }
    });


task('watcher-role', 'Adds roles to accounts on watcher')
    .addPositionalParam('action', 'add/remove/check')
    .addParam('watcher', 'Watcher contract address', undefined, addressType)
    .addParam('account', 'Account to add the role to', undefined, addressType)
    .addParam('role', 'name of role')
    .addOptionalParam('keystore', 'Path to keystore file for owner')
    .addOptionalParam('privateKey', 'Path to private key file for owner')
    .setAction(async (args, hre) => {
        const {
            action,
            account,
        } = args;
        if (['add', 'remove', 'check'].indexOf(action) === -1) {
            throw new Error(`invalid action: ${action}`)
        }
        const role = args.role.toUpperCase();
        if (['OWNER', 'EXECUTOR'].indexOf(role) === -1) {
            throw new Error(`invalid role: ${role}`);
        }

        const owner = await loadAccountFromKeystoreOrPrivateKeyPath(args.keystore, args.privateKey, hre.ethers.provider);

        if (action === 'remove' && role === 'OWNER' && (account.toLowerCase() === owner.address.toLowerCase())) {
            throw new Error('cannot remove the owner role from myself!');
        }

        //const Watcher = await hre.ethers.getContractFactory('Watcher', owner);
        //const watcher = Watcher.attach(args.watcher);
        const watcher = await hre.ethers.getContractAt('Watcher', args.watcher, owner);

        console.log(`${action} role ${role} for ${account}`);
        const roleHash = await watcher[`ROLE_${role}`]();
        console.log('role hash:', roleHash);
        const hasRole = await watcher.hasRole(roleHash, account);
        console.log('has role:', hasRole)

        let tx;
        if (action === 'add') {
            if (hasRole) {
                console.log('account already has the role, not adding');
                return;
            }
            console.log('adding role...');
            tx = await watcher.grantRole(roleHash, account);
        } else if (action === 'remove') {
            if (!hasRole) {
                console.log('account does not have the role, not removing');
                return;
            }
            console.log('removing role...');
            tx = await watcher.revokeRole(roleHash, account);
        } else {
            return;
        }
        console.log('tx hash:', tx.hash);
        console.log('waiting for tx...')
        await tx.wait();
        console.log('all done');
    });


task('fund-watcher', 'withdraw/deposit/check token status')
    .addPositionalParam('action', 'withdraw/deposit/check')
    .addParam('watcher', 'Watcher contract address', undefined, addressType)
    .addParam('token', 'Token address', undefined, addressType)
    .addOptionalParam('recipient', 'recipient of withdrawn funds (default sender)', undefined, addressType)
    .addOptionalParam('amount', 'decimal amount in human-readable units (ie 1.2 RBTC)')
    .addOptionalParam('keystore', 'Path to keystore file for owner')
    .addOptionalParam('privateKey', 'Path to private key file for owner')
    .setAction(async (args, hre) => {
        const { action } = args;
        const { ethers } = hre;
        if (['withdraw', 'deposit', 'check'].indexOf(action) === -1) {
            throw new Error(`invalid action: ${action}`)
        }

        if (!args.amount && action !== 'check') {
            throw new Error('amount must be given if action is not "check"');
        }

        const owner = await loadAccountFromKeystoreOrPrivateKeyPath(args.keystore, args.privateKey, ethers.provider);
        const watcher = await ethers.getContractAt('Watcher', args.watcher, owner);
        const rbtcAddress = await watcher.RBTC_ADDRESS();

        let token;
        if (args.token === rbtcAddress) {
            console.log('Token is RBTC, special logic applies')
            token = new FauxRBTC(rbtcAddress, ethers.provider);
        } else {
            token = await ethers.getContractAt(erc20Abi, args.token, owner);
        }

        const symbol = await token.symbol();
        const decimals = await token.decimals();
        console.log(`Token ${symbol} (${token.address}) with ${decimals} decimals`);

        const currentWatcherBalanceWei = await token.balanceOf(watcher.address);
        const currentWatcherBalance = hre.ethers.utils.formatUnits(currentWatcherBalanceWei, decimals)
        console.log(`Current watcher (${watcher.address}) balance: ${currentWatcherBalance} ${symbol} (${currentWatcherBalanceWei} Wei)`);

        const currentAccountBalanceWei = await token.balanceOf(owner.address);
        const currentAccountBalance = hre.ethers.utils.formatUnits(currentAccountBalanceWei, decimals)
        console.log(`Current account (${owner.address}) balance: ${currentAccountBalance} ${symbol} (${currentAccountBalanceWei} Wei)`);

        if (action === 'check') {
            return;
        }

        const amountWei = hre.ethers.utils.parseUnits(args.amount, decimals);
        console.log(`${action} ${args.amount} ${symbol} (${amountWei} Wei)`);

        // allow panicked users to Ctrl-C here
        await sleep(2000);

        let tx;
        if (action === 'withdraw') {
            const recipient = args.recipient || owner.address;
            console.log(`Withdrawing tokens to ${recipient}`);
            // for some reason, it underestimates the gas for RBTC withdrawal...
            const opts = (token.address === rbtcAddress) ? {gasLimit: 100000} : {};
            tx = await watcher.withdrawTokens(token.address, amountWei, recipient, opts);
        } else if (action === 'deposit') {
            if (token.address === rbtcAddress) {
                console.log('Depositing RBTC...');
                tx = await watcher.depositTokens(token.address, amountWei, { value: amountWei });
            } else {
                const currentAllowanceWei = await token.allowance(owner.address, watcher.address);
                if (currentAllowanceWei.lt(amountWei)) {
                    console.log(`Approving watcher to spend ${args.amount} ${symbol}...`)
                    const approvalTx = await token.approve(watcher.address, amountWei);
                    console.log(`Approval tx hash: ${approvalTx.hash}, waiting for confirmation...`);
                    await approvalTx.wait();
                    console.log('Approval done.')
                }
                console.log('Depositing tokens...');
                tx = await watcher.depositTokens(token.address, amountWei);
            }
        } else {
            throw new Error('should not get here');
        }

        console.log(`${action} tx hash:`, tx.hash);
        console.log('Waiting for confirmation...')
        await tx.wait();
        console.log('All done.');
    });