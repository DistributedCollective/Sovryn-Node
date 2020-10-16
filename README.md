# Sovryn watcher

The app has three main functions: Liquidation and rollover of open positions,  
It reads all open positions from the Sovryn marginTrade contracts and continuosly monitors for changes. 
  

## Liquidation handling
 
If margin < maintenance, it initiates liquidation on the contract.  
If it fails, it checks if the liquidation criteria are still met.    
If not, it keeps observing.  
If yes, it sends an error notification to a telegram group for manual processing.  
If the tx was not confirmed after 10 minutes, it resends the transaction with a higher gas fee.  

The liquidator needs considerable funds in all currencies provided to be able to liquidate a position. He needs to allow the protocol contract to access his tokens in advance (Approve tokens) and have enough RBTC to cover transaction costs.
  

## Rollover

When the maximum loan duration has been exceeded, the position will need to be rolled over.
The function rollover on the protocol contract extends the loan duration by the maximum term (28 days for margin trades at the moment of writing), pays the interest to the lender and refunds the caller for the gas cost by sending 2 * the gas cost using the fast gas price as base for the calculation.
 
  

### Requirements

NodeJs > 12.1  
Nodemon  
Webpack  


### Install

```sh
1. npm install
2. npm run build-client
3. Create empty directory "logs"
4. Create directory "secrets" and within a file account.js with the credentials of the liquidator and rollover wallets 

export default {
    liquidator: [{
        adr: "",
        pKey: ""
    },
    ...
    ],
    rollover: [{
        adr: "",
        pKey: ""
    },
    ...
    ]
}
```


### Start

```sh
npm run start:[mainnet || testnet]
```
Check  
http://your-ip:3000/ to see some liquidation processing info


### Logging
The watcher uses pm2 for log handling.    
To enable Log-rotationdo "pm2 install pm2-logrotate" and afterwards "pm2 set pm2-logrotate:max_size 100K"   

License
----

MIT
**Free Software, Hell Yeah!**
