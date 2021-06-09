import common from '../controller/common';
import BaseModel from './baseModel';

export default class Rollover extends BaseModel {
    constructor(db) {
        super(db, 'rollover', `CREATE TABLE IF NOT EXISTS rollover (
            id INTEGER PRIMARY KEY,
            status text,
            rolloverAdr text,
            rolledoverAdr text,
            dateAdded datetime,
            amount text,
            pos text,
            loanId text,
            txHash text
            )`);
    }


    async createTable() {
        try {
            const walletTable = await super.createTable();

            console.log("Created rollover table", walletTable);

            return walletTable;
        } catch (e) {
            console.log('Can not create rollover table', e);
        }
    }

    insert(data) {
        return super.insert({
            ...data,
            dateAdded: common.formatDate(Date.now()/1000)
        });
    }
}
