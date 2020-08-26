/**
 * Main controller
 * Starts transaction processing and provides the api to monitor open positions
 */
import TransactionController from './transaction';
import MonitorController from './monitor';

class MainController {
    
    async start(io) {
        const p=this;
        io.on('connection', (socket) => {
            p.socket=socket;
            p.getSignals();
        });
        const txCtrl = new TransactionController();
        txCtrl.start();
        this.mCtrl = new MonitorController(txCtrl);
    }

    async getSignals() {
        const p=this;
        this.socket.on('openPos', cb => {
            p.mCtrl.getOpenPositions(cb);
        });
       
        this.socket.on('openLiq', cb => {
            cb(22);
            //p.mCtrl.getOpenLiquidations(cb);
        });

        this.socket.on('getSignals', async (data,cb) => { 
            p.mCtrl.getSignals(data, cb);
        });

        this.socket.on('getOpenPositionsDetails', async(cb) => p.mCtrl.getOpenPositionsDetails(cb));
        this.socket.on('getOpenLiquidations', async(cb) => p.mCtrl.getOpenLiquidations(cb));
        this.socket.on('getOpenLiquidationsDetails', async(cb) => p.mCtrl.getOpenLiquidationsDetails(cb));
    }
}

const mainController = new MainController();
export default mainController;