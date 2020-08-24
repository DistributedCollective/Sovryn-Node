/**
 * Api methods 
 */
const axios = require('axios');

class MonitorController {

    constructor(txCtrl) {
        this.txCtrl = txCtrl;
    }

    /**
     * Wrapper for health signals
     */
    async getSignals(cb) {
        const localNode = await this.getCurrentBlockPrivateNode();
        const pNode = await this.getCurrentBlockPublicNode();
        const aInfo = await this.getAccountInfo();
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

    async getAccountInfo() {
        try {
            let aInf = await this.txCtrl.web3.eth.getBalance("0x1BB2B1bEeDA1FB25Ee5da9CAE6c0F12CeD831128");
            aInf = parseInt(aInf);
            return aInf;
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
}

export default MonitorController;