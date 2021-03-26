const socket = io();

class AppCtrl {
    constructor($scope) {
        this.lastBlockOurNode = 0;
        this.lastBlockExternalNode = 0;
        this.numberOpenPositions = 0;
        this.numberLiquidationsInQueue = 0;
        this.arbitrageDeals = [];

        this.liquidationWallets = [];
        this.artbitrageWallet = {};
        this.rolloverWallet = {};
        this.fastBtcWallet = null;
        this.ogWallet = null;
        this.$scope = $scope;

        this.start();
    }

    static get $inject() {
        return ['$scope'];
    }

    start() {
        this.getSignals();
        this.getAddresses();

        setInterval(() => {
            this.getSignals();
            this.getAddresses();
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

            p.$scope.$applyAsync();
        });
    }
}

angular.module('app', []).controller('appCtrl', AppCtrl);

angular.bootstrap(document, ['app']);
