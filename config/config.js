import conf_mainnet from "./config_mainnet";
import conf_testnet from "./config_testnet";

let config = conf_testnet;
if (process.argv && process.argv[2]=="mainnet") config = conf_mainnet;

export default config;
