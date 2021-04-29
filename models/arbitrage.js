import common from '../controller/common';
import BaseModel from './baseModel';

export default class Arbitrage extends BaseModel {
    constructor(db) {
        super(db, 'arbitrage', `CREATE TABLE IF NOT EXISTS arbitrage (
            id INTEGER PRIMARY KEY,
            status text,
            adr text,
            dateAdded datetime,
            fromAmount decimal,
            toAmount decimal,
            fromToken text,
            toToken text,
            trade text,
            profit decimal,
            txHash
            )`);
    }


    async createTable() {
        try {
            const walletTable = await super.createTable();

            console.log("Created arbitrage table", walletTable);

            return walletTable;
        } catch (e) {
            console.log('Can not create arbitrage table', e);
        }
    }

    insert(data) {
        return super.insert({
            ...data,
            dateAdded: common.formatDate(Date.now()/1000)
        });
    }

    async getLastIndex() {
        const sql = `SELECT * FROM ${this.table} order by id desc`;

        const last = await this.get(sql);
        console.log(last);
        return last && last.id || 0;
    }
}
