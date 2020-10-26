import BaseModel from './baseModel';

export default class Arbitrage extends BaseModel {
    constructor(db) {
        super(db, 'arbitrage', `CREATE TABLE IF NOT EXISTS arbitrage (
            id INTEGER PRIMARY KEY,
            adr text,
            pKey text,
            dateAdded datetime,
            amount text,
            amountAfter text,
            pos text,
            loanId text,
            active Boolean,
            closed Boolean
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
            dateAdded: new Date()
        });
    }

    async getLastIndex() {
        const sql = `SELECT * FROM ${this.table} order by id desc`;

        const last = await this.get(sql);
        console.log(last);
        return last && last.id || 0;
    }
}
