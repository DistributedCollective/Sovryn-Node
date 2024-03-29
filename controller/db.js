/**
 * Datbase controller.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

import Arbitrage from '../models/arbitrage';
import Rollover from '../models/rollover';
import Liquidator from '../models/liquidator';
import A from '../controller/arbitrage';
import config from '../config/config';


class DbCtrl {

    async initDb(dbName) {
        return new Promise(resolve => {
            const file = path.join(__dirname, '../db/' + dbName);
            this.db = new sqlite3.Database(file, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error(err.message, file);
                } else {

                    console.log('Connected to the ' + dbName + ' database.');

                    this.initRepos().catch(console.error).then(() => resolve());
                }
            });
        });
    }

    /**
     * @private
     */
    async initRepos() {
        try {
            this.arbRepo = new Arbitrage(this.db);
            this.rollRepo = new Rollover(this.db);
            this.liqRepo = new Liquidator(this.db);
            await this.arbRepo.createTable();
            await this.rollRepo.createTable();
            await this.liqRepo.createTable();
        } catch (e) {
            console.error(e);
        }
    }


    async addLiquidate({liquidatorAdr, liquidatedAdr, amount, pos, loanId, profit, txHash, status}) {
        try {
            return await this.liqRepo.insert({
                liquidatorAdr,
                liquidatedAdr,
                amount,
                pos,
                loanId,
                profit,
                txHash,
                status
            })
        } catch (e) {
            console.error(e);
        }
    }

    async addArbitrage({adr, fromToken, toToken, fromAmount, toAmount, profit, trade, txHash, status}) {
        try {
            return await this.arbRepo.insert({
                adr, fromToken, toToken,
                fromAmount, toAmount, profit, trade,
                txHash, status
            })
        } catch (e) {
            console.error(e);
        }
    }

    async addRollover({loanId, txHash, rolloverAdr, rolledoverAdr, amount, status, pos, fee}) {
        try {
            return await this.rollRepo.insert({
                loanId,
                txHash,
                rolloverAdr,
                rolledoverAdr,
                amount,
                status,
                pos,
                fee
            });
        } catch (e) {
            console.error(e);
        }
    }

    async getTotals(repo, last24H) {
        try {
            let table;
            let profit = 0;
            switch(repo) {
                case 'liquidator': table = this.liqRepo; break;
                case 'arbitrage': table = this.arbRepo; break;
                case 'rollover': table = this.rollRepo; break;
                default: console.warn("Not a known table. Returning liquidations table as default"); table = this.liqRepo;
            }
            const sqlQuery = last24H ? // select either all actions or only the last 24h ones
                `SELECT * FROM ${repo} WHERE dateAdded BETWEEN DATETIME('now', '-1 day') AND DATETIME('now')` :
                `SELECT * FROM ${repo}`;
            const allRows = await table.all(sqlQuery, (err, rows) => { return rows });
            const usdPrices = await A.getUsdPrices();
            allRows.forEach((row) => {
                if (repo === 'liquidator') {
                    if (row.profit) {
                        let [profitValue, symbol] = row.profit.split(' ');
                        symbol = symbol.toLowerCase();
                        const symbolPrice = usdPrices[symbol] ? usdPrices[symbol] : 1;
                        const fee = config.liquidationTxFee * usdPrices['rbtc'] || 0;
                        profit += (Number(profitValue) * symbolPrice - fee);
                    }
                } else if (repo === 'rollover') {
                    if (row.amount) {
                        let [amount, symbol] = String(row.amount).split(' ');
                        symbol = symbol || 'rbtc';
                        const symbolPrice = usdPrices[symbol] ? usdPrices[symbol] : 1;
                        // const fee = Number(row.fee) * usdPrices['rbtc'] || 0;
                        let [fee, symbolFee] = row.fee.split(' ');
                        symbolFee = (symbolFee || 'rbtc').toLowerCase();

                        profit += (Number(amount) * symbolPrice - Number(fee) * usdPrices[symbolFee]);
                    }
                } else {
                    profit += Number(row.profit);
                }
                return row;
            })
            return { totalActionsNumber: allRows.length, profit };
        } catch (e) {
            console.error(e);
        }
    }
}

export default new DbCtrl();
