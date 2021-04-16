import { expect } from 'chai';
import { BN, ether, constants } from '@openzeppelin/test-helpers';
const { MAX_UINT256 } = constants;

import A from '../../secrets/accounts';
import Arbitrage from '../../controller/arbitrage';

import {initSovrynNodeForTesting} from "./base/backend";
import {initSovrynContracts, ConverterHelper} from "./base/contracts";
import {SmartContractStateUtility} from "../tools/showSmartContractState";


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

        // TODO: test that the DB looks ok

        // test that the pool is balanced
        const newWrbtcDelta = (await converter.reserveStakedBalance(wrbtcToken.address)).sub(await converter.reserveBalance(wrbtcToken.address));
        const newUsdtDelta = (await converter.reserveStakedBalance(usdtToken.address)).sub(await converter.reserveBalance(usdtToken.address));

        // Usdt delta should be 0 by definition (since we transferred delta amount of USDT into the contract).
        expect(newUsdtDelta).to.be.bignumber.equal(new BN(0));

        // WRBTC delta should be *close to* 0, but not quite
        expect(newWrbtcDelta).to.be.bignumber.above(ether('-0.02'));
        expect(newWrbtcDelta).to.be.bignumber.below(ether('0.02'));
    });

    it('handles a RBTC -> USDT arbitrage opportunity', async () => {
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

        expect(rbtcEarned).to.be.bignumber.above(wrbtcDelta.neg().sub(ether('0.02')));
        expect(rbtcEarned).to.be.bignumber.below(wrbtcDelta.neg().add(ether('0.02')));
        expect(usdtEarned).to.be.bignumber.above(usdtDelta.neg().sub(ether('0.02')));
        expect(usdtEarned).to.be.bignumber.below(usdtDelta.neg().add(ether('0.02')));

        // test that the pool is balanced
        const newWrbtcDelta = (await converter.reserveStakedBalance(wrbtcToken.address)).sub(await converter.reserveBalance(wrbtcToken.address));
        const newUsdtDelta = (await converter.reserveStakedBalance(usdtToken.address)).sub(await converter.reserveBalance(usdtToken.address));

        // WRBTC delta should be 0 by definition (since we transferred delta amount of USDT into the contract).
        expect(newWrbtcDelta).to.be.bignumber.equal(new BN(0));

        // USDT delta should be *close to* 0, but not quite
        expect(newUsdtDelta).to.be.bignumber.above(ether('-0.02'));
        expect(newUsdtDelta).to.be.bignumber.below(ether('0.02'));
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

        expect(rbtcEarned).to.be.bignumber.above(wrbtcDelta.neg().sub(ether('0.02')));
        expect(rbtcEarned).to.be.bignumber.below(wrbtcDelta.neg().add(ether('0.02')));
        expect(usdtEarned).to.be.bignumber.above(usdtDelta.neg().sub(ether('0.02')));
        expect(usdtEarned).to.be.bignumber.below(usdtDelta.neg().add(ether('0.5')));
    });
});