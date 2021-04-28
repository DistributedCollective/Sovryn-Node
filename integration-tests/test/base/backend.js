import { constants } from "@openzeppelin/test-helpers";
import conf from '../../../config/config';
import C from '../../../controller/contract';
import A from '../../../secrets/accounts';
import db from '../../../controller/db';

const { ZERO_ADDRESS } = constants;

/**
 * Initialize (read: monkey-patch) Sovryn-Node so that it works for testing.
 *
 * The config and controllers are initialized on startup. Since we want to alter the contract addresses
 * used based on the contracts deployed during testing, we need to resort to monkey-patching.
 */
export async function initSovrynNodeForTesting({
    sovrynSwapNetwork,
    wrbtcToken,
    docToken,
    bproToken,
    usdtToken,
    rbtcWrapperProxy,
    priceFeeds,
    accounts,
    sovrynProtocol,
    loanTokenDoc,
    loanTokenUsdt,
    loanTokenBpro,
    loanTokenWrbtc,
}) {
    conf.network = 'test';

    conf.swapsImpl = sovrynSwapNetwork.address.toLowerCase();
    conf.docToken = docToken.address.toLowerCase();
    conf.USDTToken = usdtToken.address.toLowerCase();
    conf.BProToken = bproToken.address.toLowerCase();
    conf.testTokenRBTC = wrbtcToken.address.toLowerCase();

    conf.wRbtcWrapper = rbtcWrapperProxy.address.toLowerCase();
    conf.priceFeed  = priceFeeds.address.toLowerCase();

    // sane settings for these
    conf.thresholdArbitrage = 1;
    conf.amountArbitrage = 0.01;
    conf.enableDynamicArbitrageAmount = true;
    conf.dynamicArbitrageMaxAmounts = {};  // clear this by default, for easier testing

    // Set these just to be safe
    conf.nodeProvider = 'http://example.invalid';
    conf.publicNodeProvider = 'http://example.invalid';
    conf.errorBotTelegram = undefined;

    // Use a different DB too
    conf.db = 'sovryn_node_integration_tests.db';

    // Loans
    conf.sovrynProtocolAdr  = sovrynProtocol.address.toLowerCase();
    conf.loanTokenSUSD = loanTokenDoc.address.toLowerCase();
    conf.loanTokenUSDT = loanTokenUsdt.address.toLowerCase();
    conf.loanTokenBPRO = loanTokenBpro.address.toLowerCase();
    conf.loanTokenRBTC = loanTokenWrbtc.address.toLowerCase();

    // also deal with accounts
    A.liquidator = [
        {adr: accounts[5]}
    ];
    A.rollover = [
        {adr: accounts[6]}
    ];
    A.arbitrage = [
        {adr: accounts[7]}
    ];

    // We also need to re-init contracts, since it stores stuff in constructor
    C.init({
        web3,
        addAccounts: false,
    });

    // And ditto for the DB
    await db.initDb(conf.db);
}