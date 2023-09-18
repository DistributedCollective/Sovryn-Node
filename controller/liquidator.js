/**
 * Liquidation handler
 * If liquidation is successful removes position from liquidation list
 * If it fails, check if the liquidation criteria are still met.
 * If no, delete it from the liquidation list. If yes, send an error notification to a telegram group for manual processing.
 */

import C from './contract';
import U from '../util/helper';
import Wallet from './wallet';
import Arbitrage from '../controller/arbitrage';
import conf from '../config/config';
import common from './common'
import abiDecoder from 'abi-decoder';
import abiComplete from "../config/abiComplete";
import Extra from 'telegraf/extra';
import dbCtrl from './db';
import _ from 'lodash';
import Lock from '../util/lock';

export class Liquidator {
    constructor() {
        this.liquidationErrorList=[];
        this.processingPos = {};
        this.handlingRounds = [];
        abiDecoder.addABI(abiComplete);
    }

    start(liquidations) {
        this.liquidations = liquidations;
        this.checkPositionsForLiquidations();
    }

    isLiquidatable(position) {
        return (
            position.maxLiquidatable > 0 &&
            position.currentMargin < this.getBufferedMaintenanceMargin(position)
        );
    }

    getBufferedMaintenanceMargin(position) {
        const maintenanceMarginBuffer = conf.maintenanceMarginBuffer || 0.95;
        return position.maintenanceMargin * maintenanceMarginBuffer;
    }

    /**
     * Wrapper for liquidations
     * 1. Get a wallet with enough funds in required tokens and which is not busy at the moment, then
     * 2. Try to liquidate position
     */
    async checkPositionsForLiquidations() {
        while (true) {
            const roundId = Date.now();
            
            if (this.handlingRounds.length < 5) {
                this.handlingRounds.push(roundId);
                console.log("started liquidation round #" + roundId, ', queue:', this.handlingRounds.length);
                console.log(Object.keys(this.liquidations).length + " positions need to be liquidated");
    
                this.handleLiquidationRound().then(() => {
                    console.log("Completed liquidation round #" + roundId);
                }).catch(e => {
                    console.error(`Error processing a liquidation round #${roundId}:`, e);
                }).finally(() => {
                    this.handlingRounds.shift();
                });
            }

            await U.wasteTime(conf.liquidatorScanInterval);
        }
    }

    async handleLiquidationRound() {
        let sortedPos = [];
        for (let p in this.liquidations) {
            //prevent process same position in concurrent rounds
            if (this.processingPos[p]) {
                if (Date.now() - this.processingPos[p] > 5 * 6000) delete this.processingPos[p];
                continue;
            }

            this.processingPos[p] = Date.now();

            const pos = this.liquidations[p];
            if (!this.isLiquidatable(pos) || Number(pos.maxLiquidatable) <= 0) {
                console.log(`Position no longer liquidatable: ${p}`);
                delete this.liquidations[p];
                delete this.processingPos[p];
                continue;
            }

            //failed too often -> have to check manually
            if (this.liquidationErrorList[p] >= 5) {
                delete this.processingPos[pos.loanId];
                continue;
            }

            let maxSeizable = pos.maxSeizable;
            if (!C.isStablecoins(pos.loanToken.toLowerCase())) {
                maxSeizable = await Arbitrage.getPriceFromAmm(C.contractSwaps, pos.loanToken.toLowerCase(), conf.XUSDToken, maxSeizable);
            }
            
            const usdAmount = Number(C.web3.utils.fromWei(String(maxSeizable), 'Ether'));

            sortedPos.push({
                pos,
                usdAmount
            });
        }

        console.log('profitable positions: ' + sortedPos.length);

        sortedPos = _.sortBy(sortedPos, p => -p.usdAmount);

        const sendingTxsPromises = [];
        for (let i in sortedPos) {

            // It's possible that something has changed in between of finding the position by the Scanner and calling
            // this method. Thus, we fetch the loan again here.
            let { pos } = sortedPos[i];

            pos = await C.contractSovryn.methods.getLoan(pos.loanId).call();
            const token = pos.loanToken;

            this.processingPos[pos.loanId] = Date.now();

            //Position already in liquidation wallet-queue
            if (Wallet.checkIfPositionExists(pos.loanId)) continue;

            const [wallet, wBalance] = await this.getWallet(pos, token);
           // console.log("wallet:"); console.log(wallet);
            
            if (!wallet) {
                this.handleNoWalletError(pos.loanId, pos).catch(e => {
                    console.error('Error handling noWalletError:', e);
                });
                delete this.processingPos[pos.loanId];
                continue;
            }

            const liquidateAmount = await this.calculateLiquidateAmount(wBalance, pos, token, wallet);
            if (!liquidateAmount || liquidateAmount.isZero()) {
                Wallet.removePendingTx("liquidator", wallet.adr, pos.loanId);
                continue;
            };

            const pendingTxs = Wallet.countPendingTxs('liquidator', wallet.adr);
            console.log(`sending tx on wallet ${wallet.adr}, pending ${pendingTxs}`);
            
            Wallet.addPendingTx("liquidator", wallet.adr, pos.loanId, liquidateAmount, token);

            const tx = this.liquidate(pos.loanId, wallet.adr, liquidateAmount, token, pos);
            sendingTxsPromises.push(tx);
            await U.wasteTime(5);
        }

        if (!conf.enableV2.liquidator) {
            let swapListResults = await Promise.all(sendingTxsPromises);
    
            await this.handleSwapForWallets(swapListResults);
        }

        for (const p of sortedPos) {
            delete this.processingPos[p.pos.loanId];
        }
    }

