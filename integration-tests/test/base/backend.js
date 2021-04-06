import { constants } from "@openzeppelin/test-helpers";
import conf from '../../../config/config';
import C from '../../../controller/contract';

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
}) {
    conf.swapsImpl = sovrynSwapNetwork.address.toLowerCase();
    conf.docToken = docToken.address.toLowerCase();
    conf.USDTToken = usdtToken.address.toLowerCase();
    conf.BProToken = bproToken.address.toLowerCase();
    conf.testTokenRBTC = wrbtcToken.address.toLowerCase();
    conf.wRbtcWrapper = rbtcWrapperProxy.address.toLowerCase();
    //conf.priceFeed  // TODO: handle this. contract is PriceFeeds, initialize with wbtc and DoC
    //conf.sovrynProtocolAdr  // TODO: handle this, if needed. contract is sovrynProtocol (Protocol.sol)
    // TODO: arbitrager etc addresses

    // THESE are not yet handled
    conf.loanTokenSUSD = ZERO_ADDRESS;
    conf.loanTokenUSDT = ZERO_ADDRESS;
    conf.loanTokenBPRO = ZERO_ADDRESS;
    conf.loanTokenRBTC = ZERO_ADDRESS;

    // Set these just to be safe
    conf.nodeProvider = 'http://example.invalid';
    conf.publicNodeProvider = 'http://example.invalid';
    conf.errorBotTelegram = undefined;

    // Use a different DB too
    conf.db = 'sovryn_node_integration_tests.db';

    // We also need to re-init contracts, since it stores stuff in constructor
    C.init(web3);
}