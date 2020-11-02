/**
 * Rollover the open position (loan or trade) to the next interval, currently 28 days for margin-trades and 1 month for loans
 * Rollover = extend deadline and pay interest
 */
import C from './contract';
import U from '../util/helper';
import Wallet from './wallet';
import conf from '../config/config';


class Rollover {
    start(positions) {
        this.positions = positions;
        this.checkPositionsExpiration();
    }

    /**
     * Wrapper for rolling over open positions
     */
    async checkPositionsExpiration() {
        while (true) {
            console.log("started checking expired positions");

            for (let p in this.positions) {
                if (this.positions[p].endTimestamp < Date.now() / 1000) {
                    console.log("Found expired open position. Going to rollover " + this.positions[p].loanId);
                    const w = await Wallet.getWallet("rollover", 0.001, "rBtc");
                    let nonce = await C.web3.eth.getTransactionCount(w.adr, 'pending');
                    await this.rollover(this.positions[p].loanId, w.adr, nonce);
                }
            }
            console.log("Completed rollover");
            await U.wasteTime(conf.rolloverScanInterval);
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
                    console.log("Rollover successful");
                    console.log(tx);
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