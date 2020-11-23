/**
 * Rollover the open position (loan or trade) to the next interval, currently 28 days for margin-trades and 1 month for loans
 * Rollover = extend deadline and pay interest
 */
import C from './contract';
import U from '../util/helper';
import Wallet from './wallet';
import conf from '../config/config';
import abiDecoder from 'abi-decoder';
import dbCtrl from './db';

class Rollover {
    start(positions) {
        this.positions = positions;
        this.checkPositionsExpiration();
    }

    /**
     * Wrapper for rolling over open positions
     * Only rollover if amount > threshold
     * todo: convert btc amount considering real btc price and take from config file
     */
    async checkPositionsExpiration() {
        while (true) {
            console.log("started checking expired positions");

            for (let p in this.positions) { 
                
                const amn = this.positions[p].principal/1e18;

                if(this.positions[p].loanToken == conf.docToken && amn < 0.1) continue;
                else if(this.positions[p].loanToken == conf.testTokenRBTC && amn < 0.0001) continue; 
                 
                if (this.positions[p].endTimestamp < Date.now() / 1000) {
                    console.log("Found expired open position. Going to rollover " + this.positions[p].loanId);   
                    const w = await Wallet.getWallet("rollover", 0.001, "rBtc");
                    let nonce = await C.web3.eth.getTransactionCount(w.adr, 'pending');
                    const tx = await this.rollover(this.positions[p].loanId, w.adr, nonce);
                    if (tx) await this.addTx(tx);
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
                    console.log("Rollover Transaction successful: "+tx.transactionHash);
                    resolve(tx.transactionHash);
                })
                .catch((err) => {
                    console.error("Error in rolling over position "+loanId);
                    console.error(err);
                    resolve();
                });
        });
    }

    async addTx(txHash) {
        try {
            const receipt = await C.web3.eth.getTransactionReceipt(txHash);

            if (receipt && receipt.logs) {
                const logs = abiDecoder.decodeLogs(receipt.logs) || [];
                const loanEvent = logs.find(log => log.name === "LoanSwap");
                const params = U.parseEventParams(loanEvent.events);

                if (params && params.loanId) {
                    await dbCtrl.addRollover({
                        loanId: params.loanId,
                        txHash: receipt.transactionHash,
                        adr: params.borrower
                    })
                }
            }
        } catch (e) {

        }
    }

}

export default new Rollover();