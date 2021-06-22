import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
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
};

