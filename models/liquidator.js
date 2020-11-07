import BaseModel from './baseModel';

export default class Liquidator extends BaseModel {
    constructor(db) {
        super(db, 'liquidator', `CREATE TABLE IF NOT EXISTS liquidator (
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

            console.log("Created liquidator table", walletTable);

            return walletTable;
        } catch (e) {
            console.log('Can not create liquidator table', e);
        }
    }

    insert(data) {
        return super.insert({
            ...data,
            dateAdded: new Date()
        });
    }
}