import telegramBot from '../secrets/telegram.js';

export default {
    serverPort: 3001,
    nodeProvider: 'https://mainnet.sovryn.app/rpc', 
    publicNodeProvider: 'https://public-node.rsk.co',
    blockExplorer: 'https://explorer.rsk.co/',
    network: "main",
    db: "sovryn_node_mainnet.db",
    nrOfProcessingPositions: 100,
    scannerInterval: 20, //sec
    rolloverScanInterval: 10, //sec
    liquidatorScanInterval: 20, //sec
    arbitrageScanInterval: 60,
    enableLiquidator: true,
    enableRollover: true,
    enableArbitrage: true,
    enableV2: {
        arbitrage: true,
        liquidator: true,
    },
    watcherContract: "0x051B89F575FcD540f0A6A5b49c75f9a83Bb2Cf07".toLowerCase(),
    enableSwapback: true,  // v2 only: swap back to loan token after liquidation if profitable and collateral token is not a stablecoin
    loanTokenSUSD: "0xd8d25f03ebba94e15df2ed4d6d38276b595593c1", //underlying token = doc
    loanTokenRBTC: "0xa9dcdc63eabb8a2b6f39d7ff9429d88340044a7a",
    loanTokenUSDT: "0x849c47f9c259e9d62f289bf1b2729039698d8387",
    loanTokenBPRO: "0x6e2fb26a60da535732f8149b25018c9c0823a715",
    testTokenRBTC: "0x542fda317318ebf1d3deaf76e0b632741a7e677d", //wrbtc
    docToken: "0xe700691da7b9851f2f35f8b8182c69c53ccad9db", //former susd
    USDTToken: "0xef213441a85df4d7acbdae0cf78004e1e486bb96",
    BProToken: "0x440cd83c160de5c96ddb20246815ea44c7abbca8",
    XUSDToken: "0xb5999795be0ebb5bab23144aa5fd6a02d080299f",
    ethsToken: "0x1d931bf8656d795e50ef6d639562c5bd8ac2b78f",
    sovToken: "0xefc78fc7d48b64958315949279ba181c2114abbd",
    sovrynProtocolAdr: "0x5a0d867e0d70fcc6ade25c3f1b89d618b5b4eaa7",
    swapsImpl: "0x98ace08d2b759a265ae326f010496bcd63c15afc", //get price from amm/old execute swaps
    priceFeed: "0x437ac62769f386b2d238409b7f0a7596d36506e4", //get oracle price
    wRbtcWrapper: "0xa3b6e18b9a4ecae44c7355458ae7db8874018c22",
    balanceThresholds: {
        doc: 10000,
        usdt: 10000,
        bpro: 0.1,
        xusd: 10000,
        sov: 1000,
        eths: 3,
        wrbtc: 1,
        rbtc: 0.01,
    },
    thresholdArbitrage: 0.1, //in %
    amountArbitrage: 0.01, //in rbtc
    enableDynamicArbitrageAmount: true,
    dynamicArbitrageMaxAmounts: {
        rbtc: '0.3',
        default: '10000',
        xusd: '10000',
    },
    errorBotTelegram: telegramBot,
    sovrynInternalTelegramId: -1001308978723,
    gasPriceBuffer: 11, //in %
    gasLimit: 2500000,
    maintenanceMarginBuffer: 0.98,  // <= 1.0 Require buffer when liquidating to avoid errors if price bounces back
    minSeizableAmount: 2, //in usd
    liquidationTxFee: 0.000042, //rbtc tx fee of liquidate + swapback
}
