#!/bin/bash
# Copy wanted contract files from git submodules to the `contract` dir, used by hardhat

set -e
cd "$(dirname "$0")"  # cd to the dir this script is in

# Clean hardhat directories
rm -rf cache artifacts contracts
mkdir contracts

# AMM
cp -vr oracle-based-amm/solidity/contracts contracts/amm

# RBTCWrapperProxy
cp -vr oracle-based-amm/rbtcwrapperproxy/ contracts/rbtc

# Sovryn-smart-contracts
# NOTE: instead of copying all contracts, we just copy what we need (at least for now)
mkdir -p contracts/sovryn/feeds/testnet
mkdir -p contracts/sovryn/interfaces
cp -vr sovryn-smart-contracts/contracts/feeds/{PriceFeedsConstants,PriceFeeds}.sol contracts/sovryn/feeds/
cp -vr sovryn-smart-contracts/contracts/feeds/testnet/PriceFeedsLocal.sol contracts/sovryn/feeds/testnet/
cp -vr sovryn-smart-contracts/contracts/interfaces/{IWrbtcERC20,IWrbtc,IERC20}.sol contracts/sovryn/interfaces
cp -vr sovryn-smart-contracts/contracts/openzeppelin contracts/sovryn/openzeppelin

echo "All contracts copied."
