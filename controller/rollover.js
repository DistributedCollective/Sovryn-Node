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
import Arbitrage from './arbitrage';
import wallet from './wallet';
import * as _ from 'lodash';
import Lock from '../util/lock';

class Rollover {
    constructor(){
        this.rolledPositions = {};
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
            try {
                await this.handleRolloverRound();
                console.log("Completed rollover");
            } catch (e) {
                console.error("Error processing a rollover round:", e);
            }
            await U.wasteTime(conf.rolloverScanInterval);
        }
    }

    async handleRolloverRound() {
        console.log("started checking expired positions");
        let positions = Object.values(this.positions).slice();
        positions = _.orderBy(positions, p => {
            const curTime = Date.now() / 1000;
            const posEndTime = Number(p.endTimestamp);
            return curTime > (posEndTime - 55*60) ? -posEndTime : Number.MAX_SAFE_INTEGER;
        });

        for (let pos of positions) {
            // It's possible that something has changed in between of finding the position by the Scanner and calling
            // this method. Thus, we fetch the loan again here.
            const p = pos.loanId;
            const position = await C.contractSovryn.methods.getLoan(p).call();

            const amn = Number(C.web3.utils.fromWei(position.collateral.toString(), "Ether"));

            // TODO: would want to check active = true but not sure how to get it from
            // the smart contract
            if (C.web3.utils.toBN(position.principal).isZero()) {
                console.log(`Principal for loan ${p} is 0, not rolling over.`);
                continue;
            }

            const unhealthyMarginThreshold = C.web3.utils.toWei('3', 'ether');
            if (C.web3.utils.toBN(position.currentMargin).lte(unhealthyMarginThreshold)) {
                console.log(
                    `Current margin ${position.currentMargin} for loan ${p} is less than ` +
                    `margin threshold for unhealthy position ${unhealthyMarginThreshold.toString()}, not rolling over.`
                );
                continue;
            }

            const collateralToken = position.collateralToken.toLowerCase();
            if (collateralToken === conf.BProToken.toLowerCase()) {
                // Bpro can't be rolled over. Amm messed up
                continue;
            } 
            
            if (this.isRolloverAlreadySent(position.loanId)) {
                continue;
            }

            const posSize = C.web3.utils.fromWei(position.principal.toString(), 'ether');
            const currentTime = Date.now() / 1000;

            if (currentTime > position.endTimestamp) {
                console.log("Rollover " + position.loanId+" pos size: "+amn+" collateralToken: "+C.getTokenSymbol(position.collateralToken));
                console.log('principal', posSize, C.getTokenSymbol(position.loanToken));
                const [wallet] = await Wallet.getWallet("rollover", C.web3.utils.toWei('0.0001', 'ether'), "rBtc", C.web3.utils.toBN);
                if (wallet) {
                    const release = await Lock.acquire('rollover:' + wallet.adr, '');
                    try {
                        const txHash = await this.rollover(position, wallet.adr, amn);
                        if (txHash) await this.addTx(txHash, wallet.adr);
                        Wallet.removePendingTx("rollover", wallet.adr, null);
                    } catch(e) {
                        console.log(e);
                    } finally {
                        release();
                    }
                } else {
                    await this.handleNoWalletError();
                }
            }
        }
    }

    /**
     * Tries to rollover a position
     */
    async rollover(pos, wallet, posSize) {
        const loanDataBytes = "0x"; //need to be empty

        const gasPrice = await C.getGasPrice();

        const loanId = pos.loanId;
        this.handleRolloverStart(loanId);
        const txOpts = {
            from: wallet,
            gas: 2500000,
            gasPrice: gasPrice,
        };

        try {
            const simulated = await C.contractSovryn.methods.rollover(loanId, loanDataBytes).call(txOpts);
            console.log('result for', loanId, ':', simulated);
        } catch (e) {
            console.log('error on simulating rollover',e);
            this.rolledPositions[loanId] = 'error';
            return;
        }

        txOpts.nonce = await Wallet.getNonce(wallet);

        try {
            console.log('Trying to simulate rollover transaction first for', loanId);
            const tx = await C.contractSovryn.methods.rollover(loanId, loanDataBytes).send(txOpts);

            const msg = (
                `Rollover Transaction successful: ${tx.transactionHash}\n` +
                `Rolled over position ${U.formatLoanId(loanId)} with ${C.getTokenSymbol(pos.collateralToken)} as collateral token\n` +
                `size ${posSize} ${C.getTokenSymbol(pos.collateralToken)}\n` +
                `${conf.blockExplorer}tx/${tx.transactionHash}`
            );
            console.log(msg);
            common.telegramBot.sendMessage(`<b><u>R</u></b>\t\t\t\t ${conf.network}-${msg}`, Extra.HTML());

            this.handleRolloverSuccess(loanId);
            return tx.transactionHash;
        } catch(err) {
            this.rolledPositions[loanId] = 'error';

            console.error("Error in rolling over position " + loanId);
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
                `LoanId: ${U.formatLoanId(loanId)}`,
                Extra.HTML()
            );
            await this.handleRolloverError(loanId, wallet, pos[2]);
        }
    }

    isRolloverAlreadySent(loanId) {
        return this.rolledPositions[loanId];
    }

    handleRolloverStart(loanId) {
        this.rolledPositions[loanId] = 'pending';
    }

    handleRolloverSuccess(loanId){
        this.rolledPositions[loanId] = 'success';
    }

    async handleRolloverError(loanId, wallet, tokenAddress){
        this.rolledPositions[loanId] = 'error';

        //wrong -> update
        const position = tokenAddress.toLowerCase() === conf.testTokenRBTC.toLowerCase() ? 'long' : 'short';
        console.log('Storing failed transaction into DB');
        // store failed transaction in DB
        await dbCtrl.addRollover({
            rolloverAdr: wallet,
            status: 'failed',
            pos: position,
            loanId
        });
    }

    /**
     * Rollover currently does not emit logs
     */
    async addTx(txHash, walletAdr) {
        try {
            console.log("Add rollover to db");
            const receipt = await C.web3.eth.getTransactionReceipt(txHash);

            if (receipt && receipt.logs) {
                const logs = abiDecoder.decodeLogs(receipt.logs) || [];
                const gasUsed = C.web3.utils.fromWei(String(receipt.gasUsed), 'ether');
                const gasPrice = await C.getGasPrice();
                const usdPrices = await Arbitrage.getUsdPrices();
                const fee = Number(gasPrice) * Number(gasUsed) * usdPrices['rbtc'];
                let rolloverLog = {
                    fee: fee + ' xusd'
                };

                for(let log in logs){
                    if(!logs[log]) continue;

                    const logName = logs[log].name;
                    if (logName != 'LoanSwap' && logName != 'VaultWithdraw') continue;

                    const params = U.parseEventParams(logs[log].events);

                    if (logName == 'LoanSwap' && params && params.loanId) {
                        //wrong -> update
                        const pos = params.sourceToken.toLowerCase() === conf.testTokenRBTC ? 'long' : 'short';
                        rolloverLog = Object.assign(rolloverLog, {
                            loanId: params.loanId,
                            txHash: receipt.transactionHash,
                            rolloverAdr: receipt.logs[0].address,
                            rolledoverAdr: params.borrower,
                            status: 'successful',
                            pos
                        });
                    } else if (logName == 'VaultWithdraw' && params && params.to == walletAdr.toLowerCase()) {
                        const symbol = C.getTokenSymbol(params.asset).toLowerCase();
                        const amountUsd = Number(C.web3.utils.fromWei(params.amount, "Ether")) * usdPrices[symbol];
                        rolloverLog.amount = amountUsd + ' xusd';
                    }
                }

                if (rolloverLog.loanId && rolloverLog.amount) {
                    await dbCtrl.addRollover(rolloverLog);
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
