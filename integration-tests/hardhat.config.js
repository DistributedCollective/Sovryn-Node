require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-web3");
const truffleConfig = require('./truffle-config');

// monkey-patch these at the earliest opportunity, otherwise initializing controller/Contract.js
// will fail if you have "ks" anywhere
import accounts from '../secrets/accounts';
accounts.liquidator = [];
accounts.rollover = [];
accounts.arbitrage = [];

// monkey-patch these too, to be sure.
import conf from '../config/config';
conf.nodeProvider = 'http://example.invalid';
conf.publicNodeProvider = 'http://example.invalid';
conf.errorBotTelegram = undefined;

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.4.26",
      },
      {
        version: "0.5.16",
      },
      {
        version: "0.5.17",
      },
    ]
  },
  paths: {
    // Contracts are copied from oracle-based-amm and sovryn-smart-contracts to this directory
    sources: './contracts',
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
  mocha: truffleConfig.mocha
};
