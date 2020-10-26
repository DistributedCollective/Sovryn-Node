
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

import BotModel from '../models/bot';

class DbCtrl {

    async initDb(dbName) {
        return new Promise(resolve => {
            const file = path.join(__dirname, '../db/' + dbName + ".db");
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
            this.botRepository = new BotModel(this.db);

            await this.botRepository.createTable();
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

    async deActiveBots(bots) {
        try {
            for (let bot of bots) {
                await this.botRepository.update({adr: bot.adr}, {active: 0});
            }
        } catch (e) {
            console.log(e);
        }
    }

    async updateBot(botAdr, updateInfo) {
        return await this.botRepository.update({adr: botAdr}, updateInfo);
    }

    async findActiveBots() {
        try {
            const list = await this.botRepository.find({active: 1});
            return list || [];
        } catch (e) {
            console.log(e);
            return [];
        }
    }

    async getLastBotIndex() {
        return this.botRepository.getLastIndex();
    }

    async listLastBots(nr = 50) {
        return await this.botRepository.find({}, {limit: nr, orderBy: {id: -1}});
    }
}

export default new DbCtrl();
