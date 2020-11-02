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
        this.positions={}
        this.liquidations={};
    }

    async start(io) { 
        const b = await C.web3.eth.getBlockNumber();
        console.log("Connected to rsk " + conf.network + "-network. Current block " + b);
        //await dbCtrl.initDb(conf.db);

        PosScanner.start(this.positions, this.liquidations);
        if(conf.enableLiquidator) Liquidator.start(this.liquidations);
        if(conf.enbableRollover) Rollover.start(this.positions);
        if(conf.enableArbitrage) Arbitrage.start();
        Monitor.start(this.positions, this.liquidations, PosScanner);

        io.on('connection', (socket) => {
            socket.on('getSignals', async (cb) => Monitor.getSignals(cb));
            socket.on('getOpenPositionsDetails', async (cb) => Monitor.getOpenPositionsDetails(cb));
            socket.on('getOpenLiquidationsDetails', async (cb) => Monitor.getOpenLiquidationsDetails(cb));
        });
    }
}

export default new MainController;