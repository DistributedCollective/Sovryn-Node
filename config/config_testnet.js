import {errorBotNodeTelegramToken, errorBotWatcherTelegramToken} from '../secrets/telegram';

export default  {
    serverPort: 3000,
    nodeProvider: 'https://testnet.sovryn.app/rpc', 
    publicNodeProvider: 'https://public-node.testnet.rsk.co', 
    network: "test",
    nrOfProcessingPositions: 10, //need to find appropriate nr
    waitBetweenRounds: 40, //in seconds, should be > than blocktime
    testTokenRBTC: "0x69FE5cEC81D5eF92600c1A0dB1F11986AB3758Ab", //wrbtc
    loanTokenSUSD: "0x74e00A8CeDdC752074aad367785bFae7034ed89f", //underlying token = doc
    loanTokenRBTC: "0xe67Fe227e0504e8e96A34C3594795756dC26e14B",
    docToken: "0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0", //former susd
    sovrynProtocolAdr: "0x25380305f223B32FDB844152abD2E82BC5Ad99c3",
    errorBotNodeTelegramToken: errorBotNodeTelegramToken,
    errorBotWatcherTelegramToken: errorBotWatcherTelegramToken,
    sovrynInternalTelegramId: -1001308978723,
    healthMonitorPort: 3 //results in 3003
}