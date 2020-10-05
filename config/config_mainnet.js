import {errorBotNodeTelegramToken, errorBotWatcherTelegramToken} from '../secrets/telegram';

export default {
    serverPort: 3000,
    nodeProvider: 'https://mainnet.sovryn.app/rpc', 
    publicNodeProvider: 'https://public-node.rsk.co',
    network: "main",
    nrOfProcessingPositions: 100, //need to find appropriate nr
    waitBetweenRounds: 60, //in seconds
    testTokenRBTC: "0xa9DcDC63eaBb8a2b6f39D7fF9429d88340044a7A", //wrbtc
    loanTokenSUSD: "0xd8D25f03EBbA94E15Df2eD4d6D38276B595593c1", //underlying token = doc
    loanTokenRBTC: "0xb01f116199C5eE8e2977b0a9280fE392c4162838",
    docToken: "0xe700691da7b9851f2f35f8b8182c69c53ccad9db", //former susd
    sovrynProtocolAdr: "0x5A0D867e0D70Fcc6Ade25C3F1B89d618b5B4Eaa7",
    errorBotNodeTelegramToken: errorBotNodeTelegramToken,
    errorBotWatcherTelegramToken: errorBotWatcherTelegramToken,
    sovrynInternalTelegramId: -1001308978723,
    healthMonitorPort: 10 //results in 3010
}