    // return [wallet so send liquidation from, balance available for liquidation]
    async getWallet(pos, token) {
        // get wallet balance as bignumber
        console.log('Finding wallet for position', pos.loanId);
        let [wallet, wBalance] = await Wallet.getWallet("liquidator", pos.maxLiquidatable, token, C.web3.utils.toBN);

        return [wallet, wBalance]
    }

    async calculateLiquidateAmount(wBalance, pos, token, wallet) {
        const toBN = C.web3.utils.toBN;
        const BN = C.web3.utils.BN;
        const maxLiquidatable = toBN(pos.maxLiquidatable);
        let liquidateAmount = BN.min(maxLiquidatable, wBalance);
        const gasPrice = await C.getGasPrice();
        const rbtcBalance = toBN(await C.web3.eth.getBalance(wallet.adr));
        const txFees = toBN(conf.gasLimit).mul(toBN(gasPrice));

        if (txFees.gt(rbtcBalance)) {
            console.log("not enough RBTC balance on wallet to pay fees");
            return;
        } else if (maxLiquidatable.lt(wBalance)) {
            console.log("enough balance on wallet");
        } else if (wBalance.isZero()) {
            console.log("not enough balance on wallet");
            return;
        } else {
            if (token === "rBtc") {
                // TODO: this doesn't seem right -- why do we need to subtract txfees?
                liquidateAmount = toBN(wBalance).sub(txFees);
            }
            if (liquidateAmount.lte(toBN('0'))) {
                console.log("not enough balance on wallet");
                return;
            }
            console.log("not enough balance on wallet. only use "+liquidateAmount.toString());
        }
        return liquidateAmount;
    }

    // Handle swapback with grouped by wallet
    async handleSwapForWallets(swapList) {
        swapList = (swapList || []).filter(item => item && item.wallet && item.amount && item.conversionPath);
        if (swapList.length == 0) return;
       
        const toBN = C.web3.utils.toBN;
        const swapByWallet = {}; //{ <walletAdr>: { 'fromToken_toToken': swapData } }
        swapList.forEach(({ wallet, loanId, amount, conversionPath }) => {
            swapByWallet[wallet] = swapByWallet[wallet] || {};
            const fromToken = conversionPath[0], toToken = conversionPath[conversionPath.length - 1];
            const pair = `${fromToken}_${toToken}`;

            if (swapByWallet[wallet][pair] == null) {
                swapByWallet[wallet][pair] = {
                    wallet,
                    conversionPath,
                    amount: toBN(String(amount)),
                    loanIds: [loanId]
                };
            } else {
                swapByWallet[wallet][pair].amount = swapByWallet[wallet][pair].amount.add(toBN(String(amount)));
                swapByWallet[wallet][pair].loanIds.push(loanId);
            }
        });

        const p = this;
        await Promise.all(Object.keys(swapByWallet).map(async (wallet) => {
            const list = Object.values(swapByWallet[wallet]);
            for (const item of list) {
                await p.swapBackAfterLiquidation(item.amount, item.conversionPath, wallet);
            }
        }));
    }

