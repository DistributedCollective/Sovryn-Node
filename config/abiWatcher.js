export default [
    {
        "inputs": [
            {
                "internalType": "contract ISovrynSwapNetwork",
                "name": "_sovrynSwapNetwork",
                "type": "address"
            },
            {
                "internalType": "contract ISovryn",
                "name": "_sovrynProtocol",
                "type": "address"
            },
            {
                "internalType": "contract IPriceFeeds",
                "name": "_priceFeeds",
                "type": "address"
            },
            {
                "internalType": "contract IWRBTCToken",
                "name": "_wrbtcToken",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "_beneficiary",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "_sourceToken",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "_targetToken",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_sourceTokenAmount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_targetTokenAmount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_priceFeedAmount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_profit",
                "type": "uint256"
            }
        ],
        "name": "Arbitrage",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "contract IERC20[]",
                "name": "_conversionPath",
                "type": "address[]"
            },
            {
                "internalType": "uint256",
                "name": "_amount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_minProfit",
                "type": "uint256"
            }
        ],
        "name": "arbitrage",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract IERC20",
                "name": "_tokenA",
                "type": "address"
            },
            {
                "internalType": "contract IERC20",
                "name": "_tokenB",
                "type": "address"
            }
        ],
        "name": "checkArbitrage",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "contract IERC20[]",
                "name": "",
                "type": "address[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "loanId",
                "type": "bytes32"
            },
            {
                "internalType": "address",
                "name": "receiver",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "closeAmount",
                "type": "uint256"
            }
        ],
        "name": "liquidate",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "loanCloseAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "seizedAmount",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "seizedToken",
                "type": "address"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "priceFeeds",
        "outputs": [
            {
                "internalType": "contract IPriceFeeds",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "sovrynProtocol",
        "outputs": [
            {
                "internalType": "contract ISovryn",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "sovrynSwapNetwork",
        "outputs": [
            {
                "internalType": "contract ISovrynSwapNetwork",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "wrbtcToken",
        "outputs": [
            {
                "internalType": "contract IWRBTCToken",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "stateMutability": "payable",
        "type": "receive"
    }
];
