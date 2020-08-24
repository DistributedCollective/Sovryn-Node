/**
 *  Accepts client requests and checks the health of the watcher and node in 10s interval
 *  If the system is not healthy it sends a message to the telegram group
 *  Assuming the public node from IOV labs is always right!
 */
const axios = require('axios');
//const TelegramBot = require('telegram-bot-api');

class MonitorController {

    constructor(txCtrl) {
        this.txCtrl = txCtrl;
     //   this.telegramBotNode = new TelegramBot({ token: conf.errorBotNodeTelegramToken });
      //  this.telegramBotWatcher = new TelegramBot({ token: conf.errorBotWatcherTelegramToken });

        let p=this;
        setInterval(()=>{
            //p.checkSystem();
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
            let aInf = await this.txCtrl.web3.eth.getBalance(adr);
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
        let l = await this.txCtrl.loadActiveLoans(0, 10);
        if (l && l.length > 0) return true;
        return false;
    }

    /** 
    * todo: find more params
    */
    checkSystem(){
        let p=this;
        let adr=this.txCtrl.web3.eth.accounts[0];
        this.getSignals(adr, (res)=> {
            
            if( Math.abs(res.blockInfoLn - res.blockInfoPn)>5) 
            return  p.telegramBotNode.sendMessage({ chat_id: -1001216925293, text: "Node out of sync" });

            else if(res.accountInfo<=0) 
            return  p.telegramBotNode.sendMessage({ chat_id: -1001216925293, text: "No money left on the wallet" });

            else if(!res.contractInfo)
            return  p.telegramBotNode.sendMessage({ chat_id: -1001216925293, text: "No open positions on the contract" });

        });
    }
}

export default MonitorController;