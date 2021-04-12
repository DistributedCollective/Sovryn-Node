const socket = io();

class AppCtrl {
    constructor($scope) {
        this.lastBlockOurNode = 0;
        this.lastBlockExternalNode = 0;
        this.numberOpenPositions = 0;
        this.numberLiquidationsInQueue = 0;
        this.arbitrageDeals = [];

        this.liquidationWallets = [];
        this.artbitrageWallet = null;
        this.rolloverWallet = null;
        this.fastBtcWallet = null;
        this.ogWallet = null;
      
        this.tokens = [];
        this.accounts = []
        this.blockExplorer = '';

        this.totalLiquidations = 0;
        this.totalArbitrages = 0;
        this.totalRollovers = 0;

        this.totalLiquidatorProfit =0;
        this.totalArbitrageProfit = 0;
        this.totalRolloverProfit = 0;

        this.last24HLiquidations = 0;
        this.last24HArbitrages = 0;
        this.last24HRollovers = 0;

        this.last24HLiquidatorProfit = 0;
        this.last24HArbitrageProfit = 0;
        this.last24HRolloverProfit = 0;

        this.$scope = $scope;

        this.start();
    }

    static get $inject() {
        return ['$scope'];
    }

    start() {
        this.getSignals();
        this.getAddresses();
        this.getNetworkData();
        this.getTotals(); // fire only once
        this.getLast24HTotals();

        setInterval(() => {
            this.getSignals();
            this.getAddresses();
            this.getLast24HTotals();
        }, 15000);
    }

    getSignals() {
        let p=this;

        socket.emit("getSignals", (res) => {
            console.log("response signals", res);

            p.lastBlockOurNode = res.blockInfoPn;
            p.lastBlockExternalNode = res.blockInfoLn;

            p.numberOpenPositions = res.positionInfo;
            p.numberLiquidationsInQueue = res.liqInfo;
            p.arbitrageDeals = res.arbitrageDeals;

            p.$scope.$applyAsync();
        });
    }

    getAddresses() {
        let p=this;

        socket.emit("getAddresses", (res) => {
            console.log("response addresses:", res);

            p.liquidationWallets = res.liquidator;
            p.arbitrageWallet = res.arbitrage;
            p.rolloverWallet = res.rollover;
            p.tokens = res.arbitrage.tokenBalances.map(balance => balance.token);
            res.liquidator.push(res.arbitrage, res.rollover);
            p.accounts = res.liquidator;

            p.$scope.$applyAsync();
        });
    }

    getNetworkData() {
        let p=this;

        socket.emit("getNetworkData", (res) => {
            console.log("network data:", res);

            p.blockExplorer = res.blockExplorer;

            p.$scope.$applyAsync();
        })
    }

    getTotals() {
        let p=this;

        socket.emit("getTotals", (res) => {
            console.log("response totals for liquidations, arbitrages and rollovers:", res);

            p.totalLiquidations = res.totalLiquidations;
            p.totalArbitrages = res.totalArbitrages;
            p.totalRollovers = res.totalRollovers;

            p.totalLiquidatorProfit = res.totalLiquidatorProfit;
            p.totalArbitrageProfit = res.totalArbitrageProfit;
            p.totalRolloverProfit = res.totalRolloverProfit;

            p.$scope.$applyAsync();
        })
    }

    getLast24HTotals() {
        let p=this;

        socket.emit("getLast24HTotals", (res) => {
            console.log("response last 24h totals for liquidations, arbitrages and rollovers:", res);

            p.last24HLiquidations = res.totalLiquidations;
            p.last24HArbitrages = res.totalArbitrages;
            p.last24HRollovers = res.totalRollovers;

            p.last24HLiquidatorProfit = res.totalLiquidatorProfit;
            p.last24HArbitrageProfit = res.totalArbitrageProfit;
            p.last24HRolloverProfit = res.totalRolloverProfit;

            p.$scope.$applyAsync();
        })
    }
}

angular.module('app', []).controller('appCtrl', AppCtrl);

angular.bootstrap(document, ['app']);
