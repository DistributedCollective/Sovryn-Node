import "@nomiclabs/hardhat-waffle";
import "@tenderly/hardhat-tenderly";
import {task} from "hardhat/config";
import {addressType, loadAccountFromKeystoreOrPrivateKeyPath} from './hardhat-utils';

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
    await new Promise((resolve) => setTimeout(resolve, 5000));

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

    const Watcher = await hre.ethers.getContractFactory('Watcher', owner);
    const watcher = Watcher.attach(args.watcher);

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


export default {
  solidity: {
    compilers: [
      {
        version: "0.8.6",
      },
      //{
      //  version: "0.7.3",
      //},
      {
        version: "0.5.17",
      },
    ]
  },
  networks: {
    hardhat: {},
    // NOTE: hardhat-tenderly wants the networks like this for verification to work (it's a bit silly)
    "rsk": {
      url: "https://mainnet2.sovryn.app/rpc",
      network_id: 30,
      confirmations: 4,
      gasMultiplier: 1.25,
    },
    "rsk-testnet": {
      url: "https://testnet.sovryn.app/rpc",
      network_id: 31,
    },
  },
};

