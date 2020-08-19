import Web3 from 'web3';
import c from '../config/config_testnet';
//import abiLoanToken from '../config/abiLoanToken';
//import abiLoanOpeningEvents from "../config/abiLoanopeningEvents.js";
const abiDecoder = require('abi-decoder');

import abiComplete from '../config/abiComplete';
//console.log(abiComplete);

//let web3 = new Web3('http://18.138.223.132:4444');
let web3S = new Web3('ws://18.138.223.132:4445');

let web3 = new Web3('https://public-node.testnet.rsk.co');

//let contractSUSD = new web3.eth.Contract(abiLoanToken.concat(abiLoanOpeningEvents), c.loanTokenSUSD);
let abi = [{ "constant": true, "inputs": [], "name": "name", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "spender", "type": "address" }, { "name": "value", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "sender", "type": "address" }, { "name": "recipient", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "spender", "type": "address" }, { "name": "addedValue", "type": "uint256" }], "name": "increaseAllowance", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "name": "account", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "mint", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [{ "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [], "name": "renounceOwnership", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "owner", "outputs": [{ "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "isOwner", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "account", "type": "address" }], "name": "addMinter", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [], "name": "renounceMinter", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "name": "who", "type": "address" }, { "name": "value", "type": "uint256" }], "name": "burn", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "name": "spender", "type": "address" }, { "name": "subtractedValue", "type": "uint256" }], "name": "decreaseAllowance", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "name": "recipient", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [{ "name": "account", "type": "address" }], "name": "isMinter", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "payable": false, "stateMutability": "nonpayable", "type": "constructor" }, { "payable": false, "stateMutability": "nonpayable", "type": "fallback" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "account", "type": "address" }], "name": "MinterAdded", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "account", "type": "address" }], "name": "MinterRemoved", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "from", "type": "address" }, { "indexed": true, "name": "to", "type": "address" }, { "indexed": false, "name": "value", "type": "uint256" }], "name": "Transfer", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "owner", "type": "address" }, { "indexed": true, "name": "spender", "type": "address" }, { "indexed": false, "name": "value", "type": "uint256" }], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "previousOwner", "type": "address" }, { "indexed": true, "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event" }];
//let contractSUSD = new web3.eth.Contract(abi, "0xb2d705097D9f80D47289EFB2a25bc78FEe9D3e80");
//abiDecoder.addABI(abi);
console.log("start");
let contractBzx = new web3.eth.Contract(abiComplete, c.bzxProtocolAdr);
       
contractBzx.methods.getActiveLoans(5, 10, false).call((error, res) => {
    if (error) {
        console.log("error receiving user loans");
        console.log(error);
    }
    if (res) {
        console.log(res);
    console.log(res.length+" loans found");
    }
});



//console.log(c.loanTokenSUSD)
//console.log(web3.utils.isAddress("0xe2b59CD37D173D550D75e9891376bf21b3f996F1"));

/*
web3.eth.getBalance("0xe2b59CD37D173D550D75e9891376bf21b3f996F1").then((res)=> {
    console.log("get balance")
    console.log(res);
    console.log("-------------------")
});
*/

/*
  web3.eth.getTransactionReceipt("0x57cd76e2c8656178b91a234160a5e618da0adb410dd28f83200d96b6ba3a1183", function (e, receipt) {
      console.log(receipt.logs);
    const decodedLogs = abiDecoder.decodeLogs();
    console.log("decoded");
    console.log(decodedLogs);
  });
*/




let log2 =
{
    logIndex: 0,
    blockNumber: 350770,
    blockHash: '0x6d7e4c75413f9648f3733132abcef7995a1dc650b6ecf0d6a20a93c45fdeee96',
    transactionHash: '0x57cd76e2c8656178b91a234160a5e618da0adb410dd28f83200d96b6ba3a1183',
    transactionIndex: 0,
    address: '0xb2D705097d9f80d47289efB2a25bc78FEe9d3E80',
    data: '0x0000000000000000000000000000000000000000000000008ac7230489e7fda4',
    topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x000000000000000000000000cd8a1c9acc980ae031456573e34dc05cd7dae6e3'
    ],
    id: 'log_1f311017'
};

//rsk, not working
let log1 = {
    logIndex: 0,
    blockNumber: 350770,
    blockHash: '0x6d7e4c75413f9648f3733132abcef7995a1dc650b6ecf0d6a20a93c45fdeee96',
    transactionHash: '0x57cd76e2c8656178b91a234160a5e618da0adb410dd28f83200d96b6ba3a1183',
    transactionIndex: 0,
    address: '0xb2D705097d9f80d47289efB2a25bc78FEe9d3E80',
    id: 'log_0x1f311017592896b1edaa0d75678a974542c9c00890d4e2923ebc1eb854e76109',

    event: 'Transfer',
    signature: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    raw: {
        data: '0x0000000000000000000000000000000000000000000000008ac7230489e7fda4',
        topics: [
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x000000000000000000000000cd8a1c9acc980ae031456573e34dc05cd7dae6e3'
        ]
    }
};


//const decodedLogs = abiDecoder.decodeLogs([log1.raw]);
//console.log("decoded");
//console.log(decodedLogs);