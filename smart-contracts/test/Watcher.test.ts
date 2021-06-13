import { expect } from 'chai';
import {describe, it, beforeEach, Test} from 'mocha';
import { ethers } from 'hardhat';
import { Signer, Contract } from 'ethers';
const { formatUnits, parseEther } = ethers.utils;

describe("Watcher", function() {
  let accounts: Signer[];
  let sovrynSwapSimulator: Contract;
  let priceFeeds: Contract;
  let wrbtcToken: Contract;
  let docToken: Contract;
  let watcher: Contract;

  beforeEach(async () => {
    accounts = await ethers.getSigners();

    const PriceFeedsLocal  = await ethers.getContractFactory("PriceFeedsLocal");
    const SovrynSwapSimulator = await ethers.getContractFactory("TestSovrynSwap");
    const TestToken = await ethers.getContractFactory("TestToken");
    const TestWrbtc = await ethers.getContractFactory("TestWrbtc");
    const Watcher = await ethers.getContractFactory("Watcher");

    wrbtcToken = await TestWrbtc.deploy();
    await wrbtcToken.deployed();
    docToken = await TestToken.deploy('Dollar on Chain', 'DOC', 18, parseEther('1000'))
    await docToken.deployed();

    // needed but not used
    const protocolToken = await TestToken.deploy('PROTOCOL', 'PROTOCOL', 18, parseEther('1000'));
    await protocolToken.deployed();

    priceFeeds = await PriceFeedsLocal.deploy(wrbtcToken.address, protocolToken.address);
    await priceFeeds.deployed();
    await priceFeeds.setRates(docToken.address, wrbtcToken.address, parseEther("0.01"));

    sovrynSwapSimulator = await SovrynSwapSimulator.deploy(priceFeeds.address);
    await sovrynSwapSimulator.deployed();

    watcher = await Watcher.deploy(sovrynSwapSimulator.address);
    await watcher.deployed();
  });


  describe("#checkArbitrage", () => {
    it("smoke test works well enough", async () => {
      const ret = await watcher.functions.checkArbitrage(wrbtcToken.address, docToken.address);
      expect(ret).to.deep.equal([false, []]);
    });
  })
});
