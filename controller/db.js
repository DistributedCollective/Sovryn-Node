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

    async addBots(bots) {
        try {
            for (let bot of bots) {
                const found = await this.botRepository.findOne({adr: bot.adr});

                if (found) {
                    await this.botRepository.update({id: found.id}, {
                        ...bot,
                        active: 1
                    });
                } else {
                    await this.botRepository.insert({
                        ...bot,
                        active: 1
                    });
                }
            }
        } catch (e) {
            console.log(e);
        }
    }
}

export default new DbCtrl();
