require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-web3");
const truffleConfig = require('./truffle-config');

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.4.26",
      },
      {
        version: "0.5.16",
      },
    ]
  },
  paths: {
    // Contracts are copied from oracle-based-amm to this directory
    sources: './contracts',
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
  mocha: truffleConfig.mocha
};
