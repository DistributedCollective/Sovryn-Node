import telegramBot from '../secrets/telegram.js';

export default  {
    serverPort: 3000,
    nodeProvider: 'https://testnet.sovryn.app/rpc',  
    publicNodeProvider: 'https://public-node.testnet.rsk.co', 
    network: "test",
    db: "watcher_testnet.db",
    nrOfProcessingPositions: 100, //need to find appropriate nr
    scannerInterval: 60, //in seconds
    rolloverScanInterval: 60, //in seconds
    liquidatorScanInterval: 10, //in seconds
    arbitrageScanInterval: 30, //in seconds
    enableLiquidator: true,
    enableRollover: true,
    enableArbitrage: true,
    testTokenRBTC: "0x69FE5cEC81D5eF92600c1A0dB1F11986AB3758Ab", //wrbtc
    loanTokenSUSD: "0x74e00A8CeDdC752074aad367785bFae7034ed89f", //underlying token = doc
    loanTokenRBTC: "0xe67Fe227e0504e8e96A34C3594795756dC26e14B",
    docToken: "0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0", //former susd
    sovrynProtocolAdr: "0x25380305f223B32FDB844152abD2E82BC5Ad99c3",
    swapsImpl: "0x61172B53423E205a399640e5283e51FE60EC2256",
    priceFeed: "0x7f38c422b99075f63C9c919ECD200DF8d2Cf5BD4",
    thresholdArbitrage: 2, //in %
    errorBotTelegram: telegramBot,
    sovrynInternalTelegramId: -1001308978723,
    healthMonitorPort: 3 //results in 3003
}