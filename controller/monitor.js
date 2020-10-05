/**
 *  Accepts client requests and checks the health of the watcher and node in 10s interval
 *  If the system is not healthy it sends a message to the telegram group
 *  Assuming the public node from IOV labs is always right!
 */
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
import A from '../secrets/accounts';
import C from './contract';

class MonitorController {

    start(conf, positions, liquidations, posScanner) {
        this.conf=conf;
        this.positions=positions;
        this.liquidations=liquidations;
        this.telegramBotNode = new TelegramBot(conf.errorBotNodeTelegramToken, {polling: false});
        this.telegramBotWatcher = new TelegramBot(conf.errorBotWatcherTelegramToken, {polling: false});
        this.posScanner = posScanner;

        let p=this;
        setInterval(()=>{
            p.checkSystem();
        },1000*60);
    }

    /**
     * Wrapper for health signals, called from client
     */
    async getSignals(cb) {
        if(typeof cb!=="function") return;
        const resp = 
        {
            blockInfoLn: await this.getCurrentBlockPrivateNode(),
            blockInfoPn: await this.getCurrentBlockPublicNode(),
            accountInfoLiq: await this.getAccountInfo(A.liquidator),
            accountInfoRoll: await this.getAccountInfo(A.rollover),
            positionInfo: await this.getOpenPositions(),
            liqInfo: await this.getOpenLiquidations()
        }
        cb(resp);
    }

    /** 
    * Internal check
    */
   checkSystem(){
        let p=this;

        this.getSignals(A.liquidator, (res)=> {    
            if(res.accountInfo<=0) 
            return  p.telegramBotWatcher.sendMessage(p.conf.sovrynInternalTelegramId, "No money left on the wallet for liquidator on "+p.conf.network);

            else if(!res.contractInfo)
            return  p.telegramBotWatcher.sendMessage(p.conf.sovrynInternalTelegramId, "No open positions on the contract on "+p.conf.network);
        });
    }

    getCurrentBlockPublicNode() {
        let p=this;
        return new Promise(resolve => {
            axios({
                method: 'post',
                url: p.conf.publicNodeProvider,
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
        let accBalances={};

        for(let a of accounts) {
            try {
                let aInf = await C.web3.eth.getBalance(a.adr.toLowerCase());
                aInf = C.web3.utils.fromWei(aInf, 'Ether');
                accBalances[a.adr] = parseFloat(aInf);
            }
            catch(e) {
                console.error("error on retrieving account balance");
                console.error(e);
                return -1;
            }
        }        
        return accBalances;
    }

    async getOpenPositions(cb) {
        return await Object.keys(this.positions).length;
    }

    //todo: add from-to, to be called from cliet
    async getOpenPositionsDetails(cb) {
        if (typeof cb === "function") cb(this.positions);
    }

    async getOpenLiquidations(cb) {
        return await Object.keys(this.liquidations).length;
    }
    //todo: add from-to, to be called from client
    async getOpenLiquidationsDetails(cb) {
        if (typeof cb === "function") cb(this.liquidations);
    }
}

export default new MonitorController();