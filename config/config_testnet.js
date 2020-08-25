//todo: move bot-tokens to secrets
export default  {
    serverPort: 3000,
    nodeProvider: 'http://18.138.223.132:4444', 
    publicNodeProvider: 'https://public-node.testnet.rsk.co', 
    network: "test",
    nrOfProcessingLoans: 10, //need to find appropriate nr
    waitBetweenRounds: 60,
    testTokenSUSD: "0xE631653c4Dc6Fb98192b950BA0b598f90FA18B3E",
    testTokenRBTC: "0xE53d858A78D884659BF6955Ea43CBA67c0Ae293F",
    loanTokenSUSD: "0xC6Aa9E9C18021Db79eDa87a8E58dD3c146A6b1E5",
    loanTokenRBTC: "0xc4F9857B4bb568C10aD68C092D058Fc8d36Ce4b0",
    bzxProtocolAdr: "0xBAC609F5C8bb796Fa5A31002f12aaF24B7c35818",
    errorBotNodeTelegramToken: "1330614964:AAGK2vmqr61N-RS5e1YQ-vi_eryTzvU0WBM",
    errorBotWatcherTelegramToken: "1187325835:AAH-sH6F0znu2QAVgTNztXCRJVe0DpWy884",
    sovrynInternalTelegramId: -1001308978723,
    healthMonitorPort: 1 //results in 3001
}