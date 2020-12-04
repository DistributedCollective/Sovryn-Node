import telegramBot from '../secrets/telegram.js';

export default {
    serverPort: 3000,
    nodeProvider: 'https://mainnet.sovryn.app/rpc',
    publicNodeProvider: 'https://public-node.rsk.co',
    network: "main",
    db: "watcher_mainnet.db",
    nrOfProcessingPositions: 100,
    scannerInterval: 60, //sec
    rolloverScanInterval: 60, //sec
    liquidatorScanInterval: 10, //sec
    arbitrageScanInterval: 60,
    enableLiquidator: true,
    enableRollover: true,
    enableArbitrage: true,
    testTokenRBTC: "0x542fDA317318eBF1d3DEAf76E0b632741A7e677d", //wrbtc
    loanTokenSUSD: "0xd8D25f03EBbA94E15Df2eD4d6D38276B595593c1", //underlying token = doc
    loanTokenRBTC: "0xa9DcDC63eaBb8a2b6f39D7fF9429d88340044a7A",
    docToken: "0xe700691da7b9851f2f35f8b8182c69c53ccad9db", //former susd
    sovrynProtocolAdr: "0x5A0D867e0D70Fcc6Ade25C3F1B89d618b5B4Eaa7",
    swapsImpl: "0x98aCE08D2b759a265ae326F010496bcD63C15afc", //get price from amm/old execute swaps
    priceFeed: "0x437AC62769f386b2d238409B7f0a7596d36506e4", //get oracle price
    wRbtcWrapper: "0x78E7e79F1acc1f57a3291d5BfA8436A0771C1800", //real contract not available on this version
    thresholdArbitrage: 2, //in %
    errorBotTelegram: telegramBot,
    sovrynInternalTelegramId: -1001308978723,
    healthMonitorPort: 10, //results in 3010
    gasPriceBuffer: 10 //in %
}
