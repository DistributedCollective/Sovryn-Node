import { expect } from 'chai';
import { describe, it, xit, beforeEach } from 'mocha';
import { ethers } from 'hardhat';
import { Signer, Contract, BigNumber } from 'ethers';
const { parseEther } = ethers.utils;

describe("Watcher", function() {
    let accounts: Signer[];
    let ownerAccount: Signer;
    let ownerAddress: string;
    let executorAccount: Signer;
    let executorAddress: string;
    let anotherAccount: Signer;

    let sovrynSwapSimulator: Contract;
    let loanProtocolSimulator: Contract;
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
        const LoanProtocolSimulator = await ethers.getContractFactory("TestLoanProtocol");
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

        loanProtocolSimulator = await LoanProtocolSimulator.deploy(wrbtcToken.address);
        await loanProtocolSimulator.deployed();

        watcher = await Watcher.deploy(
            loanProtocolSimulator.address,
            sovrynSwapSimulator.address,
            priceFeeds.address,
            wrbtcToken.address
        );
        await watcher.deployed();

        await watcher.grantRole(await watcher.ROLE_EXECUTOR(), executorAddress);
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

        it("should fail if minProfit is not met 1", async () => {
            await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));

            await expect(
                watcher.arbitrage([wrbtcToken.address, docToken.address], parseEther('1'), 1)
            ).to.be.revertedWith("insufficient source tokens provided");
        });

        it("should fail if minProfit is not met 2", async () => {
            await priceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("2000"));
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("3000"));

            await expect(
                watcher.arbitrage(
                    [wrbtcToken.address, docToken.address],
                    parseEther('1'),
                    parseEther('1000').add(1)
                )
            ).to.be.revertedWith("insufficient source tokens provided");
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

        it("only executor should be able to call arbitrage", async () => {
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

    describe("#liquidate", () => {
        let initialWrbtcBalance: BigNumber;
        let initialDocBalance: BigNumber;
        const exampleLoanId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

        beforeEach(async () => {
            // give 100k of both WRBTC and DOC. Should be enough...
            const wrbtcAmount = parseEther('50');
            const amount = parseEther('100000');

            await wrbtcToken.deposit({ value: wrbtcAmount.mul(3) })
            await wrbtcToken.approve(watcher.address, wrbtcAmount);
            await watcher.depositTokens(wrbtcToken.address, wrbtcAmount);
            // approve wrbtc for loans (collateral)
            await wrbtcToken.approve(loanProtocolSimulator.address, wrbtcAmount);
            // send wrbtc for loans (principal)
            await wrbtcToken.transfer(loanProtocolSimulator.address, wrbtcAmount);

            await docToken.mint(ownerAddress, amount);
            await docToken.approve(watcher.address, amount);
            await watcher.depositTokens(docToken.address, amount);

            initialWrbtcBalance = await wrbtcToken.balanceOf(watcher.address);
            initialDocBalance = await docToken.balanceOf(watcher.address);

            // just connect to executor here, as we mostly test the executor account
            watcher = watcher.connect(executorAccount);
        })

        it("should not liquidate non-existing loan", async () => {
            await expect(
                watcher.liquidate(exampleLoanId, 1000)
            ).to.be.reverted;
        });

        it("should liquidate existing loan", async () => {
            // take out a loan of 10 RBTC by providing 2000 DoC as collateral
            const principal = parseEther('10');
            const collateral = parseEther('2000');
            await loanProtocolSimulator.createLoan(
                exampleLoanId,
                wrbtcToken.address,  // principal (loanToken): WRBTC
                docToken.address, // collateral: DoC
                principal,
                collateral,
            );

            const closeAmount = parseEther('2.5');

            // sanity check -- healthy position
            await expect(
                watcher.liquidate(exampleLoanId, closeAmount)
            ).to.be.revertedWith("healthy position");

            await loanProtocolSimulator.updateLiquidatableAmounts(
                exampleLoanId,
                parseEther('5'), // max liquidatable: 5 RBTC
                parseEther('1000'), // max seizable: 1000 DOC
            )

            const watcherDocBefore = await docToken.balanceOf(watcher.address);
            const watcherWrbtcBefore = await wrbtcToken.balanceOf(watcher.address);
            await expect(
                () => watcher.liquidate(exampleLoanId, closeAmount),
            ).to.changeEtherBalance(
                watcher, BigNumber.from(0)
            );
            const watcherDocChange = (await docToken.balanceOf(watcher.address)).sub(watcherDocBefore);
            const watcherWrbtcChange = (await wrbtcToken.balanceOf(watcher.address)).sub(watcherWrbtcBefore);
            expect(watcherDocChange).to.equal(parseEther('500'));
            expect(watcherWrbtcChange).to.equal(parseEther('-2.5'));
        });

        it("should liquidate existing loan (with WRBTC as collateral)", async () => {
            // take out a loan of 40000 doc by providing 2 RBTC as collateral (overcollateralization)
            const principal = parseEther('40000');
            const collateral = parseEther('2');
            await loanProtocolSimulator.createLoan(
                exampleLoanId,
                docToken.address, // principal (loanToken): DoC
                wrbtcToken.address,  // collateral: WRBTC
                principal,
                collateral,
            );

            await loanProtocolSimulator.updateLiquidatableAmounts(
                exampleLoanId,
                parseEther('20000'), // max liquidatable: 20k doc
                parseEther('0.5'), // max seizable: 0.5 RBTC
            );

            const closeAmount = parseEther('10000');

            const watcherDocBefore = await docToken.balanceOf(watcher.address);
            const watcherWrbtcBefore = await wrbtcToken.balanceOf(watcher.address);
            let liquidationReceipt;
            await expect(
                () => {
                    liquidationReceipt = watcher.liquidate(exampleLoanId, closeAmount);
                    return liquidationReceipt;
                },
            ).to.changeEtherBalance(
                watcher, BigNumber.from(0)
            );
            const watcherDocChange = (await docToken.balanceOf(watcher.address)).sub(watcherDocBefore);
            const watcherWrbtcChange = (await wrbtcToken.balanceOf(watcher.address)).sub(watcherWrbtcBefore);
            expect(watcherDocChange).to.equal(parseEther('-10000'));
            expect(watcherWrbtcChange).to.equal(parseEther('0.25'));

            await expect(liquidationReceipt).to.emit(watcher, 'Liquidation').withArgs(
                exampleLoanId,
                docToken.address,
                wrbtcToken.address,
                parseEther('10000'),
                parseEther('0.25'),
                executorAddress
            );
        });

        it("should liquidate loan with liquidateSwapback when min profit is met", async () => {
            // take out a loan of 40000 doc by providing 2 RBTC as collateral (overcollateralization)
            const principal = parseEther('40000');
            const collateral = parseEther('2');
            await loanProtocolSimulator.createLoan(
                exampleLoanId,
                docToken.address, // principal (loanToken): DoC
                wrbtcToken.address,  // collateral: WRBTC
                principal,
                collateral,
            );

            await loanProtocolSimulator.updateLiquidatableAmounts(
                exampleLoanId,
                parseEther('20000'), // max liquidatable: 20k doc
                parseEther('0.5'), // max seizable: 0.5 RBTC
            )

            const closeAmount = parseEther('10000');

            // 0.25 * 80k = 20k
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("80000"));

            const watcherDocBefore = await docToken.balanceOf(watcher.address);
            const watcherWrbtcBefore = await wrbtcToken.balanceOf(watcher.address);
            const swapbackReceipt = await watcher.liquidateWithSwapback(
                exampleLoanId,
                closeAmount,
                [wrbtcToken.address, docToken.address],
                0,
                true // requireSwapback, can be true or false
            );
            const watcherDocChange = (await docToken.balanceOf(watcher.address)).sub(watcherDocBefore);
            const watcherWrbtcChange = (await wrbtcToken.balanceOf(watcher.address)).sub(watcherWrbtcBefore);
            expect(watcherDocChange).to.equal(parseEther('10000'));
            expect(watcherWrbtcChange).to.equal(parseEther('0'));

            await expect(swapbackReceipt).to.emit(watcher, 'Swapback').withArgs(
                exampleLoanId,
                wrbtcToken.address,
                docToken.address,
                parseEther('0.25'),
                parseEther('20000'),
                executorAddress
            );
            await expect(swapbackReceipt).to.emit(watcher, 'Liquidation').withArgs(
                exampleLoanId,
                docToken.address,
                wrbtcToken.address,
                parseEther('10000'),
                parseEther('0.25'),
                executorAddress
            );
        });

        it("should liquidate loan with liquidateSwapback when min profit is NOT met", async () => {
            // take out a loan of 40000 doc by providing 2 RBTC as collateral (overcollateralization)
            const principal = parseEther('40000');
            const collateral = parseEther('2');
            await loanProtocolSimulator.createLoan(
                exampleLoanId,
                docToken.address, // principal (loanToken): DoC
                wrbtcToken.address,  // collateral: WRBTC
                principal,
                collateral,
            );

            // this rate corresponds to 1btc = 40k doc
            await loanProtocolSimulator.updateLiquidatableAmounts(
                exampleLoanId,
                parseEther('20000'), // max liquidatable: 20k doc
                parseEther('0.5'), // max seizable: 0.5 RBTC
            )

            const closeAmount = parseEther('10000');

            // too low rate, no chance  for swapback
            await simulatorPriceFeeds.setRates(wrbtcToken.address, docToken.address, parseEther("20000"));

            // min profit not met, so requireSwapback=true reverts
            await expect(
                watcher.liquidateWithSwapback(
                    exampleLoanId,
                    closeAmount,
                    [wrbtcToken.address, docToken.address],
                    0,
                    true // requireSwapback
                )
            ).to.be.reverted;  // min profit not met

            // without requireSwapback it should work, but nothing happens
            const watcherDocBefore = await docToken.balanceOf(watcher.address);
            const watcherWrbtcBefore = await wrbtcToken.balanceOf(watcher.address);
            await watcher.liquidateWithSwapback(
                exampleLoanId,
                closeAmount,
                [wrbtcToken.address, docToken.address],
                0,
                false // requireswapback
            );
            const watcherDocChange = (await docToken.balanceOf(watcher.address)).sub(watcherDocBefore);
            const watcherWrbtcChange = (await wrbtcToken.balanceOf(watcher.address)).sub(watcherWrbtcBefore);
            expect(watcherDocChange).to.equal(parseEther('-10000'));
            expect(watcherWrbtcChange).to.equal(parseEther('0.25'));
        });

        it("should handle multiple liquidations when closeAmount more than maxLiquidatable", async () => {
            // Regression test for a bug that happened when first liquidating with closeAmount > maxLiquidatable
            // (which resulted in leftover allowance) and then trying to liquidate again (which resulted in
            // SafeERC20 approval fail, because of the leftover allowance).

            // take out a loan of 10 RBTC by providing 2000 DoC as collateral
            const principal = parseEther('10');
            const collateral = parseEther('2000');
            await loanProtocolSimulator.createLoan(
                exampleLoanId,
                wrbtcToken.address,  // principal (loanToken): WRBTC
                docToken.address, // collateral: DoC
                principal,
                collateral,
            );

            const closeAmount = parseEther('7.5');

            // sanity check -- healthy position
            await expect(
                watcher.liquidate(exampleLoanId, closeAmount)
            ).to.be.revertedWith("healthy position");

            await loanProtocolSimulator.updateLiquidatableAmounts(
                exampleLoanId,
                parseEther('5'), // max liquidatable: 5 RBTC
                parseEther('1000'), // max seizable: 1000 DOC
            )

            // Sanity check, can be removed
            expect(await docToken.allowance(watcher.address, loanProtocolSimulator.address)).to.equal(0);

            let watcherDocBefore = await docToken.balanceOf(watcher.address);
            let watcherWrbtcBefore = await wrbtcToken.balanceOf(watcher.address);
            await expect(
                () => watcher.liquidate(exampleLoanId, closeAmount),
            ).to.changeEtherBalance(
                watcher, BigNumber.from(0)
            );
            let watcherDocChange = (await docToken.balanceOf(watcher.address)).sub(watcherDocBefore);
            let watcherWrbtcChange = (await wrbtcToken.balanceOf(watcher.address)).sub(watcherWrbtcBefore);
            // should only close up to 5 rbtc
            expect(watcherDocChange).to.equal(parseEther('1000'));
            expect(watcherWrbtcChange).to.equal(parseEther('-5'));

            // This is what happens in the regression, but we are better off not testing it because the real
            // implementation might change
            //expect(await wrbtcToken.allowance(watcher.address, loanProtocolSimulator.address)).to.equal(parseEther('2.5'));

            // allow liquidation again
            await loanProtocolSimulator.updateLiquidatableAmounts(
                exampleLoanId,
                parseEther('5'), // max liquidatable: 5 RBTC
                parseEther('1000'), // max seizable: 1000 DOC
            )

            watcherDocBefore = await docToken.balanceOf(watcher.address);
            watcherWrbtcBefore = await wrbtcToken.balanceOf(watcher.address);
            await watcher.liquidate(exampleLoanId, closeAmount);
            watcherDocChange = (await docToken.balanceOf(watcher.address)).sub(watcherDocBefore);
            watcherWrbtcChange = (await wrbtcToken.balanceOf(watcher.address)).sub(watcherWrbtcBefore);
            expect(watcherDocChange).to.equal(parseEther('1000'));
            expect(watcherWrbtcChange).to.equal(parseEther('-5'));
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

    describe('#receive fallback', () => {
        it('everyone should be able to just directly send RBTC', async () => {
            const amount = parseEther('500');

            // sanity checks #1
            expect(await ethers.provider.getBalance(watcher.address)).to.equal(BigNumber.from(0));
            expect(await wrbtcToken.balanceOf(watcher.address)).to.equal(BigNumber.from(0));

            // transaction + check
            await expect(
                () => anotherAccount.sendTransaction({
                    to: watcher.address,
                    value: amount,
                })
            ).to.changeTokenBalances(
                wrbtcToken,
                [watcher, anotherAccount],
                [amount, 0]
            );

            // sanity checks #2
            expect(await ethers.provider.getBalance(watcher.address)).to.equal(BigNumber.from(0));
            expect(await wrbtcToken.balanceOf(watcher.address)).to.equal(amount);

            // test withdrawal here too, for laziness. not necessary
            const anotherAccountAddress = await anotherAccount.getAddress();
            const rbtcAddress = await watcher.RBTC_ADDRESS();
            await expect(
                () => watcher.withdrawTokens(rbtcAddress, amount, anotherAccountAddress),
            ).to.changeEtherBalance(anotherAccount, amount);
            expect(await wrbtcToken.balanceOf(watcher.address)).to.equal(0);
        });
    });
});
