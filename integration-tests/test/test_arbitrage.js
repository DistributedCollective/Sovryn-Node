import { expect } from 'chai';
import { BN, ether, constants } from '@openzeppelin/test-helpers';
const { MAX_UINT256 } = constants;

import A from '../../secrets/accounts';
import Arbitrage from '../../controller/arbitrage';
import DB from '../../controller/db';
import conf from '../../config/config';

import {initSovrynNodeForTesting} from "./base/backend";
import {initSovrynContracts, ConverterHelper} from "./base/contracts";


describe("Arbitrage controller", () => {
    let arbitragerAddress;
    let contractOwnerAddress;

    let sovrynContracts;
    let converters;
    let usdtToken;
    let wrbtcToken;
    let priceFeeds;

    let initialRBTCBalance;
    // TODO: we don't actually need a WRBTC balance -- at least not after the bug in the arbitrage code is fixed
    const initialWRBTCBalance = ether('10000000');
    const initialUSDTBalance =  ether('10000000');

    async function getArbitragesFromDB() {
        return await DB.arbRepo.all("SELECT * FROM arbitrage");
    }

    beforeEach(async () => {
        sovrynContracts = await initSovrynContracts();
        await initSovrynNodeForTesting(sovrynContracts);
        converters = new ConverterHelper(sovrynContracts);

        contractOwnerAddress = sovrynContracts.accountOwner;
        arbitragerAddress = A.arbitrage[0].adr;
        usdtToken = sovrynContracts.usdtToken;
        wrbtcToken = sovrynContracts.wrbtcToken;
        priceFeeds = sovrynContracts.priceFeeds;

        await wrbtcToken.transfer(arbitragerAddress, initialWRBTCBalance);
        await usdtToken.transfer(arbitragerAddress, initialUSDTBalance);

        await wrbtcToken.approve(sovrynContracts.rbtcWrapperProxy.address, MAX_UINT256, {from: arbitragerAddress});
        await usdtToken.approve(sovrynContracts.rbtcWrapperProxy.address, MAX_UINT256, {from: arbitragerAddress});

        // sanity check
        expect(await wrbtcToken.balanceOf(arbitragerAddress)).to.be.bignumber.equal(initialWRBTCBalance);
        expect(await usdtToken.balanceOf(arbitragerAddress)).to.be.bignumber.equal(initialUSDTBalance);
        // this is affected by gas costs, so store it this way
        initialRBTCBalance = new BN(await web3.eth.getBalance(arbitragerAddress));
    });

    it("should not detect arbitrage for a pool with no balance deltas", async () => {
        await converters.initConverter({
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity: new BN(1000000000),
            initialSecondaryReserveLiquidity: new BN(1000000000),
        });

        const opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', usdtToken.address);
        expect(opportunity).to.equal(null);
    });

    it("should not execute arbitrage for a pool with no balance deltas", async () => {
        await converters.initConverter({
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity: new BN(1000000000),
            initialSecondaryReserveLiquidity: new BN(1000000000),
        });

        await Arbitrage.handleDynamicArbitrageForToken('USDT', usdtToken.address);

        // no balances should have changed
        const balanceRBTC = await web3.eth.getBalance(arbitragerAddress);
        const balanceWRBTC = await wrbtcToken.balanceOf(arbitragerAddress);
        const balanceUSDT = await usdtToken.balanceOf(arbitragerAddress);
        expect(balanceRBTC).to.be.bignumber.equal(initialRBTCBalance);
        expect(balanceWRBTC).to.be.bignumber.equal(initialWRBTCBalance);
        expect(balanceUSDT).to.be.bignumber.equal(initialUSDTBalance);
    });

    it("should detect arbitrage for a pool with balance deltas", async () => {
        await converters.initConverter({
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity: ether('10'),
            initialSecondaryReserveLiquidity: ether('10'),
        });

        await converters.convert(wrbtcToken, usdtToken, new BN('1000000'));

        let opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', usdtToken.address);

        expect(opportunity).to.not.equal(null);
        expect(opportunity.sourceTokenAddress.toLowerCase()).to.equal(usdtToken.address.toLowerCase());
        expect(opportunity.destTokenAddress.toLowerCase()).to.equal(wrbtcToken.address.toLowerCase());
        expect(opportunity.sourceTokenSymbol).to.equal('usdt');
        expect(opportunity.destTokenSymbol).to.equal('rbtc');
        const expectedOpportunityAmount = new BN('999999'); // again, calculated by contract internal magic
        expect(opportunity.amount).to.be.bignumber.equal(expectedOpportunityAmount);
    });

    it('trading based on found arbitrage opportunity should resolve the opportunity', async () => {
        await converters.initConverter({
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity: ether('10'),
            initialSecondaryReserveLiquidity: ether('10'),
        });

        await converters.convert(wrbtcToken, usdtToken, ether('1'));

        let opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', usdtToken.address);
        expect(opportunity).to.not.equal(null)
        await converters.convert(usdtToken, wrbtcToken, opportunity.amount);

        // no more opportunities found
        opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', usdtToken.address);
        expect(opportunity).to.equal(null)
    });

    it('should execute the opportunity when it sees one', async () => {
        await converters.initConverter({
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveWeight: 500000,
            initialScondaryReserveWeight: 500000,
            initialPrimaryReserveLiquidity: ether('10'),
            initialSecondaryReserveLiquidity: ether('10'),
        });
        await converters.setOraclePrice(wrbtcToken.address, ether('10'));

        await converters.convert(wrbtcToken, usdtToken, ether('1'));

        const result = await Arbitrage.handleDynamicArbitrageForToken('usdt', usdtToken.address);
        expect(result).to.exists();
    });

    it('handles a USDT -> RBTC arbitrage opportunity', async () => {
        // this situation was actually found on mainnet
        const converterOpts = {
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity:       new BN('159658299529181487177'),
            initialSecondaryReserveLiquidity: new BN('2344204953216918397465575'),
            finalPrimaryReserveBalance:           new BN('184968372923849153200'),
            finalSecondaryReserveBalance:      new BN('769563135046785056451752'),
            finalPrimaryReserveWeight:   812160,
            finalSecondaryReserveWeight: 187840,
            primaryPriceOracleAnswer: new BN('63500099999999998544808'),
            secondaryPriceOracleAnswer:   new BN('1000000000000000000'),
        };
        const converter = await converters.initConverter(converterOpts);

        const wrbtcDelta = converterOpts.initialPrimaryReserveLiquidity.sub(converterOpts.finalPrimaryReserveBalance);
        const usdtDelta = converterOpts.initialSecondaryReserveLiquidity.sub(converterOpts.finalSecondaryReserveBalance);

        const opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', usdtToken.address);
        expect(opportunity).to.not.equal(null)
        expect(opportunity.amount).to.be.bignumber.equal(usdtDelta);
        expect(opportunity.sourceTokenAddress.toLowerCase()).to.equal(usdtToken.address.toLowerCase());
        expect(opportunity.destTokenAddress.toLowerCase()).to.equal(wrbtcToken.address.toLowerCase());

        const result = await Arbitrage.handleDynamicArbitrageForToken('usdt', usdtToken.address);
        expect(result).to.exists();

        const usdtBalance = await usdtToken.balanceOf(arbitragerAddress);
        const usdtEarned = usdtBalance.sub(initialUSDTBalance);

        const rbtcBalance = new BN(await web3.eth.getBalance(arbitragerAddress));
        const rbtcEarned = rbtcBalance.sub(initialRBTCBalance);

        expect(usdtEarned).to.be.bignumber.equal(usdtDelta.neg());
        expect(rbtcEarned).to.be.bignumber.above(wrbtcDelta.neg().sub(ether('0.001')));
        expect(rbtcEarned).to.be.bignumber.below(wrbtcDelta.neg().add(ether('0.02')));

        // test that the DB looks ok
        const arbitrageRows = await getArbitragesFromDB();
        expect(arbitrageRows.length).to.equal(1);
        const row = arbitrageRows[0];

        expect(row.adr.toLowerCase()).to.equal(arbitragerAddress.toLowerCase());
        expect(row.trade).to.equal('buy btc');
        expect(row.fromToken.toLowerCase()).to.equal(usdtToken.address.toLowerCase());
        expect(row.toToken.toLowerCase()).to.equal(wrbtcToken.address.toLowerCase());
        expect(row.fromAmount).to.be.closeTo(parseFloat(web3.utils.fromWei(usdtEarned.neg()).toString()), 0.000001);
        expect(row.toAmount).to.be.closeTo(parseFloat(web3.utils.fromWei(rbtcEarned).toString()), 0.02);
        const priceFeedAmount = await sovrynContracts.priceFeeds.queryReturn(
            usdtToken.address,
            wrbtcToken.address,
            usdtDelta,
        );
        const profitOverPriceFeed = rbtcEarned.sub(priceFeedAmount);
        expect(row.profit).to.be.closeTo(parseFloat(web3.utils.fromWei(profitOverPriceFeed).toString()), 0.02);
        expect(row.profit).to.be.greaterThan(0);

        // test that the pool is balanced
        const newWrbtcDelta = (await converter.reserveStakedBalance(wrbtcToken.address)).sub(await converter.reserveBalance(wrbtcToken.address));
        const newUsdtDelta = (await converter.reserveStakedBalance(usdtToken.address)).sub(await converter.reserveBalance(usdtToken.address));

        // Usdt delta should be 0 by definition (since we transferred delta amount of USDT into the contract).
        expect(newUsdtDelta).to.be.bignumber.equal(new BN(0));

        // WRBTC delta should be *close to* 0, but not quite
        expect(newWrbtcDelta).to.be.bignumber.closeTo(new BN(0), ether('0.02'));
    });

    it('handles an RBTC -> USDT situation with no opportunity', async () => {
        // this situation was also actually found on mainnet
        const converterOpts = {
            primaryReserveToken: sovrynContracts.wrbtcToken,
            secondaryReserveToken: sovrynContracts.usdtToken,
            initialPrimaryReserveLiquidity: new BN('185298642986201160653'),
            initialSecondaryReserveLiquidity: new BN('4889547557918046531663603'),
            finalPrimaryReserveBalance: new BN('181359579931810286670'),
            finalSecondaryReserveBalance: new BN('4832877272928639614696971'),
            finalPrimaryReserveWeight: new BN('656038'),
            finalSecondaryReserveWeight: new BN('343962'),
            primaryPriceOracleAnswer: new BN('50111639999999999417923'),
            secondaryPriceOracleAnswer: new BN('1000000000000000000'),
        };
        await converters.initConverter(converterOpts);

        const wrbtcDelta = converterOpts.initialPrimaryReserveLiquidity.sub(converterOpts.finalPrimaryReserveBalance);
        const usdtDelta = converterOpts.initialSecondaryReserveLiquidity.sub(converterOpts.finalSecondaryReserveBalance);

        const opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', usdtToken.address);
        expect(opportunity).to.not.equal(null)
        expect(opportunity.amount).to.be.bignumber.equal(wrbtcDelta);
        expect(opportunity.sourceTokenAddress.toLowerCase()).to.equal(wrbtcToken.address.toLowerCase());
        expect(opportunity.destTokenAddress.toLowerCase()).to.equal(usdtToken.address.toLowerCase());

        // profit should be -0.21018 % -> loss -> no arbitrage
        const result = await Arbitrage.handleDynamicArbitrageForToken('usdt', usdtToken.address);
        expect(result).to.not.exists();

        const arbitrageRows = await getArbitragesFromDB();
        expect(arbitrageRows.length).to.equal(0);
    });

    it('handles an RBTC -> USDT arbitrage opportunity', async () => {
        // this is just the USDT->RBTC opportunity found on mainnet, but with the token balances, weights and
        // oracle prices reversed
        const converterOpts = {
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity: new BN('2344204953216918397465575'),
            initialSecondaryReserveLiquidity:   new BN('159658299529181487177'),
            finalPrimaryReserveBalance:      new BN('769563135046785056451752'),
            finalSecondaryReserveBalance:       new BN('184968372923849153200'),
            finalPrimaryReserveWeight:   187840,
            finalSecondaryReserveWeight: 812160,
            primaryPriceOracleAnswer:       new BN('1000000000000000000'),
            secondaryPriceOracleAnswer: new BN('63500099999999998544808'),
        };
        const converter = await converters.initConverter(converterOpts);

        const wrbtcDelta = converterOpts.initialPrimaryReserveLiquidity.sub(converterOpts.finalPrimaryReserveBalance);
        const usdtDelta = converterOpts.initialSecondaryReserveLiquidity.sub(converterOpts.finalSecondaryReserveBalance);

        const opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', usdtToken.address);
        expect(opportunity).to.not.equal(null)
        expect(opportunity.amount).to.be.bignumber.equal(wrbtcDelta);
        expect(opportunity.sourceTokenAddress.toLowerCase()).to.equal(wrbtcToken.address.toLowerCase());
        expect(opportunity.destTokenAddress.toLowerCase()).to.equal(usdtToken.address.toLowerCase());

        const result = await Arbitrage.handleDynamicArbitrageForToken('usdt', usdtToken.address);
        expect(result).to.exists();

        const usdtBalance = await usdtToken.balanceOf(arbitragerAddress);
        const usdtEarned = usdtBalance.sub(initialUSDTBalance);

        const rbtcBalance = new BN(await web3.eth.getBalance(arbitragerAddress));
        const rbtcEarned = rbtcBalance.sub(initialRBTCBalance);

        expect(rbtcEarned).to.be.bignumber.closeTo(wrbtcDelta.neg(), ether('0.02'));
        expect(usdtEarned).to.be.bignumber.closeTo(usdtDelta.neg(), ether('0.02'));

        // test that the DB looks ok
        const arbitrageRows = await getArbitragesFromDB();
        expect(arbitrageRows.length).to.equal(1);
        const row = arbitrageRows[0];

        expect(row.adr.toLowerCase()).to.equal(arbitragerAddress.toLowerCase());

        expect(row.trade).to.equal('sell btc');
        expect(row.fromToken.toLowerCase()).to.equal(wrbtcToken.address.toLowerCase());
        expect(row.toToken.toLowerCase()).to.equal(usdtToken.address.toLowerCase());
        expect(row.fromAmount).to.be.closeTo(parseFloat(web3.utils.fromWei(wrbtcDelta).toString()), 0.0001);
        expect(row.toAmount).to.be.closeTo(parseFloat(web3.utils.fromWei(usdtEarned).toString()), 0.00001);
        expect(row.profit).to.be.greaterThan(0);
        const priceFeedAmount = await sovrynContracts.priceFeeds.queryReturn(
            wrbtcToken.address,
            usdtToken.address,
            wrbtcDelta,
        );
        const profitOverPriceFeed = usdtEarned.sub(priceFeedAmount);
        expect(row.profit).to.be.closeTo(parseFloat(web3.utils.fromWei(profitOverPriceFeed).toString()), 0.00001);

        // test that the pool is balanced
        const newWrbtcDelta = (await converter.reserveStakedBalance(wrbtcToken.address)).sub(await converter.reserveBalance(wrbtcToken.address));
        const newUsdtDelta = (await converter.reserveStakedBalance(usdtToken.address)).sub(await converter.reserveBalance(usdtToken.address));

        // WRBTC delta should be 0 by definition (since we transferred delta amount of USDT into the contract).
        expect(newWrbtcDelta).to.be.bignumber.equal(new BN(0));

        // USDT delta should be *close to* 0, but not quite
        expect(newUsdtDelta).to.be.bignumber.closeTo(new BN(0), ether('0.02'));
    });

    it('checks RBTC balance instead of WRBTC balance when checking user balance', async () => {
        // this is just the USDT->RBTC opportunity found on mainnet, but with the token balances, weights and
        // oracle prices reversed
        const converterOpts = {
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity: ether('10'),
            initialSecondaryReserveLiquidity: ether('10'),
            finalPrimaryReserveBalance: ether('1'),
            finalSecondaryReserveBalance: ether('19'),
            // 1 RBTC = 1 USDT
            primaryPriceOracleAnswer: ether('1'),
            secondaryPriceOracleAnswer: ether('1'),
        };
        await converters.initConverter(converterOpts);

        // transfer all WRBTC away from arbitrager address
        // RBTC balance should be enough
        if(initialWRBTCBalance.gt(new BN(0))) {
            await wrbtcToken.transfer(contractOwnerAddress, initialWRBTCBalance, { from: arbitragerAddress });
        }

        const wrbtcDelta = converterOpts.initialPrimaryReserveLiquidity.sub(converterOpts.finalPrimaryReserveBalance);
        const usdtDelta = converterOpts.initialSecondaryReserveLiquidity.sub(converterOpts.finalSecondaryReserveBalance);

        const opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', usdtToken.address);
        expect(opportunity).to.not.equal(null)
        expect(opportunity.amount).to.be.bignumber.equal(ether('9'));
        expect(opportunity.sourceTokenAddress.toLowerCase()).to.equal(wrbtcToken.address.toLowerCase());
        expect(opportunity.destTokenAddress.toLowerCase()).to.equal(usdtToken.address.toLowerCase());

        const result = await Arbitrage.handleDynamicArbitrageForToken('usdt', usdtToken.address);
        expect(result).to.exists();

        const usdtBalance = await usdtToken.balanceOf(arbitragerAddress);
        const usdtEarned = usdtBalance.sub(initialUSDTBalance);

        const rbtcBalance = new BN(await web3.eth.getBalance(arbitragerAddress));
        const rbtcEarned = rbtcBalance.sub(initialRBTCBalance);

        expect(rbtcEarned).to.be.bignumber.closeTo(wrbtcDelta.neg(), ether('0.02'));
        expect(usdtEarned).to.be.bignumber.above(usdtDelta.neg().sub(ether('0.02')));
        expect(usdtEarned).to.be.bignumber.below(usdtDelta.neg().add(ether('0.5')));
    });

    it('limits the max amount if specified in config', async () => {
        // this situation was actually found on mainnet
        const converterOpts = {
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity:       new BN('159658299529181487177'),
            initialSecondaryReserveLiquidity: new BN('2344204953216918397465575'),
            finalPrimaryReserveBalance:           new BN('184968372923849153200'),
            finalSecondaryReserveBalance:      new BN('769563135046785056451752'),
            finalPrimaryReserveWeight:   812160,
            finalSecondaryReserveWeight: 187840,
            primaryPriceOracleAnswer: new BN('63500099999999998544808'),
            secondaryPriceOracleAnswer:   new BN('1000000000000000000'),
        };
        await converters.initConverter(converterOpts);

        const maxAmountStr = '1000';
        conf.dynamicArbitrageMaxAmounts.default = maxAmountStr;
        const usdtMaxAmountWei = ether(maxAmountStr);

        const usdtDelta = converterOpts.initialSecondaryReserveLiquidity.sub(converterOpts.finalSecondaryReserveBalance);
        expect(usdtDelta).to.be.bignumber.above(usdtMaxAmountWei);  // sanity check

        const opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', usdtToken.address);
        expect(opportunity.amount).to.be.bignumber.equal(usdtMaxAmountWei);
        expect(opportunity.sourceTokenAddress.toLowerCase()).to.equal(usdtToken.address.toLowerCase());

        await Arbitrage.handleDynamicArbitrageForToken('usdt', usdtToken.address);
        const usdtBalance = await usdtToken.balanceOf(arbitragerAddress);
        const usdtEarned = usdtBalance.sub(initialUSDTBalance);

        expect(usdtEarned).to.be.bignumber.equal(usdtMaxAmountWei.neg());
    });

    it('limits the max amount if specified in config for rbtc', async () => {
        // this situation was actually found on mainnet
        const converterOpts = {
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity: ether('10'),
            initialSecondaryReserveLiquidity: ether('10'),
            finalPrimaryReserveBalance: ether('1'),
            finalSecondaryReserveBalance: ether('19'),
            // 1 RBTC = 1 USDT
            primaryPriceOracleAnswer: ether('1'),
            secondaryPriceOracleAnswer: ether('1'),
        };
        await converters.initConverter(converterOpts);

        const maxAmountStr = '0.1';
        conf.dynamicArbitrageMaxAmounts.rbtc = maxAmountStr;
        const rbtcMaxAmountWei = ether(maxAmountStr);

        const rbtcDelta = converterOpts.initialPrimaryReserveLiquidity.sub(converterOpts.finalPrimaryReserveBalance);
        expect(rbtcDelta).to.be.bignumber.above(rbtcMaxAmountWei);  // sanity check

        const opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', wrbtcToken.address);
        expect(opportunity.amount).to.be.bignumber.equal(rbtcMaxAmountWei);
        expect(opportunity.sourceTokenAddress.toLowerCase()).to.equal(wrbtcToken.address.toLowerCase());
    });

    it('limits the max amount to token in wallet', async () => {
        // this situation was actually found on mainnet
        const converterOpts = {
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity:       new BN('159658299529181487177'),
            initialSecondaryReserveLiquidity: new BN('2344204953216918397465575'),
            finalPrimaryReserveBalance:           new BN('184968372923849153200'),
            finalSecondaryReserveBalance:      new BN('769563135046785056451752'),
            finalPrimaryReserveWeight:   812160,
            finalSecondaryReserveWeight: 187840,
            primaryPriceOracleAnswer: new BN('63500099999999998544808'),
            secondaryPriceOracleAnswer:   new BN('1000000000000000000'),
        };
        await converters.initConverter(converterOpts);

        const usdtMaxAmountWei = ether('100');
        expect(usdtMaxAmountWei).to.be.bignumber.below(initialUSDTBalance);
        await usdtToken.transfer(contractOwnerAddress, initialUSDTBalance.sub(usdtMaxAmountWei), {from: arbitragerAddress});
        expect(await usdtToken.balanceOf(arbitragerAddress)).to.be.bignumber.equal(usdtMaxAmountWei);

        const usdtDelta = converterOpts.initialSecondaryReserveLiquidity.sub(converterOpts.finalSecondaryReserveBalance);
        expect(usdtDelta).to.be.bignumber.above(usdtMaxAmountWei);  // sanity check

        const opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', usdtToken.address);
        expect(opportunity.amount).to.be.bignumber.equal(usdtMaxAmountWei);
        expect(opportunity.sourceTokenAddress.toLowerCase()).to.equal(usdtToken.address.toLowerCase());

        await Arbitrage.handleDynamicArbitrageForToken('usdt', usdtToken.address);
        const usdtBalance = await usdtToken.balanceOf(arbitragerAddress);
        expect(usdtBalance).to.be.bignumber.equal(new BN(0)); // all sent

        const arbitrageRows = await getArbitragesFromDB();
        expect(arbitrageRows.length).to.equal(1);
        const row = arbitrageRows[0];
        expect(row.fromToken.toLowerCase()).to.equal(usdtToken.address.toLowerCase());
        expect(row.fromAmount).to.be.closeTo(parseFloat(web3.utils.fromWei(usdtMaxAmountWei).toString()), 0.0001);
    });

    it('limits the max rbtc amount to rbtc held in wallet', async () => {
        // this situation was actually found on mainnet
        const converterOpts = {
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity: ether('10'),
            initialSecondaryReserveLiquidity: ether('10'),
            finalPrimaryReserveBalance: ether('1'),
            finalSecondaryReserveBalance: ether('19'),
            // 1 RBTC = 1 USDT
            primaryPriceOracleAnswer: ether('1'),
            secondaryPriceOracleAnswer: ether('1'),
        };
        await converters.initConverter(converterOpts);

        const rbtcMaxAmountWei = ether('0.1');
        expect(rbtcMaxAmountWei).to.be.bignumber.below(initialRBTCBalance);
        await web3.eth.sendTransaction({
            to: contractOwnerAddress,
            value: initialRBTCBalance.sub(rbtcMaxAmountWei),
            from: arbitragerAddress
        });
        // account for gas costs
        expect(await web3.eth.getBalance(arbitragerAddress)).to.be.bignumber.closeTo(rbtcMaxAmountWei, ether('0.001'));

        const rbtcDelta = converterOpts.initialPrimaryReserveLiquidity.sub(converterOpts.finalPrimaryReserveBalance);
        expect(rbtcDelta).to.be.bignumber.above(rbtcMaxAmountWei);  // sanity check

        const opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', wrbtcToken.address);
        expect(opportunity.amount).to.be.bignumber.below(rbtcMaxAmountWei);
        expect(opportunity.amount).to.be.bignumber.above(rbtcMaxAmountWei.sub(ether('0.001'))); // gas costs
        expect(opportunity.sourceTokenAddress.toLowerCase()).to.equal(wrbtcToken.address.toLowerCase());
    });

    it("doesn't limit max amount if opportunity amount is smaller", async () => {
        // this situation was actually found on mainnet
        const converterOpts = {
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity:       new BN('159658299529181487177'),
            initialSecondaryReserveLiquidity: new BN('2344204953216918397465575'),
            finalPrimaryReserveBalance:           new BN('184968372923849153200'),
            finalSecondaryReserveBalance:      new BN('769563135046785056451752'),
            finalPrimaryReserveWeight:   812160,
            finalSecondaryReserveWeight: 187840,
            primaryPriceOracleAnswer: new BN('63500099999999998544808'),
            secondaryPriceOracleAnswer:   new BN('1000000000000000000'),
        };
        await converters.initConverter(converterOpts);

        const maxAmountStr = '1000000000000000000000000000';
        conf.dynamicArbitrageMaxAmounts.default = maxAmountStr;
        const usdtMaxAmountWei = ether(maxAmountStr);

        const usdtDelta = converterOpts.initialSecondaryReserveLiquidity.sub(converterOpts.finalSecondaryReserveBalance);
        expect(usdtDelta).to.be.bignumber.below(usdtMaxAmountWei);  // sanity check

        const opportunity = await Arbitrage.findArbitrageOpportunityForToken('usdt', usdtToken.address);
        expect(opportunity.amount).to.be.bignumber.equal(usdtDelta);
        expect(opportunity.sourceTokenAddress.toLowerCase()).to.equal(usdtToken.address.toLowerCase());
    });
});
