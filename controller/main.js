/**
 * Main controller
 * Starts transaction processing and provides the api to monitor open positions
 */
import TransactionController from './transaction';
import rCtrl from './routes';

class MainController {
    
    async start(io) {
        const p=this;
        io.on('connection', (socket) => {
            p.socket=socket;
            p.showOpenPositions();
        });
        const txCtrl = new TransactionController();
        txCtrl.start();
    }

    async showOpenPositions() {
        const p=this;
        this.socket.on('openPos', (msg, cb) => {
            if(cb) cb(p.txCtrl1.trades);
        });

        this.socket.on('getBlock', async (cb) => {
            let res = await p.txCtrl1.getCurrentBlock(); 
            if(cb) cb(res);
        });
    }
}

const mainController = new MainController();
export default mainController;