    /**
    * swaps back to collateral currency after liquidation is completed
    * @param value should be sent in Wei format as String
    * @param sourceCurrency should be that hash of the contract
    * @param destCurrency is defaulting for now to 'rbtc'
    */
    async swapBackAfterLiquidation(value, path, wallet) {
        const sourceToken = path[0];
        const destToken = path[path.length - 1];
        if (sourceToken.toLowerCase() != conf.testTokenRBTC.toLowerCase()) {
            const sourceTokenBal = await C.getWalletTokenBalance(wallet, sourceToken);
            if (Number(sourceTokenBal) > 0) {
                value = sourceTokenBal;
            }
        } else {
            const walletBal = Number(await C.getWalletBalance(wallet));
            if (walletBal > 0.002) {
                value = C.web3.utils.toWei(String(Number(walletBal - 0.002).toFixed(18)), 'ether');
            }
        }

        const sourceCurrency = C.getTokenSymbol(sourceToken);
        const destCurrency = C.getTokenSymbol(destToken);
        console.log(`Swapping back ${value} ${sourceCurrency} to ${destCurrency} on ${wallet}`);

       // const releaseLock = await Lock.acquire('liquidate:' + wallet);

        try {
            const prices = await Arbitrage.getRBtcPrices();
            const tokenPriceInRBtc = prices[sourceCurrency];
            if (sourceCurrency !== 'rbtc' && !tokenPriceInRBtc) throw "No prices found for the " + sourceCurrency + " token";

            const minReturn = 1;
            const beneficiary = wallet;
            const affiliateAcc = "0x0000000000000000000000000000000000000000";
            const affiliateFee = 0;
            const gasPrice = await C.getGasPrice();
            const nonce = await Wallet.getNonce(wallet);
            let txValue = 0;
            let tx;
            if (sourceCurrency == 'rbtc') {
                tx = C.wRbtcWrapper.methods.convertByPath(path, value, minReturn);
                txValue = value;
            } else {
                tx = C.contractSwaps.methods.convertByPath(path, value, minReturn, beneficiary, affiliateAcc, affiliateFee);
            }

            const res = await tx.send({ from: wallet, gas: conf.gasLimit, gasPrice: gasPrice, value: txValue, nonce });
           // releaseLock();

            if (res) {
                console.log(`Swap successful on ${wallet}, tx: ${res.transactionHash}`);
            }
        } catch (err) {
            console.log(`Swap input ${value} ${sourceCurrency} to ${destCurrency} on ${wallet}`);
            console.log("Swap failed", err);
        } finally {
           // releaseLock();
        }
    }

    async checkLiquidateSwapback(loan, liquidateLog) {
        let enableSwapback = false, conversionPath;
        const collateralToken = loan.collateralToken.toLowerCase();
        if (conf.enableSwapback && liquidateLog) {
            // don't enable swapback if we're seizing stablecoins anyway
            if (C.isStablecoins(collateralToken)) {
                console.log("swapback would be enabled in config but disabled because collateralToken is a stablecoin");
                enableSwapback = false;
            } else {
                console.log("swapback is enabled");
                try {
                    enableSwapback = true;
                    conversionPath = await C.contractSwaps.methods.conversionPath(collateralToken, loan.loanToken).call()
                    console.log("swapback conversion path:", conversionPath);
                } catch (e) {
                    console.error("error getting swapback conversion path:", e, "swapback is disabled");
                    enableSwapback = false;
                }
            }
            if (enableSwapback && conversionPath) {
                let swapbackReturn = await C.contractSwaps.methods.rateByPath(conversionPath, liquidateLog.collateralWithdrawAmount).call();
                console.log(swapbackReturn);
                swapbackReturn = C.web3.utils.toBN(swapbackReturn);
                console.log(Number(swapbackReturn), Number(liquidateLog.repayAmount))

                if (Number(swapbackReturn) >= Number(liquidateLog.repayAmount)) {
                    return conversionPath;
                } else {
                    throw `Swap failed: SwapbackReturn lt loan close amount (${Number(swapbackReturn)}, ${Number(liquidateLog.repayAmount)})`;
                }
            }
        }
    }

