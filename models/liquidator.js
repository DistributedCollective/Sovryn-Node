import BaseModel from './baseModel';

export default class Arbitrage extends BaseModel {
    constructor(db) {
        super(db, 'arbitrage', `CREATE TABLE IF NOT EXISTS arbitrage (
            id INTEGER PRIMARY KEY,
            liquidatorAdr text,
            liquidatedAdr text,
            dateAdded datetime,
            amount text,
            pos text,
            loanId text,
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
}
