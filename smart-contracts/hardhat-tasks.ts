import {task} from "hardhat/config";
import {addressType, FauxRBTC, loadAccountFromKeystoreOrPrivateKeyPath, sleep} from './hardhat-utils';
import erc20Abi from "./misc/erc20Abi.json";
import {BigNumber} from 'ethers';

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
        const { ethers, upgrades } = hre;
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

        console.log('Deploying upgradeable proxy in 5s with args...')
        console.log({
            sovrynProtocol,
            sovrynSwapNetwork,
            priceFeeds,
            wrbtcToken,
        });
        await sleep(5000);

        console.log('Deploying!')
        const watcher = await upgrades.deployProxy(Watcher, [
            sovrynProtocol,
            sovrynSwapNetwork,
            priceFeeds,
            wrbtcToken
        ]);

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

task('set-sovryn-swap-network', 'Update swaps address')
    .addParam('watcher', 'Watcher contract address', undefined, addressType)
    .addParam('swaps', 'new address for swaps')
    .addOptionalParam('keystore', 'Path to keystore file for owner')
    .addOptionalParam('privateKey', 'Path to private key file for owner')
    .setAction(async (args, hre) => {
        const {
            swaps,
        } = args;
        const owner = await loadAccountFromKeystoreOrPrivateKeyPath(args.keystore, args.privateKey, hre.ethers.provider);

        const watcher = await hre.ethers.getContractAt('Watcher', args.watcher, owner);
        const current = await watcher.sovrynSwapNetwork();
        console.log('current address:', current)
        console.log('changing to:    ', swaps)

        // allow panicked users to Ctrl-C here
        await sleep(2000);


        console.log('sending tx...');
        const tx = await watcher.setSovrynSwapNetwork(swaps);
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

        let currentWatcherBalanceWei;
        let watcherBalanceTokenSymbol;
        if (token.address === rbtcAddress) {
            // watcher doesn't store RBTC, get WRBTC balance instead
            const wrbtcToken = await ethers.getContractAt(erc20Abi, await watcher.wrbtcToken(), owner);
            currentWatcherBalanceWei = await wrbtcToken.balanceOf(watcher.address);
            watcherBalanceTokenSymbol = await wrbtcToken.symbol();
        } else {
            currentWatcherBalanceWei = await token.balanceOf(watcher.address);
            watcherBalanceTokenSymbol = symbol;
        }
        const currentWatcherBalance = hre.ethers.utils.formatUnits(currentWatcherBalanceWei, decimals)
        console.log(`Current watcher (${watcher.address}) balance: ${currentWatcherBalance} ${watcherBalanceTokenSymbol} (${currentWatcherBalanceWei} Wei)`);

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
            if (amountWei.gt(currentWatcherBalanceWei)) {
                throw new Error(
                    `withdraw amount ${args.amount} is greater than watcher balance ${currentWatcherBalance}, ` +
                    `cannot withdraw`
                )
            }
            const recipient = args.recipient || owner.address;
            console.log(`Withdrawing tokens to ${recipient}`);
            // for some reason, it underestimates the gas for RBTC withdrawal...
            const opts = (token.address === rbtcAddress) ? {gasLimit: 100000} : {};
            tx = await watcher.withdrawTokens(token.address, amountWei, recipient, opts);
        } else if (action === 'deposit') {
            if (amountWei.gt(currentAccountBalanceWei)) {
                throw new Error(
                    `deposit amount ${args.amount} is greater than account balance ${currentAccountBalance}, ` +
                    `cannot deposit`
                )
            }
            const currentAllowanceWei = await token.allowance(owner.address, watcher.address);
            if (currentAllowanceWei.lt(amountWei)) {
                console.log(`Approving watcher to spend ${args.amount} ${symbol}...`)
                const approvalTx = await token.approve(watcher.address, amountWei);
                console.log(`Approval tx hash: ${approvalTx.hash}, waiting for confirmation...`);
                await approvalTx.wait();
                console.log('Approval done.')
            }
            console.log('Depositing tokens...');
            const opts = (token.address === rbtcAddress) ? { value: amountWei } : {};
            tx = await watcher.depositTokens(token.address, amountWei, opts);
        } else {
            throw new Error('should not get here');
        }

        console.log(`${action} tx hash:`, tx.hash);
        console.log('Waiting for confirmation...')
        await tx.wait();
        console.log('All done.');
    });


