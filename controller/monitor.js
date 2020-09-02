/**
 *  Accepts client requests and checks the health of the watcher and node in 10s interval
 *  If the system is not healthy it sends a message to the telegram group
 *  Assuming the public node from IOV labs is always right!
 */
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
import A from '../secrets/account';

class MonitorController {

    constructor(txCtrl) {
        this.txCtrl = txCtrl;
        this.telegramBotNode = new TelegramBot(conf.errorBotNodeTelegramToken, {polling: false});
        this.telegramBotWatcher = new TelegramBot(conf.errorBotWatcherTelegramToken, {polling: false});

        let p=this;
        setInterval(()=>{
            p.checkSystem();
        },10000);
    }

    /**
     * Wrapper for health signals
     */
    async getSignals(data, cb) {
        const localNode = await this.getCurrentBlockPrivateNode();
        const pNode = await this.getCurrentBlockPublicNode();
        const aInfo = await this.getAccountInfo(data);
        const cInfo = await this.getContractInfo();

        if (typeof cb === "function") cb({
            blockInfoLn: localNode,
            blockInfoPn: pNode,
            accountInfo: aInfo,
            contractInfo: cInfo
        });
    }

    getCurrentBlockPublicNode() {
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
            let bNr = await this.txCtrl.web3.eth.getBlockNumber();
            bNr = parseInt(bNr);
            return bNr;
        }
        catch (e) {
            console.error("error getting block-nr from private node");
            //console.error(e);
            return -1;
        }
    }

    async getAccountInfo(adr) {
        try {
            let aInf = await this.txCtrl.web3.eth.getBalance(adr.toLowerCase());
            aInf = this.txCtrl.web3.utils.fromWei(aInf, 'Ether');
            return parseFloat(aInf);
        }
        catch(e) {
            console.error("error on retrieving account balance");
            console.error(e);
            return -1;
        }
    }

    async getContractInfo() {
        let l = await this.txCtrl.loadActivePositions(0, 10);
        if (l && l.length > 0) return true;
        return false;
    }

    async getOpenPositions(cb) {
        let l = await Object.keys(this.txCtrl.positions).length;
        if (typeof cb === "function") cb(l);
    }

    //todo: add from-to
    async getOpenPositionsDetails(cb) {
        if (typeof cb === "function") cb(this.txCtrl.positions);
    }

    async getOpenLiquidations(cb) {
        let l = await Object.keys(this.txCtrl.liquidations).length;
        if (typeof cb === "function") cb(l);
    }
    //todo: add from-to
    async getOpenLiquidationsDetails(cb) {
        if (typeof cb === "function") cb(this.txCtrl.liquidations);
    }

    /** 
    * todo: find more params
    */
    checkSystem(){
        let p=this;

        this.getSignals(A.owner.adr, (res)=> {    
            if( Math.abs(res.blockInfoLn - res.blockInfoPn)>5) 
            return  p.telegramBotNode.sendMessage(conf.sovrynInternalTelegramId, conf.network+"-Node out of sync");

            else if(res.accountInfo<=0) 
            return  p.telegramBotWatcher.sendMessage(conf.sovrynInternalTelegramId, "No money left on the wallet for liquidator on "+conf.network);

            else if(!res.contractInfo)
            return  p.telegramBotWatcher.sendMessage(conf.sovrynInternalTelegramId, "No open positions on the contract on "+conf.network);

        });
    }
}

export default MonitorController;