/**
 * Main controller
 * Starts observing the contract and liquidation and rollover processing
 * Also provides the api to monitor open positions/liquidations
 */
import PosScanner from './scanner';
import Liquidator from './liquidator';
import Rollover from './rollover';
import C from './contract';
import Monitor from './monitor';

class MainController {
    constructor() {
        this.positions={}
        this.liquidations={};
    }

    async start(conf, io) {
        C.init(conf);

        const b = await C.web3.eth.getBlockNumber();
        console.log("Connected to rsk " + conf.network + "-network. Current block " + b);
 
        PosScanner.start(conf, this.positions, this.liquidations);
        Liquidator.start(conf, this.liquidations);
        Rollover.start(conf, this.positions);
        Monitor.start(conf, this.positions, this.liquidations, PosScanner);

        const p = this;
        io.on('connection', (socket) => {
            p.socket = socket;

            socket.on('getSignals', async (data, cb) => p.mCtrl.getSignals(data, cb));
            //socket.on('getOpenPositions', async(cb) => p.mCtrl.getOpenPositions(cb));
            socket.on('getOpenPositionsDetails', async (cb) => p.mCtrl.getOpenPositionsDetails(cb));
            //socket.on('getOpenLiquidations', async(cb) => p.mCtrl.getOpenLiquidations(cb));
            socket.on('getOpenLiquidationsDetails', async (cb) => p.mCtrl.getOpenLiquidationsDetails(cb));
        });
    }
}

const mainController = new MainController();
export default mainController;