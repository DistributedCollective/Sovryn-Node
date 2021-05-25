import { constants } from "@openzeppelin/test-helpers";
import conf from '../../../config/config';
import C from '../../../controller/contract';
import Wallet from '../../../controller/wallet';
import A from '../../../secrets/accounts';
import db from '../../../controller/db';
import {existsSync, unlinkSync} from 'fs';

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
    ethsToken,
    rbtcWrapperProxy,
    priceFeeds,
    accounts,
    sovrynProtocol,
    loanTokenDoc,
    loanTokenUsdt,
    loanTokenBpro,
    loanTokenWrbtc,
    loanTokenEths,
}) {
    conf.network = 'test';

    conf.swapsImpl = sovrynSwapNetwork.address.toLowerCase();
    conf.docToken = docToken.address.toLowerCase();
    conf.USDTToken = usdtToken.address.toLowerCase();
    conf.BProToken = bproToken.address.toLowerCase();
    conf.testTokenRBTC = wrbtcToken.address.toLowerCase();
    conf.ethsToken = ethsToken.address.toLowerCase();

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

    // Loans
    conf.sovrynProtocolAdr  = sovrynProtocol.address.toLowerCase();
    conf.loanTokenSUSD = loanTokenDoc.address.toLowerCase();
    conf.loanTokenUSDT = loanTokenUsdt.address.toLowerCase();
    conf.loanTokenBPRO = loanTokenBpro.address.toLowerCase();
    conf.loanTokenRBTC = loanTokenWrbtc.address.toLowerCase();
    conf.loanTokenETHs = loanTokenEths.address.toLowerCase();

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

    // and wallet
    Wallet.queue = {
        'liquidator': {
            [A.liquidator[0].adr]: [],
        },
        'rollover': {
            [A.rollover[0].adr]: [],
        }
    };


    // We also need to re-init contracts, since it stores stuff in constructor
    C.init({
        web3,
        addAccounts: false,
    });

    // Use a different DB, clear and initialize it
    const dbFileName = 'sovryn_node_integration_tests.db';
    conf.db = dbFileName;
    const dbPath = `${__dirname}/../../../db/${dbFileName}`
    if (existsSync(dbPath)) {
        unlinkSync(dbPath);
    }
    await db.initDb(conf.db);
}