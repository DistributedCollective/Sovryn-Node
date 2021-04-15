/**
 * Tests for the sovryn contracts hardhat setup. If these tests fail, everything else will fail.
 */
import { expect } from 'chai';
import { BN, ether } from '@openzeppelin/test-helpers';

import {initSovrynContracts, ConverterHelper} from "./base/contracts";


describe("Sovryn contracts setup", () => {
    it("initSovrynContracts should work", async () => {
        await initSovrynContracts()
    })

    describe("ConverterHelper", async () => {
        let sovrynContracts;
        let converters;
        let wrbtcToken;
        let usdtToken;
        let account;

        beforeEach(async () => {
            sovrynContracts = await initSovrynContracts();
            converters = new ConverterHelper(sovrynContracts);
            wrbtcToken = sovrynContracts.wrbtcToken;
            usdtToken = sovrynContracts.usdtToken;
            account = sovrynContracts.accountNonOwner;
        });

        it('#initConverter should work', async () => {
            await converters.initConverter({
                primaryReserveToken: sovrynContracts.wrbtcToken,
                secondaryReserveToken: sovrynContracts.usdtToken,
                initialPrimaryReserveLiquidity: new BN(1000000000),
                initialSecondaryReserveLiquidity: new BN(1000000000),
            });
        });

        it('#convert should convert from WRBTC to USDT', async () => {
            await converters.initConverter({
                primaryReserveToken: wrbtcToken,
                secondaryReserveToken: usdtToken,
                initialPrimaryReserveWeight: 50000,
                initialSecondaryReserveWeight: 50000,
                initialPrimaryReserveLiquidity: new BN('100000'),
                initialSecondaryReserveLiquidity: new BN('100000'),
            });

            const amountConverted = new BN('2000');
            await wrbtcToken.transfer(account, amountConverted)

            // sanity check
            expect(await wrbtcToken.balanceOf(account)).to.be.bignumber.equal(amountConverted);
            expect(await usdtToken.balanceOf(account)).to.be.bignumber.equal(new BN(0));

            await converters.convert(wrbtcToken, usdtToken, amountConverted, { from: account });

            const expectedAmountReceived = new BN('1998');  // calculated by the AMM formula
            expect(await wrbtcToken.balanceOf(account)).to.be.bignumber.equal(new BN(0));
            expect(await usdtToken.balanceOf(account)).to.be.bignumber.equal(expectedAmountReceived);
        });

        it('#convert should convert from USDT to WRBTC', async () => {
            await converters.initConverter({
                primaryReserveToken: wrbtcToken,
                secondaryReserveToken: usdtToken,
                initialPrimaryReserveWeight: 50000,
                initialSecondaryReserveWeight: 50000,
                initialPrimaryReserveLiquidity: new BN('100000'),
                initialSecondaryReserveLiquidity: new BN('100000'),
            });

            const amountConverted = new BN('2000');
            await usdtToken.transfer(account, amountConverted)

            // sanity check
            expect(await wrbtcToken.balanceOf(account)).to.be.bignumber.equal(new BN(0));
            expect(await usdtToken.balanceOf(account)).to.be.bignumber.equal(amountConverted);

            await converters.convert(usdtToken, wrbtcToken, amountConverted, { from: account });

            const expectedAmountReceived = new BN('1998');  // calculated by the AMM formula
            expect(await wrbtcToken.balanceOf(account)).to.be.bignumber.equal(expectedAmountReceived);
            expect(await usdtToken.balanceOf(account)).to.be.bignumber.equal(new BN(0));
        });

        it('#priceFeed should reflect oracle price', async () => {
            let rate = await sovrynContracts.priceFeeds.queryRate(wrbtcToken.address, usdtToken.address);
            expect(rate[0].div(rate[1])).to.be.bignumber.equal(new BN(1));
            await converters.setOraclePrice(wrbtcToken.address, ether('61234'))
            rate = await sovrynContracts.priceFeeds.queryRate(wrbtcToken.address, usdtToken.address);
            expect(rate[0].div(rate[1])).to.be.bignumber.equal(new BN('61234'));
            expect(rate[0]).to.be.bignumber.equal(ether('61234'));
            expect(rate[1]).to.be.bignumber.equal(ether('1')); // default
        });
    });
});
