/**
 * Rollover the open position (loan or trade) to the next interval, currently 28 days for margin-trades and 1 month for loans
 * Rollover = extend deadline and pay interest
 */

import C from './contract';
import U from '../util/helper';
import Wallet from './wallet';
import conf from '../config/config';
import common from './common'
import abiDecoder from 'abi-decoder';
import abiComplete from "../config/abiComplete";
import Extra from 'telegraf/extra';
import dbCtrl from './db';

class Rollover {
    constructor(){
        this.rolloverErrorList=[];
        abiDecoder.addABI(abiComplete);
    }
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
            await this.handleRolloverRound();
            console.log("Completed rollover");
            await U.wasteTime(conf.rolloverScanInterval);
        }
    }

    async handleRolloverRound() {
        console.log("started checking expired positions");

        for (let p in this.positions) {
            const position = this.positions[p];
            const amn = C.web3.utils.fromWei(position.collateral.toString(), "Ether");

            const collateralTokenAddress = position.collateralToken.toLowerCase();
            if (collateralTokenAddress === conf.docToken.toLowerCase() && amn < 5) {
                continue;
            } else if (collateralTokenAddress === conf.USDTToken.toLowerCase() && amn < 5) {
                continue;
            } else if (collateralTokenAddress === conf.BProToken.toLowerCase()) {
                // Bpro can't be rolled over. Amm messed up
                continue;
            } else if (collateralTokenAddress === conf.testTokenRBTC.toLowerCase() && amn < 0.00025) {
                continue;
            } else if (this.rolloverErrorList[position.loanId] >= 5) {
                continue;
            }

            const currentTime = Date.now() / 1000;
            if (position.endTimestamp < currentTime) {
                console.log("Rollover " + position.loanId+" pos size: "+amn+" collateralToken: "+C.getTokenSymbol(position.collateralToken));
                const [wallet] = await Wallet.getWallet("rollover", 0.001, "rBtc");
                if (wallet) {
                    const nonce = await C.web3.eth.getTransactionCount(wallet.adr, 'pending');
                    const txHash = await this.rollover(position, wallet.adr, nonce);
                    if (txHash) await this.addTx(txHash);
                } else {
                    await this.handleNoWalletError();
                }
            }
        }
    }

    /**
     * Tries to rollover a position
     */
    async rollover(pos, wallet, nonce) {
        const loanDataBytes = "0x"; //need to be empty

        const gasPrice = await C.getGasPrice();

        try {
            const tx = await C.contractSovryn.methods.rollover(pos.loanId, loanDataBytes).send({
                from: wallet,
                gas: 2500000,
                gasPrice: gasPrice,
                nonce:nonce
            });
            const msg = (
                `Rollover Transaction successful: ${tx.transactionHash}\n` +
                `Rolled over position ${U.formatLoanId(pos.loanId)} with ${C.getTokenSymbol(pos.collateralToken)} as collateral token\n` +
                `${conf.blockExplorer}tx/${tx.transactionHash}`
            );
            console.log(msg);
            common.telegramBot.sendMessage(`<b><u>R</u></b>\t\t\t\t ${conf.network}-${msg}`, Extra.HTML());

            this.handleRolloverSuccess(pos.loanId);
            return tx.transactionHash;
        } catch(err) {
            console.error("Error in rolling over position "+pos.loanId);
            console.error(err);

            // check if err.receipt exists instead of crashing
            let errorDetails;
            if(err.receipt) {
                errorDetails = `${conf.blockExplorer}tx/${err.receipt.transactionHash}`;
            } else {
                errorDetails = err.toString().slice(0, 200);
            }

            common.telegramBot.sendMessage(
                `<b><u>R</u></b>\t\t\t\t ⚠️<b>ERROR</b>⚠️\n Error on rollover tx: ${errorDetails}\n` +
                `LoanId: ${U.formatLoanId(pos.loanId)}`,
                Extra.HTML()
            );
            this.handleRolloverError(pos.loanId);
        }
    }

    handleRolloverSuccess(loanId){
        this.rolloverErrorList[loanId] = null;
    }

    handleRolloverError(loanId){
        if(!this.rolloverErrorList[loanId]) this.rolloverErrorList[loanId]=1;
        else this.rolloverErrorList[loanId]++;
    }

    /**
     * Rollover currently does not emit logs
     */
    async addTx(txHash) {
        try {
            console.log("Add rollover to db");
            const receipt = await C.web3.eth.getTransactionReceipt(txHash);

            if (receipt && receipt.logs) {
                const logs = abiDecoder.decodeLogs(receipt.logs) || [];

                for(let log in logs){
                    if(!logs[log] || logs[log].name === "Conversion") continue;

                    const params = U.parseEventParams(logs[log].events);
                
                    if (params && params.loanId) {
                        //wrong -> update
                        const pos = params.sourceToken === conf.testTokenRBTC.toLowerCase() ? 'long' : 'short';
                        await dbCtrl.addRollover({
                            loanId: params.loanId,  
                            txHash: receipt.transactionHash,
                            rolloverAdr: receipt.logs[0].address,
                            rolledoverAdr: params.borrower,
                            amount: Number(C.web3.utils.fromWei(params.sourceAmount, "Ether")).toFixed(6),
                            pos
                        })
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleNoWalletError() {
        console.error("No wallet available for rollover");
        common.telegramBot.sendMessage("<b><u>R</u></b>\t\t\t\t No wallet available for rollover", Extra.HTML());
    }
}

export default new Rollover();
