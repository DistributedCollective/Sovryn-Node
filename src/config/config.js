import conf_mainnet from "./config_mainnet";
import conf_testnet from "./config_testnet";
import conf_testnet_testcontracts from "./config_testnet_testcontracts";

let config = conf_testnet;
if (process.argv && process.argv[2]=="mainnet") config = conf_mainnet;
else if(process.argv && process.argv[2]=="testnet_testcontract") config = conf_testnet_testcontracts;

export default config;