    /*
    * Tries to liquidate a position
    * If Loan token == WRBTC -> pass value
    * wallet = sender and receiver address
    */
    async liquidate(loanId, wallet, amount, token, loan) {
        //const releaseLock = await Lock.acquire('liquidate:' + wallet);
        try {
            console.log("trying to liquidate loan " + loanId + " from wallet " + wallet + ", amount: " + amount);
            const isRbtcToken = (token.toLowerCase() === 'rbtc' || token.toLowerCase() === conf.testTokenRBTC.toLowerCase());
            const val = 0;
            const nonce = await Wallet.getNonce(wallet);
            console.log("Sending val: " + val);
            console.log("Nonce: " + nonce);


            if (this.liquidations && Object.keys(this.liquidations).length > 0) {
                //delete position from liquidation queue, regardless of success or failure because in the latter case it gets added again anyway
                delete this.liquidations[loanId];
            }

            const p = this;
            const gasPrice = await C.getGasPrice();

            const pos = isRbtcToken ? 'long' : 'short';

            return new Promise((resolve) => {
                C.contractSovryn.methods.liquidate(loanId, wallet, amount.toString())
                    .send({ from: wallet, gas: conf.gasLimit, gasPrice: gasPrice, nonce: nonce, value: 0 })
                    .on('transactionHash', (transactionHash) => {
                        console.log('liquidation transactionHash', transactionHash);
                       // releaseLock();
                    })
                    .on('receipt', async (tx) => {
                        Wallet.removePendingTx('liquidator', wallet, loanId);
                        console.log("loan " + loanId + " liquidated!", "tx hash", tx.transactionHash);
                        await p.handleLiqSuccess(wallet, loanId, tx.transactionHash, amount, token);
                        const parsedEvent = await p.addLiqLog(tx.transactionHash, pos);

                        const swapbackConversionPath = await this.checkLiquidateSwapback(loan, parsedEvent);

                        if (swapbackConversionPath) {
                            resolve({
                                wallet,
                                loanId,
                                amount: parsedEvent.collateralWithdrawAmount,
                                conversionPath: swapbackConversionPath
                            });
                        }
                    })
                    .on('error', async (err, receipt) => {
                       // releaseLock();
                        Wallet.removePendingTx('liquidator', wallet, loanId);
                        console.error("Error on liquidating loan " + loanId);
                        console.error(err);

                        let errorDetails;
                        if (receipt) {
                            errorDetails = `${conf.blockExplorer}tx/${receipt.transactionHash}`;
                        } else {
                            errorDetails = err.toString().slice(0, 200);
                        }
                        common.telegramBot.sendMessage(
                            `<b><u>L</u></b>\t\t\t\t ⚠️<b>ERROR</b>⚠️\n Error on liquidation tx: ${errorDetails}\n` +
                            `LoanId: ${U.formatLoanId(loanId)}`,
                            Extra.HTML()
                        );
                        resolve();
                        await p.handleLiqError(wallet, loanId, amount, pos);
                    });
            });
        } catch (err) {
            console.log(err);
        } finally {
           // releaseLock();
        }
    }

    async handleLiqSuccess(wallet, loanId, txHash, amount, token) {
        this.liquidationErrorList[loanId]=null;
        const formattedAmount = C.web3.utils.fromWei(amount.toString(), 'Ether');
        let tokenSymbol;
        if (token.toLowerCase() === 'rbtc') {
            tokenSymbol = token;
        } else {
            tokenSymbol = C.getTokenSymbol(token).toUpperCase();
        }
        const msg = `<b><u>L</u></b>\t\t\t\t ${conf.network} net-liquidation of loan ${U.formatLoanId(loanId)} of ${formattedAmount} ${tokenSymbol} successful. 
            \n${conf.blockExplorer}tx/${txHash}`;
        common.telegramBot.sendMessage(msg, Extra.HTML());
    }

