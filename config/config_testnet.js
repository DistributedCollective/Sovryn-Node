import {errorBotNodeTelegramToken, errorBotWatcherTelegramToken} from '../secrets/telegram';

export default  {
    serverPort: 3000,
    nodeProvider: 'http://18.138.223.132:4444', 
    publicNodeProvider: 'https://public-node.testnet.rsk.co', 
    network: "test",
    nrOfProcessingPositions: 10, //need to find appropriate nr
    waitBetweenRounds: 60, //in seconds
    testTokenSUSD: "0xE631653c4Dc6Fb98192b950BA0b598f90FA18B3E",
    testTokenRBTC: "0xE53d858A78D884659BF6955Ea43CBA67c0Ae293F",
    loanTokenSUSD: "0xD1A979EDE2c17FCD31800Bed859e5EC3DA178Cb9",
    loanTokenRBTC: "0x08118a219a4e34E06176cD0861fcDDB865771111",
    sovrynProtocolAdr: "0x74808B7a84327c66bA6C3013d06Ed3DD7664b0D4",
    errorBotNodeTelegramToken: errorBotNodeTelegramToken,
    errorBotWatcherTelegramToken: errorBotWatcherTelegramToken,
    sovrynInternalTelegramId: -1001308978723,
    healthMonitorPort: 3 //results in 3003
}