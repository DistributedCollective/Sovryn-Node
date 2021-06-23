import "@nomiclabs/hardhat-waffle";
import "@tenderly/hardhat-tenderly";
import "./hardhat-tasks";

export default {
    solidity: {
        compilers: [
            {
                version: "0.8.6",
            },
            //{
            //  version: "0.7.3",
            //},
            {
                version: "0.5.17",
            },
        ]
    },
    networks: {
        hardhat: {},
        // NOTE: hardhat-tenderly wants the networks like this for verification to work (it's a bit silly)
        "rsk": {
            url: "https://mainnet2.sovryn.app/rpc",
            network_id: 30,
            confirmations: 4,
            gasMultiplier: 1.25,
        },
        "rsk-testnet": {
            url: "https://testnet.sovryn.app/rpc",
            network_id: 31,
        },
    },
};

