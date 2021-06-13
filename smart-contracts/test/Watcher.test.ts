import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { ethers } from 'hardhat';
import { Signer, Contract, BigNumber } from 'ethers';
const { parseEther } = ethers.utils;

const ZERO = BigNumber.from(0);

describe("Watcher", function() {
  let accounts: Signer[];
  let sovrynSwapSimulator: Contract;
  let priceFeeds: Contract;
  let simulatorPriceFeeds: Contract;
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
    await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));

    simulatorPriceFeeds = await PriceFeedsLocal.deploy(wrbtcToken.address, protocolToken.address);
    await simulatorPriceFeeds.deployed();
    await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));

    sovrynSwapSimulator = await SovrynSwapSimulator.deploy(simulatorPriceFeeds.address);
    await sovrynSwapSimulator.deployed();

    watcher = await Watcher.deploy(sovrynSwapSimulator.address, priceFeeds.address);
    await watcher.deployed();
  });


  describe("#checkArbitrage", () => {
    it("should return NO arbitrage if swap rate = price feed rate", async () => {
      await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
      await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));

      const [amount, expectedReturn, conversionPath] = await watcher.functions.checkArbitrage(wrbtcToken.address, docToken.address);
      expect(amount).to.equal(ZERO);
      expect(expectedReturn).to.equal(ZERO);
      expect(conversionPath).to.deep.equal([]);
    });

    it("should return an arbitrage if swap rate > price feed rate", async () => {
      await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
      await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("3000"));

      const [amount, expectedReturn, conversionPath] = await watcher.functions.checkArbitrage(wrbtcToken.address, docToken.address);
      expect(amount).to.equal(parseEther('1'));
      expect(expectedReturn).to.equal(parseEther('1000'));
      expect(conversionPath[0]).to.equal(wrbtcToken.address);
      expect(conversionPath[conversionPath.length - 1]).to.equal(docToken.address);
    });

    it("should return an arbitrage if swap rate < price feed rate", async () => {
      // Price feed: 1 USD = 1/2000 BTC
      // Swaps: 1 USD = 1/1000 BTC = 2/2000 BTC
      // Profit over price feed: 1/2000 BTC = 0.0005 BTC
      await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
      await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("1000"));

      const [amount, expectedReturn, conversionPath] = await watcher.functions.checkArbitrage(wrbtcToken.address, docToken.address);
      expect(amount).to.equal(parseEther('1'));
      expect(expectedReturn).to.equal(parseEther('0.0005'));
      expect(conversionPath[0]).to.equal(docToken.address);
      expect(conversionPath[conversionPath.length - 1]).to.equal(wrbtcToken.address);
    });
  })
});
