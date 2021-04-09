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

        PosScanner.start(this.positions, this.liquidations);
        if(conf.enableLiquidator) Liquidator.start(this.liquidations);
        if(conf.enableRollover) Rollover.start(this.positions);
        if(conf.enableArbitrage) Arbitrage.start(this.arbitrageDeals);
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
}

export default new MainController;