    /**
     * Possible errors:
     * 1. Another user was faster -> position is already liquidated
     * 2. Btc price moved in opposite direction and the amount cannot be liquidated anymore
     */
    async handleLiqError(wallet, loanId, amount, pos) {
        if(!this.liquidationErrorList[loanId]) this.liquidationErrorList[loanId]=1;
        else this.liquidationErrorList[loanId]++;

        console.log('Storing failed transaction into DB');
        // store failed transaction in DB
        await dbCtrl.addLiquidate({
            liquidatorAdr: wallet,
            amount,
            loanId,
            status: 'failed',
            pos
        });
        const updatedLoan = await C.getPositionStatus(loanId)
        if (updatedLoan.maxLiquidatable > 0) {
            console.log("loan " + loanId + " should still be liquidated. Please check manually");
            common.telegramBot.sendMessage(`<b><u>L</u></b>\t\t\t\t ${conf.network} net-liquidation of loan ${U.formatLoanId(loanId)} failed.`, Extra.HTML());
        }
    }

    async handleNoWalletError(loanId, pos) {
        const colToken = C.getTokenSymbol(pos.collateralToken).toUpperCase();
        const loanToken = C.getTokenSymbol(pos.loanToken).toUpperCase();
        const size = C.web3.utils.fromWei(pos.maxLiquidatable);
        console.log("Liquidation of loan " + loanId + " failed because no wallet with enough funds was available, size " + size + " " + loanToken + ", col " + colToken);
       // await common.telegramBot.sendMessage(`<b><u>L</u></b>\t\t\t\t ${conf.network} net-liquidation of loan ${U.formatLoanId(loanId)} failed because no wallet with enough funds was found.`, Extra.HTML());
    }

    async calculateLiqProfit(liqEvent) {
        console.log("Calculate profit for liquidation", liqEvent.loanId);
        // To calculate the profit from a liquidation we need to get the difference between the amount we deposit in the contract, repayAmount,
        // and the amount we get back, collateralWithdrawAmount. But to do this we need to convert both to the same currency
        // Convert spent amount to collateral token 
        const convertedPaidAmount = await Arbitrage.getPriceFromPriceFeed(C.contractPriceFeed, liqEvent.loanToken, liqEvent.collateralToken, liqEvent.repayAmount);
        if (convertedPaidAmount) {
            const liqProfit = Number(C.web3.utils.fromWei(
                C.web3.utils.toBN(liqEvent.collateralWithdrawAmount).sub(C.web3.utils.toBN(convertedPaidAmount))
            , "Ether")).toFixed(6);
            console.log(`You made ${liqProfit} ${C.getTokenSymbol(liqEvent.collateralToken).toUpperCase()} with this liquidation`);
            return liqProfit+" "+C.getTokenSymbol(liqEvent.collateralToken).toUpperCase();
        }
        else {
            console.log("Couldn't calculate the profit for the given liquidation");
        }
    }

    async addLiqLog(txHash, pos) {
        console.log("Add liquidation "+txHash+" to db");
        try {
            const receipt = await C.web3.eth.getTransactionReceipt(txHash);
            
            if (receipt && receipt.logs) {
                const logs = abiDecoder.decodeLogs(receipt.logs) || [];
                const liqEvent = logs.find(log => log && log.name === 'Liquidate');
                console.log(liqEvent)
                const parsedEvent = U.parseEventParams(liqEvent && liqEvent.events);
                const {
                    user, liquidator, loanId, loanToken, collateralWithdrawAmount
                } = parsedEvent;

                console.log(parsedEvent)

                if (user && liquidator && loanId) {
                    console.log("user found");
                    console.log(user);
                    console.log(liquidator);
                    console.log(loanId);

                    const profit = await this.calculateLiqProfit(parsedEvent)

                    await dbCtrl.addLiquidate({
                        liquidatorAdr: liquidator,
                        liquidatedAdr: user,
                        amount: collateralWithdrawAmount,
                        loanId: loanId,
                        profit: profit,
                        txHash: txHash,
                        status: 'successful',
                        pos
                    });

                    return parsedEvent;
                }
            }

        } catch (e) {
            console.error(e);
        }
    }
}

export default new Liquidator();
