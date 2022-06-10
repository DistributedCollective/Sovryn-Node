import telegramBot from '../secrets/telegram.js';

export default {
    serverPort: 3000,
    nodeProvider: 'https://testnet.sovryn.app/rpc',
    publicNodeProvider: 'https://public-node.testnet.rsk.co',
    blockExplorer: 'https://explorer.testnet.rsk.co/',
    network: "test",
    db: "sovryn_node_testnet.db",
    nrOfProcessingPositions: 100,
    scannerInterval: 60, //sec
    rolloverScanInterval: 180, //sec
    liquidatorScanInterval: 60, //sec
    arbitrageScanInterval: 30, //sec
    enableLiquidator: true,
    enableRollover: true,
    enableArbitrage: true,
    enableV2: {
        arbitrage: true,
        liquidator: true,
    },
    watcherContract: null,
    enableSwapback: true,  // v2 only: swap back to loan token after liquidation if profitable and collateral token is not a stablecoin
    rolloverMinThreshold: 0.000052*2, //Btc 0,000052 = failing tx cost
    loanTokenSUSD: "0x74e00a8ceddc752074aad367785bfae7034ed89f", //underlying token = doc
    loanTokenRBTC: "0xe67fe227e0504e8e96a34c3594795756dc26e14b",
    loanTokenUSDT: "0xd1f225beae98ccc51c468d1e92d0331c4f93e566",
    loanTokenBPRO: "0x6226b4b3f29ecb5f9eec3ec3391488173418dd5d",
    testTokenRBTC: "0x69fe5cec81d5ef92600c1a0db1f11986ab3758ab", //wrbtc
    docToken: "0xcb46c0ddc60d18efeb0e586c17af6ea36452dae0", //former susd
    USDTToken: "0x4d5a316d23ebe168d8f887b4447bf8dbfa4901cc",
    BProToken: "0x4da7997a819bb46b6758b9102234c289dd2ad3bf",
    XUSDToken: "0x74858FE37d391f81F89472e1D8BC8Ef9CF67B3b1",
    ethsToken: "0x499bb1355b36adeb93706b08a897ce6022de6ac9",
    sovToken: "0x6a9a07972d07e58f0daf5122d11e069288a375fb",
    sovrynProtocolAdr: "0x25380305f223b32fdb844152abd2e82bc5ad99c3",
    swapsImpl: "0x61172b53423e205a399640e5283e51fe60ec2256", //get price from amm/old execute swaps
    priceFeed: "0x7f38c422b99075f63c9c919ecd200df8d2cf5bd4", //get oracle price
    wRbtcWrapper: "0x55684391e3d0cf69f41c40ddf736bd1c6d3d538c", //execute swaps new (sending rbtc directly)
    balanceThresholds: {
        doc: 100, // in doc
        usdt: 100, // in usdt
        bpro: 0.01, // in bpro
        wrbtc: 0.01, // in wrbtc
        xusd: 1000
    },
    thresholdArbitrage: 0.1, //in %
    amountArbitrage: 0.05, //in rbtc
    enableDynamicArbitrageAmount: true,
    dynamicArbitrageMaxAmounts: {
        rbtc: '1',
        default: '100000',
        xusd: '10000',
    },
    errorBotTelegram: telegramBot,
    sovrynInternalTelegramId: -492690059,
    gasPriceBuffer: 10, //in %
    gasLimit: 2500000,
    maintenanceMarginBuffer: 0.95,  // <= 1.0 Require buffer when liquidating to avoid errors if price bounces back
    minSeizableAmount: 2, //in usd
    liquidationTxFee: 0.000042, //rbtc tx fee of liquidate + swapback
}
