/**
 *  Accepts client requests and checks the health of the watcher in 60s interval
 *  If the system is not healthy it sends a message to the telegram group
 */
const axios = require('axios');
const Telegram = require('telegraf/telegram');
import A from '../secrets/accounts';
import C from './contract';
import conf from '../config/config';

class MonitorController {

    start(positions, liquidations, posScanner) {
        this.positions = positions;
        this.liquidations = liquidations;
        this.posScanner = posScanner;

        if(conf.errorBotTelegram!="") {
            this.telegramBotWatcher = new Telegram(conf.errorBotTelegram);
            let p = this;
            setInterval(() => {
               // p.checkSystem();
            }, 1000 * 60);
        }
    }

    /**
     * Wrapper for health signals, called from client
     */
    async getSignals(cb) {
        console.log("get signals")
        const resp =
        {
            blockInfoLn: await this.getCurrentBlockPrivateNode(),
            blockInfoPn: await this.getCurrentBlockPublicNode(),
            accountInfoLiq: await this.getAccountInfo(A.liquidator),
            accountInfoRoll: await this.getAccountInfo(A.rollover),
            accountInfoArb: await this.getAccountInfo(A.arbitrage),
            positionInfo: await this.getOpenPositions(),
            liqInfo: await this.getOpenLiquidations()
        }
        if (typeof cb === "function") cb(resp);
        else return resp;
    }

    /**
    * Internal check
    */
    async checkSystem() {
        if (conf.network == "test") return;

        const sInfo = await this.getSignals();
        for (let b in sInfo.accountInfoLiq) {
            if (sInfo.accountInfoLiq[b] < 0.001)
                await this.telegramBotWatcher.sendMessage(conf.sovrynInternalTelegramId, "No money left for liquidator " + b + " on " + conf.network + " network");
        }

        for (let b in sInfo.accountInfoRoll) {
            if (sInfo.accountInfoRoll[b] < 0.001)
                await this.telegramBotWatcher.sendMessage(conf.sovrynInternalTelegramId, "No money left for rollover-wallet " + b + " on " + conf.network + " network");
        }

        for (let b in sInfo.accountInfoArb) {
            if (sInfo.accountInfoArb[b] < 0.001)
                await this.telegramBotWatcher.sendMessage(conf.sovrynInternalTelegramId, "No money left for arbitrage-wallet " + b + " on " + conf.network + " network");
        }
    }

    getCurrentBlockPublicNode() {
        let p = this;
        return new Promise(resolve => {
            axios({
                method: 'post',
                url: conf.publicNodeProvider,
                data: {
                    method: 'eth_blockNumber',
                    jsonrpc: "2.0",
                    params: [],
                    id: 1
                },
                headers: { "Content-Type": "application/json" }
            }).then((response) => {
                if (response.data && response.data.result) {
                    const res = parseInt(response.data.result)
                    resolve(res);
                }
                else resolve(-1);
            })
                .catch((e) => {
                    console.error("error getting block-nr from public node");
                    console.error(e);
                    resolve(-1);
                });
        });
    }

    async getCurrentBlockPrivateNode() {
        try {
            let bNr = await C.web3.eth.getBlockNumber();
            bNr = parseInt(bNr);
            return bNr;
        }
        catch (e) {
            console.error("error getting block-nr from private node");
            //console.error(e);
            return -1;
        }
    }

    async getAccountInfo(accounts) {
        let accBalances = {};

        for (let a of accounts) {
            try {
                let aInf = await C.web3.eth.getBalance(a.adr.toLowerCase());
                aInf = C.web3.utils.fromWei(aInf, 'Ether');
                accBalances[a.adr] = parseFloat(aInf);
            }
            catch (e) {
                console.error("error on retrieving account balance");
                console.error(e);
                return -1;
            }
        }
        return accBalances;
    }

    getOpenPositions() {
        return Object.keys(this.positions).length;
    }

    //todo: add from-to, to be called from cliet
    async getOpenPositionsDetails(cb) {
        if (typeof cb === "function") cb(this.positions);
    }

    getOpenLiquidations(cb) {
        return Object.keys(this.liquidations).length;
    }
    //todo: add from-to, to be called from client
    async getOpenLiquidationsDetails(cb) {
        if (typeof cb === "function") cb(this.liquidations);
    }
}

export default new MonitorController();
