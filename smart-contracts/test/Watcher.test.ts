import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { ethers } from 'hardhat';
import { Signer, Contract, BigNumber } from 'ethers';
const { parseEther } = ethers.utils;

const ZERO = BigNumber.from(0);

describe("Watcher", function() {
  let ownerAddress: string;
  let accounts: Signer[];
  let sovrynSwapSimulator: Contract;
  let priceFeeds: Contract;
  let simulatorPriceFeeds: Contract;
  let wrbtcToken: Contract;
  let docToken: Contract;
  let watcher: Contract;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();

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

    watcher = await Watcher.deploy(
        sovrynSwapSimulator.address,
        '0x0000000000000000000000000000000000000000',  // TODO
        priceFeeds.address,
        wrbtcToken.address
    );
    await watcher.deployed();
  });

  describe("#checkArbitrage", () => {
    it("should return NO arbitrage if swap rate = price feed rate", async () => {
      await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
      await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));

      const [amount, expectedReturn, conversionPath] = await watcher.checkArbitrage(wrbtcToken.address, docToken.address);
      expect(amount).to.equal(ZERO);
      expect(expectedReturn).to.equal(ZERO);
      expect(conversionPath).to.deep.equal([]);
    });

    it("should return an arbitrage if swap rate > price feed rate", async () => {
      await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
      await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("3000"));

      const [amount, expectedReturn, conversionPath] = await watcher.checkArbitrage(wrbtcToken.address, docToken.address);
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

      const [amount, expectedReturn, conversionPath] = await watcher.checkArbitrage(wrbtcToken.address, docToken.address);
      expect(amount).to.equal(parseEther('1'));
      expect(expectedReturn).to.equal(parseEther('0.0005'));
      expect(conversionPath[0]).to.equal(docToken.address);
      expect(conversionPath[conversionPath.length - 1]).to.equal(wrbtcToken.address);
    });
  });

  describe("#arbitrage", () => {
    let initialWrbtcBalance: BigNumber;
    let initialDocBalance: BigNumber;

    beforeEach(async () => {
      await wrbtcToken.deposit({ value: parseEther('10') })
      await wrbtcToken.approve(watcher.address, parseEther('10000'));
      await docToken.approve(watcher.address, parseEther('10000'));

      initialWrbtcBalance = await wrbtcToken.balanceOf(ownerAddress);
      initialDocBalance = await docToken.balanceOf(ownerAddress);
    })

    it("should fail if minReturn is not met 1", async () => {
      await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
      await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));

      await expect(
          watcher.arbitrage([wrbtcToken.address, docToken.address], parseEther('1'), 1)
      ).to.be.revertedWith("minimum profit not met");
    });

    it("should fail if minReturn is not met 2", async () => {
      await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
      await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("3000"));

      await expect(
        watcher.arbitrage(
            [wrbtcToken.address, docToken.address],
            parseEther('1'),
            parseEther('1000').add(1)
        )
      ).to.be.revertedWith("minimum profit not met");
    });

    it("should handle arbitrage", async () => {
      await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
      await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("3000"));

      const amount = parseEther('1');
      const expectedTargetAmount = parseEther('3000');
      const expectedProfit = parseEther('1000');

      const result = await watcher.arbitrage(
          [wrbtcToken.address, docToken.address],
          amount,
          expectedProfit
      );
      await expect(result).to.emit(watcher, 'Arbitrage').withArgs(
        ownerAddress,
        wrbtcToken.address,
        docToken.address,
        amount,
        expectedTargetAmount,
        parseEther("2000"),
        expectedProfit,
      );
      const wrbtcBalance = await wrbtcToken.balanceOf(ownerAddress);
      const docBalance = await docToken.balanceOf(ownerAddress);

      expect(wrbtcBalance).to.equal(initialWrbtcBalance.sub(amount));
      expect(docBalance).to.equal(initialDocBalance.add(expectedTargetAmount));
    });

    it("should handle with WRBTC as target token", async () => {
      // Price feed: 1 USD = 1/2000 BTC
      // Swaps: 1 USD = 1/1000 BTC = 2/2000 BTC
      // Profit over price feed: 1/2000 BTC = 0.0005 BTC
      await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
      await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("1000"));

      const amount = parseEther('1');
      const expectedTargetAmount = parseEther('0.001');
      const expectedProfit = parseEther('0.0005');

      const result = await watcher.arbitrage(
          [docToken.address, wrbtcToken.address],
          amount,
          expectedProfit
      );
      await expect(result).to.emit(watcher, 'Arbitrage').withArgs(
          ownerAddress,
          docToken.address,
          wrbtcToken.address,
          amount,
          expectedTargetAmount,
          parseEther("0.0005"),
          expectedProfit,
      );
      await expect(result).to.changeEtherBalance(accounts[0], expectedTargetAmount);

      const wrbtcBalance = await wrbtcToken.balanceOf(ownerAddress);
      const docBalance = await docToken.balanceOf(ownerAddress);
      expect(wrbtcBalance).to.equal(initialWrbtcBalance);
      expect(docBalance).to.equal(initialDocBalance.sub(amount));
    });

    it("should handle arbitrage with WRBTC given in RBTC", async () => {
      await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
      await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("3000"));
      await wrbtcToken.withdraw(initialWrbtcBalance);

      const amount = parseEther('1');
      const expectedTargetAmount = parseEther('3000');
      const expectedProfit = parseEther('1000');

      const result = await watcher.arbitrage(
          [wrbtcToken.address, docToken.address],
          amount,
          expectedProfit,
          {
            value: amount,
            gasPrice: Math.round(0.06 * 1000000000)
          }
      );
      await expect(result).to.emit(watcher, 'Arbitrage').withArgs(
        ownerAddress,
        wrbtcToken.address,
        docToken.address,
        amount,
        expectedTargetAmount,
        parseEther("2000"),
        expectedProfit,
      );
      await expect(result).to.changeEtherBalance(accounts[0], amount.mul(-1));
      const docBalance = await docToken.balanceOf(ownerAddress);

      expect(docBalance).to.equal(initialDocBalance.add(expectedTargetAmount));
    });
  });
});
