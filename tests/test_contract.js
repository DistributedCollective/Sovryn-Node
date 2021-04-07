/**
 * Tests for the Contract helper
 * Set config file in /config.config.js manually because mocha.js overwrites process.arg
 */
import C from '../controller/contract';
const assert = require('assert');

describe('Contract', () => {
    const rbtcAddress = C.contractTokenRBTC._address.toLowerCase();
    const tokens = [
        ['USDT', C.contractTokenUSDT._address.toLowerCase()],
        ['DOC', C.contractTokenSUSD._address.toLowerCase()],
    ]
    describe('#getLiquidityPoolByTokens', () => {
        tokens.forEach(([symbol, tokenAddress]) => {
            it(`Should get the liquidity pool for RBTC and ${symbol}`, async () => {
                const liquidityPool = await C.getLiquidityPoolByTokens(rbtcAddress, tokenAddress);
                assert(liquidityPool);
                const contractPrimaryToken = await liquidityPool.methods.primaryReserveToken().call();
                assert(contractPrimaryToken.toLowerCase() === rbtcAddress);
            });
            it(`Should get the liquidity pool for ${symbol} and RBTC`, async () => {
                const liquidityPool = await C.getLiquidityPoolByTokens(rbtcAddress, tokenAddress);
                assert(liquidityPool);
                // primary token is still RBTC. not that it matters much
                const contractPrimaryToken = await liquidityPool.methods.primaryReserveToken().call();
                assert(contractPrimaryToken.toLowerCase() === rbtcAddress);
            });
        });
    });
});
