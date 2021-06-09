/** 
* This contract version contain a custom price feed which is arbitrarily settable by the contract owner and does not take price from oracles
*/
import telegramBot from '../secrets/telegram.js';

export default  {
    serverPort: 3000,
    nodeProvider: 'https://testnet.sovryn.app/rpc', 
    publicNodeProvider: 'https://public-node.testnet.rsk.co', 
    network: "test",
    db: "sovryn_node_testnettestcontract.db",
    nrOfProcessingPositions: 100,
    scannerInterval: 60, //sec
    rolloverScanInterval: 60, //sec
    liquidatorScanInterval: 60, //sec
    arbitrageScanInterval: 60,
    enableLiquidator: true,
    enableRollover: true,
    enableArbitrage: false, //not available on this contract version
    testTokenRBTC: "0x21Fa1095205a37aDe78F394B3B984ea3f743bc70", //wrbtc
    loanTokenSUSD: "0x4a050817d9192A4E4a093ea6426D53417c5Eb1FC", //underlying token = susd
    loanTokenRBTC: "0x021Bc6f3c101fC1354A212583a5aF0347FE283Cf",
    docToken: "0xD958866a46F4e7Db1Cc6A80589D0dc44Cbfb155b", //susd
    sovrynProtocolAdr: "0x6E2fb26a60dA535732F8149b25018C9c0823a715",
    swapsImpl: "0x61172B53423E205a399640e5283e51FE60EC2256",//get price from amm/old execute swaps
    priceFeed: "0xE30352CDaa15E4ce5a03583b521DA7aD3C29ff4a", //get oracle price
    wRbtcWrapper: "0x61172B53423E205a399640e5283e51FE60EC2256 ", //real contract not available on this version
    thresholdArbitrage: 2, //in %
    errorBotTelegram: telegramBot,
    sovrynInternalTelegramId: -1001308978723,
    healthMonitorPort: 3 //results in 3003
}