import { expect } from 'chai';
import { BN, ether } from '@openzeppelin/test-helpers';

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
    let chainlinkOraclePrimary;
    let chainlinkOracleSecondary;


    const initialRBTCBalance = new BN('10000000000000000000000'); // hardhat default
    const initialWRBTCBalance = ether('1');
    const initialUSDTBalance = ether('1000');

    beforeEach(async () => {
        sovrynContracts = await initSovrynContracts();
        initSovrynNodeForTesting(sovrynContracts);
        converters = new ConverterHelper(sovrynContracts);

        arbitragerAddress = A.arbitrage[0].adr;
        usdtToken = sovrynContracts.usdtToken;
        wrbtcToken = sovrynContracts.wrbtcToken;
        chainlinkOraclePrimary = sovrynContracts.chainlinkPriceOraclePrimary;
        chainlinkOracleSecondary = sovrynContracts.chainlinkPriceOracleSecondary;

        await wrbtcToken.transfer(arbitragerAddress, initialWRBTCBalance);
        await usdtToken.transfer(arbitragerAddress, initialUSDTBalance);

        // sanity check
        expect(await web3.eth.getBalance(arbitragerAddress)).to.be.bignumber.equal(initialRBTCBalance);
        expect(await wrbtcToken.balanceOf(arbitragerAddress)).to.be.bignumber.equal(initialWRBTCBalance);
        expect(await usdtToken.balanceOf(arbitragerAddress)).to.be.bignumber.equal(initialUSDTBalance);
    });

    it("Should not detect arbitrage for an exactly balanced pool", async () => {
        const {
            usdtToken,
        } = sovrynContracts;

        await converters.initConverter({
            primaryReserveToken: sovrynContracts.wrbtcToken,
            secondaryReserveToken: sovrynContracts.usdtToken,
            primaryReserveWeight: 500000,
            secondaryReserveWeight: 500000,
            initialPrimaryReserveLiquidity: new BN(1000000000),
            initialSecondaryReserveLiquidity: new BN(1000000000),
        });

        const opportunity = await Arbitrage.findArbitrageOpportunityForToken(usdtToken.address);
        expect(opportunity).to.equal(null);
    });

    it("Should not execute arbitrage for an exactly balanced pool", async () => {
        const {
            usdtToken,
        } = sovrynContracts;

        await converters.initConverter({
            primaryReserveToken: sovrynContracts.wrbtcToken,
            secondaryReserveToken: sovrynContracts.usdtToken,
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

    it("Should detect arbitrage for an unbalanced pool", async () => {
        // TDOO: WIP
        const {
            usdtToken,
        } = sovrynContracts;

        const converter = await converters.initConverter({
            primaryReserveToken: sovrynContracts.wrbtcToken,
            secondaryReserveToken: sovrynContracts.usdtToken,
            primaryReserveWeight: 500000,
            secondaryReserveWeight: 500000,
            initialPrimaryReserveLiquidity: ether('10'),
            initialSecondaryReserveLiquidity: ether('10'),
        });
        //await converters.updateChainlinkOracle(converter, chainlinkOraclePrimary, 50000);
        //await converters.updateChainlinkOracle(converter, chainlinkOracleSecondary, 1);

        const weights = await converter.effectiveReserveWeights();
        console.log('weights', weights[0].toString(), weights[1].toString())

        //const opportunity = await Arbitrage.findArbitrageOpportunityForToken(usdtToken.address);
        //console.log(opportunity);
        //expect(opportunity).to.not.equal(null);
    });
});
