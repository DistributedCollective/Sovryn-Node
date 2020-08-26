# Sovryn liquidation handler

This app reads all open positions from the Sovryn marginTrade contracts and continuosly monitors for changes.   
If margin < maintenance, it initiates liquidation on the contract.  
If it fails, it checks if the liquidation criteria are still met.    
If not, it keeps observing.  
If yes, it sends an error notification to a telegram group for manual processing.  
If the tx was not confirmed after 10 minutes, it resends the transaction with a higher gas fee.  

The liquidator needs considerable funds in all currencies provided to be able to liquidate a position. He needs to allow the protocol contract to access his tokens in advance (Approve tokens) and have enough RBTC to cover transaction costs.


### Requirements

NodeJs > 12.1  
Nodemon  
Webpack  
  
Pm2 to see the monitor



### Install

```sh
npm install
npm run build-client
create empty directory "logs"
create directory "secrets" and within a file account.js with the credentials of the liquidator (owner of the sovryn smart contract)
```
export default {
    adr: "0xcafecafe",
    pKey: "[your-private-key]"
}

Set the server ip in monitor/config.js  

### Start

```sh
npm run start:[mainnet || testnet]
```
Check  
http://your-ip:3000/ to see some liquidation processing info and the current node-status  
http://your-ip:3000/monitor pm2-observer of the app  


License
----

MIT
**Free Software, Hell Yeah!**
