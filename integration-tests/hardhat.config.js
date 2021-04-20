require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-web3");
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(require('bn.js')))
    .use(require('chai-string'))
    .use(require('dirty-chai'));

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
      accounts: {
        // give a hundred billion RBTC instead of the default 10k RBTC to each address
        // at least we don't run out of RBTC very easily
        accountsBalance: '100 000 000 000 000 000 000 000 000 000'.replace(/ /g, ''),
      },
    },
  },
  mocha: {
    timeout: 600000,
    useColors: true,
    reporter: 'list',
  }
};
