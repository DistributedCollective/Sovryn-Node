Sovryn-Node integration tests
=============================

Tests that run against a local blockchain, so that we don't have to waste time
setting things up in RSK testnet.

Usage:

1. `npm install`
2. `npm run init-contracts  # initializes submodule, copies contracts to ./contracts`
3. `npm test`


Running a single test after initialization:
```
node -r esm node_modules/.bin/hardhat test test/test_sovryn_contracts_setup.js
```