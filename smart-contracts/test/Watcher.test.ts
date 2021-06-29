import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { ethers } from 'hardhat';
import { Signer, Contract, BigNumber } from 'ethers';
import doc = Mocha.reporters.doc;
import exp from 'constants';
const { parseEther } = ethers.utils;

const ZERO = BigNumber.from(0);

describe("Watcher", function() {
    let accounts: Signer[];
    let ownerAccount: Signer;
    let ownerAddress: string;
    let executorAccount: Signer;
    let executorAddress: string;
    let anotherAccount: Signer;

    let sovrynSwapSimulator: Contract;
    let priceFeeds: Contract;
    let simulatorPriceFeeds: Contract;
    let wrbtcToken: Contract;
    let docToken: Contract;
    let watcher: Contract;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        ownerAccount = accounts[0];
        executorAccount = accounts[1];
        anotherAccount = accounts[2];
        ownerAddress = await ownerAccount.getAddress();
        executorAddress = await executorAccount.getAddress();

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
            '0x0000000000000000000000000000000000000000',  // TODO: deploy test sovrynProtocol
            sovrynSwapSimulator.address,
            priceFeeds.address,
            wrbtcToken.address
        );
        await watcher.deployed();

        await watcher.grantRole(await watcher.ROLE_EXECUTOR(), executorAddress);
    });

    describe("#checkArbitrage", () => {
        it("should return NO arbitrage if swap rate = price feed rate", async () => {
            await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));

            const [amount, targetAmount, expectedProfit, conversionPath] = await watcher.checkArbitrage(
                wrbtcToken.address,
                docToken.address,
                parseEther('1'),
                parseEther('1'),
                parseEther('1'),
                parseEther('1'),
                0,
            );
            expect(amount).to.equal(ZERO);
            expect(targetAmount).to.equal(ZERO);
            expect(expectedProfit).to.equal(ZERO);
            expect(conversionPath).to.deep.equal([]);
        });

        it("should return an arbitrage if swap rate > price feed rate", async () => {
            await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("3000"));

            const [amount, targetAmount, expectedProfit, conversionPath] = await watcher.checkArbitrage(
                wrbtcToken.address,
                docToken.address,
                parseEther('1'),
                parseEther('1'),
                parseEther('1'),
                parseEther('1'),
                0,
            );
            expect(amount).to.equal(parseEther('1'));
            expect(targetAmount).to.equal(parseEther('3000'));
            expect(expectedProfit).to.equal(parseEther('1000'));
            expect(conversionPath[0]).to.equal(wrbtcToken.address);
            expect(conversionPath[conversionPath.length - 1]).to.equal(docToken.address);
        });

        it("should return an arbitrage if swap rate < price feed rate", async () => {
            // Price feed: 1 USD = 1/2000 BTC
            // Swaps: 1 USD = 1/1000 BTC = 2/2000 BTC
            // Profit over price feed: 1/2000 BTC = 0.0005 BTC
            await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("1000"));

            const [amount, targetAmount, expectedProfit, conversionPath] = await watcher.checkArbitrage(
                wrbtcToken.address,
                docToken.address,
                parseEther('1'),
                parseEther('1'),
                parseEther('1'),
                parseEther('1'),
                0,
            );
            expect(amount).to.equal(parseEther('1'));
            expect(targetAmount).to.equal(parseEther('0.001'));
            expect(expectedProfit).to.equal(parseEther('0.0005'));
            expect(conversionPath[0]).to.equal(docToken.address);
            expect(conversionPath[conversionPath.length - 1]).to.equal(wrbtcToken.address);
        });

        const bisectedAmount = (amountMin: BigNumber, amountMax: BigNumber, steps: number): BigNumber => {
            // helper to calculate bisected prices, with the assumption that price feeds always returns the same rate
            for(let i = 0; i < steps; i++ && amountMin.lt(amountMax)) {
                amountMin = amountMin.add(amountMax).div(2);
            }
            return amountMin;
        }

        it("should return NO arbitrage if swap rate = price feed rate with bisecting", async () => {
            await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));

            const [amount, targetAmount, expectedProfit, conversionPath] = await watcher.checkArbitrage(
                wrbtcToken.address,
                docToken.address,
                parseEther('1'),
                parseEther('1000'),
                parseEther('1'),
                parseEther('1000'),
                0,
            );
            expect(amount).to.equal(ZERO);
            expect(targetAmount).to.equal(ZERO);
            expect(expectedProfit).to.equal(ZERO);
            expect(conversionPath).to.deep.equal([]);
        });

        it("should return an arbitrage if swap rate > price feed rate with bisecting", async () => {
            await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("3000"));

            const [amount, targetAmount, profit, conversionPath] = await watcher.checkArbitrage(
                wrbtcToken.address,
                docToken.address,
                parseEther('1'),
                parseEther('1000'),
                parseEther('1'),
                parseEther('2000'),
                parseEther('0.01'),
            );
            // for acceptable delta of 1%, it should converge in this many steps
            const expectedAmount = bisectedAmount(parseEther('1'), parseEther('1000'), 7);
            const expectedTargetAmount = expectedAmount.mul(3000);
            //const expectedPriceFeedTargetAmount = expectedAmount.mul(2000);
            //const expectedProfit = expectedTargetAmount.sub(expectedPriceFeedTargetAmount);
            const expectedProfit = expectedAmount.mul(1000);

            expect(amount).to.equal(expectedAmount);
            expect(targetAmount).to.equal(expectedTargetAmount);
            expect(profit).to.equal(expectedProfit);
            expect(conversionPath[0]).to.equal(wrbtcToken.address);
            expect(conversionPath[conversionPath.length - 1]).to.equal(docToken.address);
        });

        it("should return an arbitrage if swap rate < price feed rate with bisecting", async () => {
            // Price feed: 1 USD = 1/2000 BTC
            // Swaps: 1 USD = 1/1000 BTC = 2/2000 BTC
            // Profit over price feed: 1/2000 BTC = 0.0005 BTC
            await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("1000"));

            const [amount, targetAmount, profit, conversionPath] = await watcher.checkArbitrage(
                wrbtcToken.address,
                docToken.address,
                parseEther('1'),
                parseEther('1000'),
                parseEther('1'),
                parseEther('2000'),
                parseEther('0.01'),
            );
            // for acceptable delta of 1%, it should converge in this many steps
            const expectedAmount = bisectedAmount(parseEther('1'), parseEther('2000'), 7);
            const expectedTargetAmount = expectedAmount.div(1000);
            //const expectedPriceFeedTargetAmount = expectedAmount.div(2000);
            //const expectedProfit = expectedTargetAmount.sub(expectedPriceFeedTargetAmount);
            const expectedProfit = expectedAmount.div(2000);

            expect(amount).to.equal(expectedAmount);
            expect(targetAmount).to.equal(expectedTargetAmount);
            expect(profit).to.equal(expectedProfit);
            expect(conversionPath[0]).to.equal(docToken.address);
            expect(conversionPath[conversionPath.length - 1]).to.equal(wrbtcToken.address);
        });

        it("should return an arbitrage if swap rate > price feed rate with different acceptable delta", async () => {
            await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("3000"));

            const [amount, targetAmount, profit, conversionPath] = await watcher.checkArbitrage(
                wrbtcToken.address,
                docToken.address,
                parseEther('1'),
                parseEther('1000'),
                parseEther('1'),
                parseEther('2000'),
                parseEther('0.50'),
            );
            // for acceptable delta of 50%, it should converge in this many steps
            const expectedAmount = bisectedAmount(parseEther('1'), parseEther('1000'), 2);
            const expectedTargetAmount = expectedAmount.mul(3000);
            //const expectedPriceFeedTargetAmount = expectedAmount.mul(2000);
            //const expectedProfit = expectedTargetAmount.sub(expectedPriceFeedTargetAmount);
            const expectedProfit = expectedAmount.mul(1000);

            expect(amount).to.equal(expectedAmount);
            expect(targetAmount).to.equal(expectedTargetAmount);
            expect(profit).to.equal(expectedProfit);
            expect(conversionPath[0]).to.equal(wrbtcToken.address);
            expect(conversionPath[conversionPath.length - 1]).to.equal(docToken.address);
        });
    });

    describe("#arbitrage", () => {
        let initialWrbtcBalance: BigNumber;
        let initialDocBalance: BigNumber;

        beforeEach(async () => {
            const amount = parseEther('1000');

            await wrbtcToken.deposit({ value: amount })
            await wrbtcToken.approve(watcher.address, amount);
            await watcher.depositTokens(wrbtcToken.address, amount);

            await docToken.approve(watcher.address, amount);
            await watcher.depositTokens(docToken.address, amount);

            initialWrbtcBalance = await wrbtcToken.balanceOf(watcher.address);
            initialDocBalance = await docToken.balanceOf(watcher.address);

            // just connect to executor here, as we mostly test the executor account
            watcher = watcher.connect(executorAccount);
        })

        it("should fail if minReturn is not met 1", async () => {
            await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));

            await expect(
                watcher.arbitrage([wrbtcToken.address, docToken.address], parseEther('1'), 1)
            ).to.be.revertedWith("Watcher: minimum profit not met");
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
            ).to.be.revertedWith("Watcher: minimum profit not met");
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
                wrbtcToken.address,
                docToken.address,
                amount,
                expectedTargetAmount,
                parseEther("2000"),
                expectedProfit,
                executorAddress,
            );
            const wrbtcBalance = await wrbtcToken.balanceOf(watcher.address);
            const docBalance = await docToken.balanceOf(watcher.address);

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
                docToken.address,
                wrbtcToken.address,
                amount,
                expectedTargetAmount,
                parseEther("0.0005"),
                expectedProfit,
                executorAddress,
            );
            const wrbtcBalance = await wrbtcToken.balanceOf(watcher.address);
            const docBalance = await docToken.balanceOf(watcher.address);
            expect(wrbtcBalance).to.equal(initialWrbtcBalance.add(expectedTargetAmount));
            expect(docBalance).to.equal(initialDocBalance.sub(amount));
        });

        it("only executor should be able to call should handle arbitrage", async () => {
            await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("3000"));

            await expect(
                watcher.connect(ownerAccount).arbitrage(
                    [wrbtcToken.address, docToken.address],
                    parseEther('1'),
                    parseEther('1000')
                )
            ).to.be.reverted;

            // sanity check, make sure this doesn't revert
            await watcher.connect(executorAccount).arbitrage(
                [wrbtcToken.address, docToken.address],
                parseEther('1'),
                parseEther('1000')
            );
        });
    });

    describe('#withdrawTokens', () => {
        beforeEach(async () => {
            await docToken.mint(await anotherAccount.getAddress(), parseEther('1000'));
            await docToken.connect(anotherAccount).transfer(
                watcher.address,
                parseEther('1000')
            );
        });

        it('owner should be able to withdraw tokens', async () => {
            const amount = parseEther('500');
            await expect(
                () => watcher.withdrawTokens(docToken.address, amount, ownerAddress),
            ).to.changeTokenBalances(
                docToken,
                [watcher, ownerAccount],
                [amount.mul(-1), amount]
            );
        });

        it('others should NOT be able to withdraw tokens', async () => {
            const watcherWithAnotherSigner = watcher.connect(anotherAccount);
            await expect(
                watcherWithAnotherSigner.withdrawTokens(docToken.address, parseEther('1'), await anotherAccount.getAddress()),
            ).to.be.reverted;
        });
    });

    describe('#depositTokens', () => {
        let docTokenWithAnotherSigner: Contract;
        let watcherWithAnotherSigner: Contract;

        beforeEach(async () => {
            const initialBalance = parseEther('1000');
            await docToken.mint(await ownerAccount.getAddress(), initialBalance);
            await docToken.mint(await anotherAccount.getAddress(), initialBalance);

            docTokenWithAnotherSigner = docToken.connect(anotherAccount);
            watcherWithAnotherSigner = watcher.connect(anotherAccount);

            await docToken.approve(watcher.address, initialBalance);
            await docTokenWithAnotherSigner.approve(watcher.address, initialBalance);
        });

        it('owner should be able to deposit tokens', async () => {
            const amount = parseEther('500');
            await expect(
                () => watcher.depositTokens(docToken.address, amount),
            ).to.changeTokenBalances(
                docToken,
                [watcher, ownerAccount],
                [amount, amount.mul(-1)]
            );
        });

        it('others should NOT be able to deposit tokens', async () => {
            await expect(
                watcherWithAnotherSigner.depositTokens(docToken.address, parseEther('1'), await anotherAccount.getAddress()),
            ).to.be.reverted;
        });

        it('owner should be able to deposit RBTC', async () => {
            const amount = parseEther('500');
            const RBTC_ADDRESS = await watcher.RBTC_ADDRESS();
            await expect(
                () => watcher.depositTokens(RBTC_ADDRESS, amount, { value: amount }),
            ).to.changeTokenBalances(
                wrbtcToken,
                [watcher, ownerAccount],
                [amount, 0]
            );

            // test withdrawal here too, for laziness
            await expect(
                () => watcher.withdrawTokens(RBTC_ADDRESS, amount, ownerAddress),
            ).to.changeEtherBalance(ownerAccount, amount);
            expect(await wrbtcToken.balanceOf(watcher.address)).to.equal(0);
        });
    });
});
