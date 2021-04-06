import { constants } from "@openzeppelin/test-helpers";
import conf from '../../../config/config';
import C from '../../../controller/contract';
import A from '../../../secrets/accounts';

const { ZERO_ADDRESS } = constants;

/**
 * Initialize (read: monkey-patch) Sovryn-Node so that it works for testing.
 *
 * The config and controllers are initialized on startup. Since we want to alter the contract addresses
 * used based on the contracts deployed during testing, we need to resort to monkey-patching.
 */
export function initSovrynNodeForTesting({
    sovrynSwapNetwork,
    wrbtcToken,
    docToken,
    bproToken,
    usdtToken,
    rbtcWrapperProxy,
    accounts,
}) {
    conf.swapsImpl = sovrynSwapNetwork.address.toLowerCase();
    conf.docToken = docToken.address.toLowerCase();
    conf.USDTToken = usdtToken.address.toLowerCase();
    conf.BProToken = bproToken.address.toLowerCase();
    conf.testTokenRBTC = wrbtcToken.address.toLowerCase();
    conf.wRbtcWrapper = rbtcWrapperProxy.address.toLowerCase();
    //conf.priceFeed  // TODO: handle this. contract is PriceFeeds, initialize with wbtc and DoC
    //conf.sovrynProtocolAdr  // TODO: handle this, if needed. contract is sovrynProtocol (Protocol.sol)

    // sane settings for these
    conf.thresholdArbitrage = 1;
    conf.amountArbitrage = 0.01;
    conf.enableDynamicArbitrageAmount = true;

    // Set these just to be safe
    conf.nodeProvider = 'http://example.invalid';
    conf.publicNodeProvider = 'http://example.invalid';
    conf.errorBotTelegram = undefined;

    // Use a different DB too
    conf.db = 'sovryn_node_integration_tests.db';

    // THESE are not yet handled
    conf.loanTokenSUSD = ZERO_ADDRESS;
    conf.loanTokenUSDT = ZERO_ADDRESS;
    conf.loanTokenBPRO = ZERO_ADDRESS;
    conf.loanTokenRBTC = ZERO_ADDRESS;

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
}