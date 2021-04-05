require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-web3");
const truffleConfig = require('./truffle-config');

module.exports = {
  solidity: "0.4.26",
  paths: {
    sources: './oracle-based-amm/solidity/contracts',
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
  mocha: truffleConfig.mocha
};
