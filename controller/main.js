/**
 * Main controller
 * Starts observing the contract, liquidation and rollover processing
 * Also provides the api to monitor open positions/liquidations
 */
import PosScanner from './scanner';
import Liquidator from './liquidator';
import Rollover from './rollover';
import Arbitrage from './arbitrage';
import C from './contract';
import Monitor from './monitor';
import conf from '../config/config';

class MainController {
    constructor() {
        this.positions={}
        this.liquidations={};
    }

    async start(io) { 
        const b = await C.web3.eth.getBlockNumber();
        console.log("Connected to rsk " + conf.network + "-network. Current block " + b);
 
        PosScanner.start(this.positions, this.liquidations);
        Liquidator.start(this.liquidations);
        Rollover.start(this.positions);
        Arbitrage.start();
        Monitor.start(this.positions, this.liquidations, PosScanner);

        io.on('connection', (socket) => {
            socket.on('getSignals', async (cb) => Monitor.getSignals(cb));
            socket.on('getOpenPositionsDetails', async (cb) => Monitor.getOpenPositionsDetails(cb));
            socket.on('getOpenLiquidationsDetails', async (cb) => Monitor.getOpenLiquidationsDetails(cb));
        });
    }
}

export default new MainController;