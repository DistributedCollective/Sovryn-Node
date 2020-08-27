/**
 * Main controller
 * Starts transaction processing and provides the api to monitor open positions
 */
import TransactionController from './transaction';
import MonitorController from './monitor';

class MainController {

    async start(io) {

        const txCtrl = new TransactionController();
        txCtrl.start();
        this.mCtrl = new MonitorController(txCtrl);

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