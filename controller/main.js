/**
 * Main controller
 * Starts observing the contract, liquidation and rollover processing
 * Also provides the api to monitor open positions/liquidations
 */
import conf from '../config/config';
import PosScanner from './scanner';
import Liquidator from './liquidator';
import Rollover from './rollover';
import Arbitrage from './arbitrage';
import LiquidatorV2 from './v2/liquidator';
import ArbitrageV2 from './v2/arbitrage';
import C from './contract';
import Monitor from './monitor';
import dbCtrl from './db';

class MainController {
    constructor() {
        this.positions={};
        this.liquidations={};
        this.arbitrageDeals=[];
    }

    async start(io) { 
        const b = await C.web3.eth.getBlockNumber();
        console.log("Connected to Rsk " + conf.network + "-network. Current block " + b);
        await dbCtrl.initDb(conf.db);

        const v2Services = this.getEnabledV2Services();

        PosScanner.start(this.positions, this.liquidations);

        if(conf.enableLiquidator) {
            if (v2Services.liquidator) {
                console.log('Using Watcher V2 for liquidator');
                LiquidatorV2.start(this.liquidations);
            } else {
                Liquidator.start(this.liquidations);
            }
        }
        if(conf.enableRollover) {
            Rollover.start(this.positions);
        }
        if(conf.enableArbitrage) {
            if (v2Services.arbitrage) {
                console.log('Using Watcher V2 for arbitrage');
                ArbitrageV2.start(this.arbitrageDeals);
            } else {
                Arbitrage.start(this.arbitrageDeals);
            }
        }

        Monitor.start(this.positions, this.liquidations, this.arbitrageDeals, PosScanner);

        io.on('connection', (socket) => {
            socket.on('getSignals', async (cb) => Monitor.getSignals(cb));
            socket.on('getAddresses', async (cb) => Monitor.getAddresses(cb));
            socket.on('getNetworkData', async (cb) => Monitor.getNetworkData(cb));
            socket.on('getTotals', async (cb) => Monitor.getTotals(cb));
            socket.on('getLast24HTotals', async (cb) => Monitor.getTotals(cb, true));
            socket.on('getOpenPositionsDetails', async (cb) => Monitor.getOpenPositionsDetails(cb));
            socket.on('getOpenLiquidationsDetails', async (cb) => Monitor.getOpenLiquidationsDetails(cb));
        });
    }

    getEnabledV2Services() {
        let v2Services = conf.enableV2;
        if (!v2Services) {
            v2Services = {};
        } else if (v2Services === true) {
            v2Services = {
                arbitrage: true,
                liquidator: true,
            }
        }
        if (v2Services && (v2Services.arbitrage || v2Services.liquidator)) {
            if (!conf.watcherContract) {
                console.error(
                    'V2 services are enabled but watcherContract is not specified in config! reverting to V1'
                );
                return {};
            }
        }
        return v2Services;
    }
}

export default new MainController;