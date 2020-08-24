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
        //txCtrl.start();
        this.mCtrl = new MonitorController(txCtrl);
    }

    async getSignals() {
        const p=this;
        this.socket.on('openPos', cb => {
            if(cb) cb(p.txCtrl1.trades);
        });
       

        this.socket.on('getSignals', async cb => { 
            p.mCtrl.getSignals(cb);
        });
    }
}

const mainController = new MainController();
export default mainController;