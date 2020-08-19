# Sovryn liquidation handler

This app reads all open positions from the Sovryn marginTrade contracts and continuosly monitors for changes. 
If margin < maintenance, it initiates liquidation on the contract.
If it fails, it checks if the liquidation criteria are still met.  
If not, it keeps observing. 
If yes, it sends an error notification to a telegram group for manual processing. 
If the tx was not confirmed after 10 minutes, it resends the transaction with a higher gas fee.


### Install

```sh
npm install
```

### Start

```sh
npm run start
```



License
----

MIT


**Free Software, Hell Yeah!**
