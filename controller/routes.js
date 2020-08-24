/**
 * Api methods 
 */
const axios = require('axios');

class RouteController {

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

        if (cb) cb({
            blockInfoLn: localNode, 
            blockInfoPn: pNode,
            accountInfo: aInfo
        });
    }


    /**
     * Get last block from public node
     */
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
                    console.log("error getting block-nr from public node");
                    console.log(e);
                    resolve(-1);
                });
        });
    }

    async getCurrentBlockPrivateNode() {
        let p=this;
        return new Promise(async resolve => {
            try {
                let bNr = await p.txCtrl.web3.eth.getBlockNumber();
                bNr = parseInt(bNr);
                resolve(bNr);
            }
            catch (e) {
                console.log("error getting block-nr from private node");
                //console.log(e);
                resolve(-1);
            }
        });
    }

    async getAccountInfo() {
        let p=this;
        return new Promise(async resolve => {
            try {
                let aInf = await p.txCtrl.web3.eth.getBalance("0x1BB2B1bEeDA1FB25Ee5da9CAE6c0F12CeD831128");
                aInf = parseInt(aInf);
                resolve(aInf);
            }
            catch (e) {
                console.log("error getting account info from private node");
                //console.log(e);
                resolve(-1);
            }
        });
    }

    async getContractInfo() {
        let p=this;
        return new Promise(async resolve => {
            try {
                let l = await p.txCtrl.loadActiveLoans(0, 10);
                 if(l && l.length>0) return resolve(true);
                resolve(false);
            }
            catch (e) {
                console.log("error getting contract info from private node");
                //console.log(e);
                resolve(false);
            }
        });
    }
}

export default RouteController;