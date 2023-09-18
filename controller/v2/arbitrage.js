/**
 * Arbitrage V2 with Watcher contract.
 *
 * Quick and dirty implementation extending the existing Arbitrage controller
 */
import C from '../contract';
import A from '../../secrets/accounts';
import Extra from 'telegraf/extra';
import conf from '../../config/config';
import common from './../common';
import { Arbitrage } from "../arbitrage";

class ArbitrageV2 extends Arbitrage {
    // silly fork. because our calculations are different
    async calculateLimitedAmount(amount, sourceTokenAddress, sourceTokenSymbol) {
        const executorAddress = A.arbitrage[0].adr;
        const fromAddress = C.contractWatcher._address;
        const sourceContract = C.getTokenInstance(sourceTokenAddress);

        const executorRbtcBalance = this.BN(await C.web3.eth.getBalance(executorAddress))
        if(executorRbtcBalance.lt(C.web3.utils.toWei('0.0001'))) {
            console.log(
                'not executing arbitrage because executor RBTC balance %s is low - might not be able to pay gas costs',
                C.web3.utils.fromWei(executorRbtcBalance)
            )
            return this.BN('0');
        }

        const arbitragerBalance = this.BN(await sourceContract.methods.balanceOf(fromAddress).call());
        if(arbitragerBalance.isZero() || arbitragerBalance.isNeg()) {
            console.log('no balance held in watcher contract -- cannot do anything')
            return this.BN('0');
        }

        let configMaxAmountWei = null;
        if(conf.dynamicArbitrageMaxAmounts) {
            const configMaxAmountStr = conf.dynamicArbitrageMaxAmounts[sourceTokenSymbol] || conf.dynamicArbitrageMaxAmounts.default;
            if(configMaxAmountStr) {
                configMaxAmountWei = this.BN(C.web3.utils.toWei(configMaxAmountStr));
            }
        }

        if(!configMaxAmountWei || arbitragerBalance.lt(configMaxAmountWei)) {
            // config max not specified or balance < config max
            if(amount.gt(arbitragerBalance)) {
                console.log(
                    `Limiting amount to held balance ${C.web3.utils.fromWei(arbitragerBalance)} ${sourceTokenSymbol} ` +
                    `instead of ${C.web3.utils.fromWei(amount)} ${sourceTokenSymbol} `
                );
                amount = arbitragerBalance;
            }
        } else if(amount.gt(configMaxAmountWei)) {
            // config max amount specified and less than amount
            console.log(
                `Limiting amount to max amount specified in config: ${C.web3.utils.fromWei(configMaxAmountWei)} ${sourceTokenSymbol} ` +
                `instead of ${C.web3.utils.fromWei(amount)} ${sourceTokenSymbol}`
            );
            amount = configMaxAmountWei;
        }
        return amount;
    }

    // most of this is also forked, could write it better
    async swap(amount, sourceCurrency, destCurrency) {
        console.log("Send " + amount + " src " + sourceCurrency + " dest " + destCurrency + " to the amm");
        let sourceToken, destToken;

        if(sourceCurrency === "doc") sourceToken = conf.docToken;
        else if(sourceCurrency === "usdt") sourceToken = conf.USDTToken;
        else if(sourceCurrency === "bpro") sourceToken = conf.BProToken;
        else if(sourceCurrency === "xusd") sourceToken = conf.XUSDToken;
        else if(sourceCurrency === "eths") sourceToken = conf.ethsToken;
        else if(sourceCurrency === "dllr") sourceToken = conf.dllrToken;
        else sourceToken = conf.testTokenRBTC;

        if(destCurrency === "doc") destToken = conf.docToken;
        else if(destCurrency === "usdt") destToken = conf.USDTToken;
        else if(destCurrency === "bpro") destToken = conf.BProToken;
        else if(destCurrency === "xusd") destToken = conf.XUSDToken;
        else if(destCurrency === "eths") destToken = conf.ethsToken;
        else if(destCurrency === "dllr") destToken = conf.dllrToken;
        else destToken = conf.testTokenRBTC;

        const minProfit = 0; // no profit enforced yet
        const fromAddress = A.arbitrage[0].adr;
        const numberOfHops = destCurrency === "rbtc" || sourceCurrency === "rbtc" ? 3 : 5;

        const conversionPath = await C.contractSwaps.methods.conversionPath(sourceToken, destToken).call();
        if (conversionPath.length !== numberOfHops) {
            throw new Error(
                "error loading conversion path from " + contract1._address +
                " for src " + sourceToken + ", dest " + destToken + " and amount: " + amount
            );
        }

        const gasPrice = await C.getGasPrice();
        let tx;
        try {
            tx = await C.contractWatcher.methods.arbitrage(
                conversionPath,
                amount,
                minProfit,
            ).send({
                from: fromAddress,
                gas: conf.gasLimit,
                gasPrice: gasPrice,
            });
        } catch (err) {
            console.error("Error on arbitrage tx ");
            console.error(err);
            let explorerLink = '(not available)';
            if (err.receipt) {
                explorerLink = `${conf.blockExplorer}tx/${err.receipt.transactionHash}`;
            }
            await common.telegramBot.sendMessage(
                `<b><u>A</u></b>\t\t\t\t ⚠️<b>ERROR</b>⚠️\n Error on arbitrage tx swapping ${C.web3.utils.fromWei(amount.toString(), 'Ether')} ${sourceCurrency} for ${destCurrency}\n` +
                `Transaction hash: ${explorerLink}`,
                Extra.HTML()
            );
            return;
        }
        const msg = (
            `Arbitrage tx successful: traded ` +
            `${C.web3.utils.fromWei(amount.toString(), 'Ether')} ${C.getTokenSymbol(sourceToken)} for ${C.getTokenSymbol(destToken)}\n` +
            `${conf.blockExplorer}tx/${tx.transactionHash}`
        );
        console.log(msg);
        await common.telegramBot.sendMessage(`<b><u>A</u></b>\t\t\t\t ${conf.network}-${msg}`, Extra.HTML())
        return tx;
    }
}

export default new ArbitrageV2();
