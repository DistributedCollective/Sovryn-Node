import { expect } from 'chai';
import { BN, ether, constants } from '@openzeppelin/test-helpers';
const { MAX_UINT256 } = constants;

import A from '../../secrets/accounts';
import Arbitrage from '../../controller/arbitrage';

import {initSovrynNodeForTesting} from "./base/backend";
import {initSovrynContracts, ConverterHelper} from "./base/contracts";


describe("Arbitrage controller", () => {
    let arbitragerAddress;

    let sovrynContracts;
    let converters;
    let usdtToken;
    let wrbtcToken;
    let priceFeeds;

    let initialRBTCBalance;
    const initialWRBTCBalance = ether('1');
    const initialUSDTBalance = ether('1000');

    beforeEach(async () => {
        sovrynContracts = await initSovrynContracts();
        initSovrynNodeForTesting(sovrynContracts);
        converters = new ConverterHelper(sovrynContracts);

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
        initialRBTCBalance = await web3.eth.getBalance(arbitragerAddress);
    });

    it("should not detect arbitrage for a pool with no balance deltas", async () => {
        await converters.initConverter({
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            primaryReserveWeight: 500000,
            secondaryReserveWeight: 500000,
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
            primaryReserveWeight: 500000,
            secondaryReserveWeight: 500000,
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
            primaryReserveWeight: 500000,
            secondaryReserveWeight: 500000,
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
            primaryReserveWeight: 500000,
            secondaryReserveWeight: 500000,
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
            primaryReserveWeight: 500000,
            secondaryReserveWeight: 500000,
            initialPrimaryReserveLiquidity: ether('10'),
            initialSecondaryReserveLiquidity: ether('10'),
        });
        await priceFeeds.setRates(wrbtcToken.address, usdtToken.address, 10);

        await converters.convert(wrbtcToken, usdtToken, ether('1'));

        const result = await Arbitrage.handleDynamicArbitrageForToken('usdt', usdtToken.address);
        expect(result).to.not.equal(null)
    });
});
