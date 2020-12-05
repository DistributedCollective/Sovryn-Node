import telegramBot from '../secrets/telegram.js';

export default  {
    serverPort: 3000,
    nodeProvider: 'https://testnet.sovryn.app/rpc',
    publicNodeProvider: 'https://public-node.testnet.rsk.co',
    network: "test",
    db: "watcher_testnet.db",
    nrOfProcessingPositions: 100,
    scannerInterval: 60, //sec
    rolloverScanInterval: 60, //sec
    liquidatorScanInterval: 60, //sec
    arbitrageScanInterval: 30, //sec
    enableLiquidator: true,
    enableRollover: true,
    enableArbitrage: true,
    rolloverMinThreshold: 0.000052*2, //Btc 0,000052 = failing tx cost
    testTokenRBTC: "0x69FE5cEC81D5eF92600c1A0dB1F11986AB3758Ab", //wrbtc
    loanTokenSUSD: "0x74e00A8CeDdC752074aad367785bFae7034ed89f", //underlying token = doc
    loanTokenRBTC: "0xe67Fe227e0504e8e96A34C3594795756dC26e14B",
    docToken: "0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0", //former susd
    sovrynProtocolAdr: "0x25380305f223B32FDB844152abD2E82BC5Ad99c3",
    swapsImpl: "0x61172B53423E205a399640e5283e51FE60EC2256", //get price from amm/old execute swaps
    priceFeed: "0x7f38c422b99075f63C9c919ECD200DF8d2Cf5BD4", //get oracle price
    wRbtcWrapper: "0x55684391E3d0Cf69f41c40ddF736BD1C6D3D538c", //execute swaps new (sending rbtc directly)
    thresholdArbitrage: 2, //in %
    errorBotTelegram: telegramBot,
    sovrynInternalTelegramId: -1001308978723,
    healthMonitorPort: 3, //results in 3003
    gasPriceBuffer: 10 //in %
}
