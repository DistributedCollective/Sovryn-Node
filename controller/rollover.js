/**
 * Rollover the open position (loan or trade) to the next interval, currently 28 days for margin-trades and 1 month for loans
 * Rollover = extend deadline and pay interest
 */
import C from './contract';
import U from '../util/helper';
import Wallet from './wallet';

class Rollover {
    start(conf, positions) {
        this.conf=conf;
        this.positions = positions;
        this.checkPositionsExpiration();
    }

    /**
     * Wrapper for rolling over open positions
     */
    async checkPositionsExpiration() {
        while (true) {
            console.log("started checking expired positions at " + new Date(Date.now()));

            for (let p in this.positions) {
                if (this.positions[p].endTimestamp < Date.now() / 1000) {
                    console.log("Found expired open position. Going to rollover " + this.positions[p].loanId);
                    const w = await Wallet.getWallet("rollover", 0.001, "rBtc");
                    let nonce = await C.web3.eth.getTransactionCount(w.adr, 'pending');
                    await this.rollover(this.positions[p].loanId, w.adr, nonce);
                }
            }
            console.log("Completed rollover at " + new Date(Date.now()));
            await U.wasteTime(this.conf.rolloverScanInterval);
        }
    }

    /**
     * Tries to rollover a position
     */
    rollover(loanId, wallet, nonce) {
        return new Promise(async (resolve) => {
            const loanDataBytes = "0x"; //need to be empty
            
            C.contractSovryn.methods.rollover(loanId, loanDataBytes)
                .send({ from: wallet, gas: 2500000, nonce })
                .then((tx) => {
                    //console.log("Rollover Transaction: ");
                    //console.log(tx);
                    resolve(tx.transactionHash);
                })
                .catch((err) => {
                    console.error("Error in rolling over a position from the contract");
                    console.error(err);
                    resolve();
                });
        });
    }
}

export default new Rollover();