#!/bin/bash
# Copy wanted contract files from git submodules to the `contract` dir, used by hardhat

set -e
cd "$(dirname "$0")"  # cd to the dir this script is in

# Clean hardhat directories
rm -rf cache artifacts contracts/copied
rm -rf contracts/amm contracts/rbtc contracts/sovryn  # these might be left over from directory structure revamp
mkdir contracts/copied

# AMM
cp -vr oracle-based-amm/solidity/contracts contracts/copied/amm

# RBTCWrapperProxy
cp -vr oracle-based-amm/rbtcwrapperproxy/ contracts/copied/rbtc
rm -f contracts/copied/rbtc/WRBTC.sol  # this comes from sovryn-smart-contracts

# Sovryn-smart-contracts
cp -vr sovryn-smart-contracts/contracts contracts/copied/sovryn

echo "All contracts copied."
