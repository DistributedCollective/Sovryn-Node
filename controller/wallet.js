/**
 * Wallet controller
 * Rsk currently only supports 4 simultaneos transactions per wallet. In order to avoid to use 4x more wallets a transaction queue is needed
 */

import _ from 'lodash';
import config from '../config/config';
import A from '../secrets/accounts';
import C from './contract';
import U from '../util/helper';
import Lock from '../util/lock';

class Wallet {
    constructor() {
        this.txFee = 1e14;

        let liquidationTxs = {};
        for (let liqWallet of A.liquidator)
            liquidationTxs[liqWallet.adr] = 0; // key: loanId, value: { amount, token, nonce }

        let rolloverTxs = {};
        for (let liqWallet of A.rollover)
            rolloverTxs[liqWallet.adr] = 0; // key: loanId, value: { amount, token, nonce }

        this.pendingTxs = {
            'liquidator': liquidationTxs,
            'rollover': rolloverTxs
        };
        this.pendingBalances = {
            'liquidator': {},
            'rollover': {}
        };
        this.lastNonces = {};
    }

    /**
     * Returns the next available wallet with sufficient funds (RBTC or token)
     * False if none could be found
     * @reqTokenBalance in wei
     * Careful: Consider decimals for tokens. Rbtc and Doc have 18
     */
    async getWallet(type, reqTokenBalance, token, parseBalance = parseFloat) {
        const release = await Lock.acquire('getWallet:' + type, '');

        try {
            console.log("Checking wallet of type " + type + ", required token Balance: " + reqTokenBalance + ", for token: " + (token == "rBtc" ? "rBtc" : C.getTokenSymbol(token)));

            const sortedWallets = _.sortBy(A[type], w => {
                return this.pendingTxs[type][w.adr];
            });

            for (let wallet of sortedWallets) {
                const pendingTxs = this.pendingTxs[type][wallet.adr];
                if (pendingTxs >= 4) {
                    console.log('wallet', wallet.adr, 'tx pending', pendingTxs);
                    continue;
                }

                let wBalance;
                if (token === "rBtc") {
                    token = config.testTokenRBTC;
                    wBalance = await C.web3.eth.getBalance(wallet.adr);
                } else {
                    wBalance = await C.getWalletTokenBalance(wallet.adr, token);
                }

                let pendingAmount = this.getPendingAmount(type, wallet.adr, token);
                console.log(`Wallet bal ${String(wBalance)}, pending bal ${String(pendingAmount)} on ${wallet.adr}`,);
                wBalance = parseBalance(wBalance).sub(pendingAmount);
                
                if (wBalance.gt(parseBalance(reqTokenBalance))) {
                    this.pendingTxs[type][wallet.adr]++;
                    release();
                    return [wallet, wBalance];
                }
            }

            //No wallet with enough funds found, return first one with balance > 0
            //return the one with the highest balance
            let res = [null, null];
            for (let wallet of sortedWallets) {
                const pendingTxs = this.pendingTxs[type][wallet.adr];
                if (pendingTxs >= 4) continue;

                let wBalance;
                if (token === "rBtc") {
                    token = config.testTokenRBTC;
                    wBalance = await C.web3.eth.getBalance(wallet.adr);
                } else {
                    wBalance = await C.getWalletTokenBalance(wallet.adr, token);
                }

                let pendingAmount = this.getPendingAmount(type, wallet.adr, token);
                console.log(`1. Wallet bal ${String(wBalance)}, pending bal ${String(pendingAmount)} on ${wallet.adr}`,);
                wBalance = parseBalance(wBalance).sub(pendingAmount);

                if (wBalance.gt(parseBalance('0')) && (res[1] == null || res[1] && wBalance.gt(res[1]))) {
                    res = [wallet, wBalance];
                }
            }

            if (res[0]) {
                this.pendingTxs[type][res[0].adr]++;
            }
            release();

            return res;
        } catch (err) {
            release();
            console.error(err);
            return [];
        }
    }

    checkIfPositionExists(loanId) {
        for (const adr of _.keys(this.pendingBalances['liquidator'])) {
            if (this.pendingBalances['liquidator'][adr][loanId] != null && 
                this.pendingBalances['liquidator'][adr][loanId].token != null
            ) return true;
        }
        return false;
    }

    /**
     * adds a transaction to pending transaction list
     * @param which either 'liq' or 'rol'
     * @param address the wallet address
     * @param loanId the loan Id
     */
    addPendingTx(which, address, loanId, amount, token) {
        this.pendingBalances[which][address] = this.pendingBalances[which][address] || {};
        this.pendingBalances[which][address][loanId] = { amount, token };
    }

    removePendingTx(which, address, loanId) {
        this.pendingTxs[which][address] --;
        this.pendingTxs[which][address] = Math.max(0, this.pendingTxs[which][address]);
        if (this.pendingBalances[which][address]) {
            delete this.pendingBalances[which][address][loanId];
        }
    }

    getPendingAmount(which, address, token) {
        const toBN = C.web3.utils.toBN;
        const pendingBalances = this.pendingBalances[which][address];
        // console.log(this.pendingTxs[which]);
        let amount = toBN('0');
        _.forEach(pendingBalances, tx => {
            if (tx.token.toLowerCase() == token.toLowerCase()) {
                amount = amount.add(toBN(tx.amount));
            }
        });
        return amount;
    }

    countPendingTxs(which, address) {
        return this.pendingTxs[which][address];
    }

    async getNonce(address) {
        const get = async () => {
            const lastNonce = this.lastNonces[address];
            for (let cnt = 0; cnt < 5; cnt++) {
                try {
                    const nonce = await C.web3.eth.getTransactionCount(address, 'pending');
                    if (lastNonce != null && nonce !== lastNonce + 1) {
                        console.log("nonce %d not expected %d", nonce, lastNonce + 1);
                        if (cnt === 4) {
                            console.log("giving up and returning it anyway")
                            return nonce;
                        }
    
                        await U.wasteTime(0.5 ** 2 ** cnt);
                    }
                    else {
                        return nonce;
                    }
                } catch (e) {
                    console.error("Error retrieving transaction count");
                    console.error(e);
                }
            }
    
            const finalNonce = lastNonce + 1 || 0;
            console.error("Returning guessed nonce %d", finalNonce);
            return finalNonce;
        };

        const nonce = await get();
        this.lastNonces[address] = nonce;
        return nonce;
    }
}

export default new Wallet();
