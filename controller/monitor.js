/**
 *  Accepts client requests and checks the health of the Sovryn node in 60s interval
 *  If the system is not healthy it sends a message to the telegram group
 */
const axios = require('axios');
import A from '../secrets/accounts';
import C from './contract';
import conf from '../config/config';
import common from './common';
import dbCtrl from './db';
import accounts from '../secrets/accounts';
import arbitrageCtrl from './arbitrage';

class MonitorController {

    start(positions, liquidations, arbitrageDeals, posScanner) {
        this.positions = positions;
        this.liquidations = liquidations;
        this.arbitrageDeals = arbitrageDeals;
        this.posScanner = posScanner;

        if(conf.errorBotTelegram!="") {
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
        const resp =
        {
            blockInfoLn: await this.getCurrentBlockPrivateNode(),
            blockInfoPn: await this.getCurrentBlockPublicNode(),
            accountInfoLiq: await this.getAccountInfo(A.liquidator),
            accountInfoRoll: await this.getAccountInfo(A.rollover),
            accountInfoArb: await this.getAccountInfo(A.arbitrage),
            positionInfo: await this.getOpenPositions(),
            liqInfo: await this.getOpenLiquidations(),
            arbitrageDeals: await this.getArbitrageDeals(),
            tokenDetails: await this.getTokenDetails(),
        }
        if (typeof cb === "function") cb(resp);
        else return resp;
    }

    async getAddresses(cb) {
        const resp = {
            liquidator: await Promise.all(accounts.liquidator.map(async (account) => await this.getAccountInfoForFrontend(account, "liquidator"))),
            rollover: await this.getAccountInfoForFrontend(accounts.rollover[0], "rollover"),
            arbitrage: await this.getAccountInfoForFrontend(accounts.arbitrage[0], "arbitrage"),
        };
        if (conf.watcherContract) {
            resp.watcher = await this.getAccountInfoForFrontend(
                {
                    adr: conf.watcherContract,
                },
                "watcher contract"
            );
        }
        if (typeof cb === "function") cb(resp);
        else return resp;
    }

    async getTotals(cb, last24h) {
        console.log(last24h ? "get last 24h totals" : "get totals")
        const liquidator = await dbCtrl.getTotals('liquidator', last24h);
        const arbitrage = await dbCtrl.getTotals('arbitrage', last24h);
        const rollover = await dbCtrl.getTotals('rollover', last24h);
        const resp = {
            totalLiquidations: liquidator.totalActionsNumber,
            totalArbitrages: arbitrage.totalActionsNumber,
            totalRollovers: rollover.totalActionsNumber,
            totalLiquidatorProfit: Number(liquidator.profit).toFixed(6),
            totalArbitrageProfit: Number(arbitrage.profit).toFixed(6),
            totalRolloverProfit: Number(rollover.profit).toFixed(6)
        }
        if (typeof cb === "function") cb(resp);
        else return resp;
    }

    /**
    * Internal check
    */
    async checkSystem() {
        if (conf.network === "test") return;

        const sInfo = await this.getSignals();
        for (let b in sInfo.accountInfoLiq) {
            if (sInfo.accountInfoLiq[b] < 0.001)
                common.telegramBot.sendMessage("No money left for liquidator-wallet " + b + " on " + conf.network + " network");
        }

        for (let b in sInfo.accountInfoRoll) {
            if (sInfo.accountInfoRoll[b] < 0.001)
                common.telegramBot.sendMessage("No money left for rollover-wallet " + b + " on " + conf.network + " network");
        }

        for (let b in sInfo.accountInfoArb) {
            if (sInfo.accountInfoArb[b] < 0.001)
                common.telegramBot.sendMessage("No money left for arbitrage-wallet " + b + " on " + conf.network + " network");
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

    getNetworkData(cb) {
        const resp = {
            blockExplorer: conf.blockExplorer
        }
        if (typeof cb === "function") cb(resp);
        else return resp;
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

    async getAccountInfoForFrontend(account, type) {
        if (!account) return null;
        const tokenAddresses = C.getAllTokenAddresses();
        let _wrtcBal = await C.web3.eth.getBalance(account.adr);
        _wrtcBal = Number(C.web3.utils.fromWei(_wrtcBal, "Ether"));
       
        let accountWithInfo = { 
            address: account.adr,
            type, 
            rBtcBalance: {
                balance: _wrtcBal.toFixed(5),
                overThreshold: _wrtcBal > conf.balanceThresholds['rbtc']
            },
            tokenBalances: await Promise.all(
                tokenAddresses.map(async tokenAddress => ({
                    token: C.getTokenSymbol(tokenAddress),
                    balance: Number(
                        C.web3.utils.fromWei(await C.getWalletTokenBalance(account.adr, tokenAddress), "Ether")
                    ).toFixed(5),
                }))
            )
        }
        accountWithInfo.tokenBalances = accountWithInfo.tokenBalances.map(tokenBalance => ({
            ...tokenBalance,
            token: tokenBalance.token === 'rbtc' ? 'wrbtc' : tokenBalance.token,
            overThreshold: tokenBalance.balance > conf.balanceThresholds[tokenBalance.token]
        }));

        let rbtcBal = Number(accountWithInfo.rBtcBalance.balance) || 0;
        let usdBal = 0;
        for (const tokenBal of accountWithInfo.tokenBalances) {
            let bal = Number(tokenBal.balance) || 0;
            if (tokenBal.token == 'wrbtc') bal += rbtcBal;
            if (bal <= 0) continue;
            const price = await this.getUsdPrice(tokenBal.token);
            usdBal += (price * bal) || 0;
        }

        accountWithInfo.usdBalance = usdBal.toFixed(2);

        return accountWithInfo;
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

    async getArbitrageDeals(cb) {
        if (typeof cb === "function") cb(this.arbitrageDeals);
    }

    async getTokenDetails() {
        if(!this.liquidations) {
            return null;
        }

        const totalMaxLiquidatableByTokenAddress = {};
        const totalMaxSeizableByTokenAddress = {};
        // TODO: this.liquidations or this.positions?
        const loans = Object.values(this.liquidations);
        for(let loan of loans) {
            const loanTokenAddress = loan.loanToken.toLowerCase();
            const collateralTokenAddress = loan.collateralToken.toLowerCase();
            const maxLiquidatable = C.web3.utils.toBN(loan.maxLiquidatable);
            const maxSeizable = C.web3.utils.toBN(loan.maxSeizable);

            let totalMaxLiquidatable = totalMaxLiquidatableByTokenAddress[loanTokenAddress] || C.web3.utils.toBN('0');
            totalMaxLiquidatable = totalMaxLiquidatable.add(maxLiquidatable);
            totalMaxLiquidatableByTokenAddress[loanTokenAddress] = totalMaxLiquidatable;

            let totalMaxSeizable = totalMaxSeizableByTokenAddress[collateralTokenAddress] || C.web3.utils.toBN('0');
            totalMaxSeizable = totalMaxSeizable.add(maxSeizable);
            totalMaxSeizableByTokenAddress[collateralTokenAddress] = totalMaxSeizable;
        }

        const usdPrices = await arbitrageCtrl.getUsdPrices();

        const ret = [];
        for (let tokenAddress of C.getAllTokenAddresses()) {
            tokenAddress = tokenAddress.toLowerCase();
            const tokenSymbol = C.getTokenSymbol(tokenAddress);
            const price = usdPrices[tokenSymbol.toLowerCase()] || 1;
            let totalMaxLiquidatable = totalMaxLiquidatableByTokenAddress[tokenAddress] || '0';
            let totalMaxSeizable = totalMaxSeizableByTokenAddress[tokenAddress] || '0';

            totalMaxLiquidatable = Number(price) * parseFloat(C.web3.utils.fromWei(totalMaxLiquidatable));
            totalMaxSeizable = Number(price) * parseFloat(C.web3.utils.fromWei(totalMaxSeizable));

            ret.push({
                tokenAddress: tokenAddress,
                tokenSymbol: tokenSymbol,
                totalMaxLiquidatable: Number(totalMaxLiquidatable).toFixed(5),
                totalMaxSeizable: Number(totalMaxSeizable).toFixed(5),
            });
        }
        return ret;
    }

    async getUsdPrice(symbol) {
        if (symbol == 'doc') return 1;
        symbol = symbol == 'wrbtc' ? 'rbtc' : symbol;
        if (this.tokenPrices == null || this.tokenPrices.timestamp < Date.now() - 2000) {
            this.tokenPrices = this.tokenPrices || {
                prices: {},
                timestamp: Date.now()
            };
            this.tokenPrices.prices = await arbitrageCtrl.getUsdPrices();
            this.tokenPrices.timestamp = Date.now();
        }
        return this.tokenPrices.prices[symbol];
    }
}

export default new MonitorController();
