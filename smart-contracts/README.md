Sovryn Node V2 Smart Contracts
==============================

Smart contracts and utilities for Watcher V2.

The main contract is `Watcher.sol`. It has two roles, `OWNER`, which can deposit and withdraw funds
and grant other roles, and `EXECUTOR` which can execute transactions.

Installation
------------

```shell
npm install
mkdir secrets
```

Then create `secrets/privatekey.pkey` with your private key, or `secrets/keystore.json` with your keystore file.
The private key is used for the deployer / administrator account.

To make verification on Tenderly work, create an account on [Tenderly](https://tenderly.co),
get the API key from Dashboard > Settings > Authorization, and create file
`$HOME/.tenderly/config.yaml` with contents:
```shell
access_key: MY_API_KEY
```


Unit tests
----------

```shell
npm test
# or
npx hardhat test test/Watcher.test.ts
```

Contract deployment
-------------------

```shell
# Testnet
npx hardhat deploy-watcher \
    --network rsk-testnet \
    --sovryn-protocol 0x25380305f223b32fdb844152abd2e82bc5ad99c3 \
    --sovryn-swap-network 0x61172b53423e205a399640e5283e51fe60ec2256 \
    --price-feeds 0x7f38c422b99075f63c9c919ecd200df8d2cf5bd4 \
    --wrbtc-token 0x69fe5cec81d5ef92600c1a0db1f11986ab3758ab \
    --private-key secrets/privatekey.pkey \
    --verify 
# instead of --private-key, you can use --keystore secrets/keystore.json. it will then prompt for password
# --verify only works if Tenderly is configured, as outlined above

# Mainnet
npx hardhat deploy-watcher \
    --network rsk-testnet \
    --sovryn-protocol 0x5a0d867e0d70fcc6ade25c3f1b89d618b5b4eaa7 \
    --sovryn-swap-network 0x98ace08d2b759a265ae326f010496bcd63c15afc \
    --price-feeds 0x437ac62769f386b2d238409b7f0a7596d36506e4 \
    --wrbtc-token 0x542fda317318ebf1d3deaf76e0b632741a7e677d \
    --private-key secrets/privatekey.pkey \
    --verify 
```

Managing roles
--------------

After deploying, the deployer has the `OWNER` role and nobody has the `EXECUTOR` role yet.
It is necessary to add the `EXECUTOR` role to the arbitrage/liquidator accounts in Sovryn-Node, if V2 is enabled.

```shell
npx hardhat watcher-role \
    ACTION \
    --network NETWORK \
    --watcher WATCHER_ADDRESS \
    --role executor \
    --account ACCOUNT_ADDRESS \
    --private-key ./secrets/privatekey.pkey
```

`ACTION` can be `add`, `remove` or `check`. `NETWORK` is `rsk` or `rsk-testnet`.
For `role` you can pass either `OWNER` or `EXECUTOR` (case insensitive).


Funding the watcher
-------------------

Watcher V2 executes arbitrage and liquidation with funds stored in the contract, so it's necessary to fund it first.
The old approval script is no longer necessary.

To deposit funds, run:

```shell
npx hardhat fund-watcher \
    deposit \
    --network NETWORK \
    --watcher WATCHER_ADDRESS \
    --token TOKEN_ADDRESS \
    --amount 123.45 \
    --private-key ./secrets/privatekey.pkey 
```

`amount` is given in human-readable decimal units, and converted to Wei on deposit. To deposit RBTC directly from
your account, pass `0x0000000000000000000000000000000000000000` as the token address.

To withdraw funds, run:

```shell
npx hardhat fund-watcher \
    withdraw \
    --network NETWORK \
    --watcher WATCHER_ADDRESS \
    --token TOKEN_ADDRESS \
    --amount 123.45 \
    --recipient RECIPIENT_ADDRESS \
    --private-key ./secrets/privatekey.pkey 
```

`recipient` is optional and defaults to the account.
`0x0000000000000000000000000000000000000000` can again be used as the token to directly receive RBTC instead of WRBTC.

To just check current balances without making any transactions, pass `check` in place of `deposit`/`withdraw`.


Enabling Watcher V2 in Sovryn Node
----------------------------------

Watcher V2 is enabled in Sovryn Node with the following configuration options:
```javascript
{
  enableV2: {
    arbitrage: true,
    liquidator: true
  },
  watcherContract: "0x1234567890123456789012345678901234567890"
}
```