task('encode-withdrawal', 'withdraw/deposit/check token status')
    .addParam('watcher', 'Watcher contract address', undefined, addressType)
    .addParam('token', 'Token address', undefined, addressType)
    .addParam('recipient', 'recipient of withdrawn funds (default sender)', undefined, addressType)
    .addParam('amount', 'decimal amount in human-readable units (ie 1.2 RBTC)')
    .setAction(async (args, hre) => {
        const { action, recipient } = args;
        const { ethers } = hre;

        const watcher = await ethers.getContractAt('Watcher', args.watcher);
        const rbtcAddress = await watcher.RBTC_ADDRESS();

        let token;
        if (args.token === rbtcAddress) {
            console.log('Token is RBTC, special logic applies')
            token = new FauxRBTC(rbtcAddress, ethers.provider);
        } else {
            token = await ethers.getContractAt(erc20Abi, args.token);
        }

        const symbol = await token.symbol();
        const decimals = await token.decimals();
        console.log(`Token ${symbol} (${token.address}) with ${decimals} decimals`);

        let currentWatcherBalanceWei;
        let watcherBalanceTokenSymbol;
        if (token.address === rbtcAddress) {
            // watcher doesn't store RBTC, get WRBTC balance instead
            const wrbtcToken = await ethers.getContractAt(erc20Abi, await watcher.wrbtcToken());
            currentWatcherBalanceWei = await wrbtcToken.balanceOf(watcher.address);
            watcherBalanceTokenSymbol = await wrbtcToken.symbol();
        } else {
            currentWatcherBalanceWei = await token.balanceOf(watcher.address);
            watcherBalanceTokenSymbol = symbol;
        }
        const currentWatcherBalance = hre.ethers.utils.formatUnits(currentWatcherBalanceWei, decimals);
        console.log(`Current watcher (${watcher.address}) balance: ${currentWatcherBalance} ${watcherBalanceTokenSymbol} (${currentWatcherBalanceWei} Wei)`);

        const recipientBalanceWei = await token.balanceOf(recipient);
        const recipientBalance = hre.ethers.utils.formatUnits(recipientBalanceWei, decimals);
        console.log(`Recipient (${recipient}) balance: ${recipientBalance} ${symbol} (${recipientBalanceWei} Wei)`);

        const roleHash = await watcher.ROLE_OWNER();
        const hasRole = await watcher.hasRole(roleHash, recipient);
        if (!hasRole) {
            console.warn(`Recipient ${recipient} doesn't have the role OWNER (hash ${roleHash})`);
        }

        const recipientRbtcBalanceWei = await ethers.provider.getBalance(recipient);
        if (recipientRbtcBalanceWei.isZero()) {
            console.warn(`Recipient ${recipient} has no RBTC -- probably don't want to withdraw to it!`)
            return;
        }

        const amountWei = hre.ethers.utils.parseUnits(args.amount, decimals);
        console.log(`encoding withdrawal to ${recipient} of ${args.amount} ${symbol} (${amountWei} Wei)`);

        if (amountWei.gt(currentWatcherBalanceWei)) {
            console.warn(
                `withdraw amount ${args.amount} is greater than watcher balance ${currentWatcherBalance}, ` +
                `it will fail as of now`
            )
        }
        const rawdata = watcher.interface.encodeFunctionData(
            'withdrawTokens',
            [token.address, amountWei, recipient]
        );
        console.log('');
        console.log('raw tx details:');
        console.log('address:', watcher.address);
        console.log('data:', rawdata);
    });
