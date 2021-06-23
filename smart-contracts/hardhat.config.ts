import "@nomiclabs/hardhat-waffle";
import "@tenderly/hardhat-tenderly";
import {task} from "hardhat/config";
import {addressType, loadAccountFromKeystorePath} from './hardhat-utils';

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
  .addParam('deployerKeystore', 'Path to keystore file for deployer')
  .addFlag('verify', 'Verify on tenderly')
  .setAction(async (args, hre) => {
    const { ethers } = hre;
    const {
      sovrynProtocol,
      sovrynSwapNetwork,
      priceFeeds,
      wrbtcToken,
      deployerKeystore,
      verify,
    } = args;

    let deployer = await loadAccountFromKeystorePath(deployerKeystore);
    deployer = deployer.connect(hre.ethers.provider)

    console.log('Deployer:', deployer.address);

    console.log("Compiling contracts")
    await hre.run("compile"); // TODO: re-enable
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

