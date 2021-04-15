import { expect } from 'chai';
import { BN } from '@openzeppelin/test-helpers';

import Contract from '../../controller/contract';

import {initSovrynNodeForTesting} from "./base/backend";
import {initSovrynContracts, ConverterHelper} from "./base/contracts";


describe("Contract controller", () => {
    let sovrynContracts;

    beforeEach(async () => {
        sovrynContracts = await initSovrynContracts();
        await initSovrynNodeForTesting(sovrynContracts);
        const converters = new ConverterHelper(sovrynContracts);
        await converters.initConverter({
            primaryReserveToken: sovrynContracts.wrbtcToken,
            secondaryReserveToken: sovrynContracts.usdtToken,
            initialPrimaryReserveLiquidity: new BN(1000000000),
            initialSecondaryReserveLiquidity: new BN(1000000000),
        });
    });

    it("Should get the WRTBC-USDT liquidity pool", async () => {
        const {
            wrbtcToken,
            usdtToken,
        } = sovrynContracts;

        const liquidityPool = await Contract.getLiquidityPoolByTokens(wrbtcToken.address, usdtToken.address);
        const contractPrimaryToken = await liquidityPool.methods.primaryReserveToken().call();
        expect(contractPrimaryToken.toLowerCase()).to.equal(wrbtcToken.address.toLowerCase());
        const balance1 = await liquidityPool.methods.reserveStakedBalance(wrbtcToken.address).call();
        const balance2 = await liquidityPool.methods.reserveStakedBalance(usdtToken.address).call();
        expect(balance1).to.equal('1000000000');
        expect(balance2).to.equal('1000000000');
        const weights = await liquidityPool.methods.effectiveReserveWeights().call();
        expect(weights[0]).to.equal('500000');
        expect(weights[1]).to.equal('500000');
    });
});
