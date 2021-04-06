import { expect } from 'chai';
import { BN, ether } from '@openzeppelin/test-helpers';

import A from '../../secrets/accounts';
import Arbitrage from '../../controller/arbitrage';

import {initSovrynNodeForTesting} from "./base/backend";
import {initSovrynContracts} from "./base/contracts";


describe("Arbitrage controller", () => {
    let sovrynContracts;
    let usdtToken;
    let wrbtcToken;
    let arbitragerAddress;
    const initialRBTCBalance = new BN('10000000000000000000000');
    const initialWRBTCBalance = ether('1');
    const initialUSDTBalance = ether('1000');

    beforeEach(async () => {
        sovrynContracts = await initSovrynContracts();
        initSovrynNodeForTesting(sovrynContracts);

        usdtToken = sovrynContracts.usdtToken;
        wrbtcToken = sovrynContracts.wrbtcToken;
        arbitragerAddress = A.arbitrage[0].adr;

        await wrbtcToken.transfer(arbitragerAddress, initialWRBTCBalance);
        await usdtToken.transfer(arbitragerAddress, initialUSDTBalance);

        // sanity check
        expect(await web3.eth.getBalance(arbitragerAddress)).to.be.bignumber.equal(initialRBTCBalance);
        expect(await wrbtcToken.balanceOf(arbitragerAddress)).to.be.bignumber.equal(initialWRBTCBalance);
        expect(await usdtToken.balanceOf(arbitragerAddress)).to.be.bignumber.equal(initialUSDTBalance);
    });

    it("Should not detect arbitrage for equal weights", async () => {
        const {
            usdtToken,
        } = sovrynContracts;

        await sovrynContracts.initConverter({
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

    it("Should not execute arbitrage for equal weights", async () => {
        const {
            usdtToken,
        } = sovrynContracts;

        await sovrynContracts.initConverter({
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
});
