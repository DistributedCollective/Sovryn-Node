/**
 * Main controller
 * Starts observing the contract and liquidation and rollover processing
 * Also provides the api to monitor open positions/liquidations
 */
import PosScanner from './scanner';
import Liquidator from './liquidator';
import Rollover from './rollover';
import C from './contract';
import A from '../secrets/accounts';
import Monitor from './monitor';

class MainController {
    constructor() {
        this.positions={}
        this.liquidations={};
    }

    async start(conf, io) {
        C.init(conf);
        C.addWallets(A.liquidator);
        C.addWallets(A.rollover);
        
        const b = await C.web3.eth.getBlockNumber();
        console.log("Connected to rsk " + conf.network + "-network. Current block " + b);
 
        PosScanner.start(conf, this.positions, this.liquidations);
        Liquidator.start(conf, this.liquidations);
        Rollover.start(conf, this.positions);
        Monitor.start(conf, this.positions, this.liquidations, PosScanner);

        const p = this;
        io.on('connection', (socket) => {
            socket.on('getSignals', async (data, cb) => Monitor.getSignals(data, cb));
            //socket.on('getOpenPositions', async(cb) => Monitor.getOpenPositions(cb));
            socket.on('getOpenPositionsDetails', async (cb) => Monitor.getOpenPositionsDetails(cb));
            //socket.on('getOpenLiquidations', async(cb) => Monitor.getOpenLiquidations(cb));
            socket.on('getOpenLiquidationsDetails', async (cb) => Monitor.getOpenLiquidationsDetails(cb));
        });
    }
}

const mainController = new MainController();
export default mainController;