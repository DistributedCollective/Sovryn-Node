import accounts from '../../secrets/accounts.js';

class AppCtrl {
    constructor($scope) {
        this.liquidationWallets = [];
        this.artbitrageWallet = {};
        this.rolloverWallet = {};
        this.$scope = $scope;

        this.start();
    }

    static get $inject() {
        return ['$scope'];
    }

    start() {
        this.liquidationWallets = accounts.liquidator;
        this.artbitrageWallet = accounts.arbitrage;
        this.rolloverWallet = accounts.rollover;

        console.log('\n Liquidations Wallets', this.liquidationWallets)

        this.$scope.$applyAsync();
    }
}

angular.module('app', []).controller('appCtrl', AppCtrl);

angular.bootstrap(document, ['app']);
