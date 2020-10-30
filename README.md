# Sovryn watcher

The watcher reads all open positions from the Sovryn marginTrade contracts and continuosly monitors for changes. 
The app has three main functions: Liquidation of open positions, rollover of open positions and taking advantage of arbitrage opportunities on the amm.  
  

## 1. Liquidation handling
 
If margin < maintenance, it initiates liquidation on the contract.  
If it fails, it checks if the liquidation criteria are still met.    
If not, it keeps observing.  
If yes, it sends an error notification to a telegram group for manual processing.  
If the tx was not confirmed after 10 minutes, it resends the transaction with a higher gas fee.  

The liquidator needs considerable funds in all currencies provided to be able to liquidate a position. He needs to allow the protocol contract to access his tokens in advance (Approve tokens) and have enough RBTC to cover transaction costs.
  

## 2. Rollover

When the maximum loan duration has been exceeded, the position will need to be rolled over.
The function "rollover" on the protocol contract extends the loan duration by the maximum term (28 days for margin trades at the moment of writing) and pays the interest to the lender. The callers reward is 0.1% of the position size and receives 2 * the gas cost using the fast gas price as base for the calculation as well as 0.1% .
 

## 3. Arbitrage

Earn $ through abitrage: if the expected price from the amm deviates more than 2 % from the oracle price buy the side which is off and exchange the money back on money onchain.


### Requirements

NodeJs > 12.1  
Nodemon  
Webpack  


### Install

```sh
1. npm install
2. npm run build-client
3. Create empty directory "logs"
4. Create directory "secrets" and within a file account.js with the credentials of the liquidator/rollover/arbitrage wallets 

export default {
    ["liquidator"/"rollover"/"arbitrage"]: [{
        adr: "",
        pKey: ""
    },
}

To receive notifications on telegram about new transactions and errors create a telegram bot-token-id and write in in a file /secrets/telegram.js
export default "[telegram-bot-token]";
export default ""; for no notifications

5. Charge the watcher wallets with RBtc and Doc
6. Execute util/approval.js to approve the Sovryn smart contract to spend Doc on behalf of the watcher wallets  as well as the swap network contract to spend
Doc on behalf of the arbitrage wallet.

```


### Start

```sh
npm run start:[mainnet || testnet]
```
Check  
http://your-ip:3000/ to see some liquidation processing info


### Logging
The watcher uses pm2 for log handling.    
To enable Log-rotationdo "pm2 install pm2-logrotate" and afterwards "pm2 set pm2-logrotate:max_size 1000K"   

License
----

MIT
**Free Software, Hell Yeah!**
