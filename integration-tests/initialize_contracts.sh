#!/bin/bash
# Copy wanted contract files from git submodules to the `contract` dir, used by hardhat

set -e
cd "$(dirname "$0")"  # cd to the dir this script is in

# Clean hardhat directories
rm -rf cache artifacts contracts/copied
mkdir contracts/copied

# AMM
cp -vr oracle-based-amm/solidity/contracts contracts/copied/amm

# RBTCWrapperProxy
cp -vr oracle-based-amm/rbtcwrapperproxy/ contracts/copied/rbtc

# Sovryn-smart-contracts
# NOTE: instead of copying all contracts, we just copy what we need (at least for now)
mkdir -p contracts/copied/sovryn/feeds/testnet
mkdir -p contracts/copied/sovryn/interfaces
cp -vr sovryn-smart-contracts/contracts/feeds/{PriceFeedsConstants,PriceFeeds}.sol contracts/copied/sovryn/feeds/
cp -vr sovryn-smart-contracts/contracts/feeds/testnet/PriceFeedsLocal.sol contracts/copied/sovryn/feeds/testnet/
cp -vr sovryn-smart-contracts/contracts/interfaces/{IWrbtcERC20,IWrbtc,IERC20}.sol contracts/copied/sovryn/interfaces
cp -vr sovryn-smart-contracts/contracts/openzeppelin contracts/copied/sovryn/openzeppelin

echo "All contracts copied."
