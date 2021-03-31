/**
 * Datbase controller.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

import Arbitrage from '../models/arbitrage';
import Rollover from '../models/rollover';
import Liquidator from '../models/liquidator';


class DbCtrl {

    async initDb(dbName) {
        return new Promise(resolve => {
            const file = path.join(__dirname, '../db/' + dbName);
            this.db = new sqlite3.Database(file, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error(err.message, file);
                } else {

                    console.log('Connected to the ' + dbName + ' database.');

                    this.initRepos().catch(console.log).then(() => resolve());
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
            console.log(e);
        }
    }


    async addLiquidate({liquidatorAdr, liquidatedAdr, amount, pos, loanId, profit, txHash}) {
        try {
            return await this.liqRepo.insert({
                liquidatorAdr,
                liquidatedAdr,
                amount,
                pos,
                loanId,
                profit,
                txHash
            })
        } catch (e) {
            console.log(e);
        }
    }

    async addRollover({loanId, txHash, adr}) {
        try {
            return await this.rollRepo.insert({
                loanId,
                txHash,
                rolloverAdr: adr
            });
        } catch (e) {
            console.log(e);
        }
    }

    async addArbitrage({adr, tokenFrom, tokenTo, amountFrom, amountTo, profit, trade, txHash}) {
        try {
            return await this.arbRepo.insert({
                adr, tokenFrom, tokenTo,
                amountFrom, amountTo, profit, trade,
                txHash
            })
        } catch (e) {
            console.log(e);
        }
    }

    async getTotals(repo) {
        try {
            let table;
            switch(repo) {
                case 'liquidator': table = this.liqRepo; break;
                case 'arbitrage': table = this.arbRepo; break;
                case 'rollover': table = this.rollRepo; break;
                default: console.log("Not a known table. Returning liquidations table as default"); table = this.liqRepo;
            }
            const allActions = await table.all(`SELECT * FROM ${repo}`, (err, rows) => {
                rows.forEach((row) => {
                    return row
                })
            });
            return allActions.length;
        } catch (e) {
            console.log(e);
        }
    }
}

export default new DbCtrl();
