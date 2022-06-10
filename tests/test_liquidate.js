import conf from '../config/config';
import C from '../controller/contract';
import Liquidator from '../controller/liquidator';

const liquidate = async (loanId) => {
    const pos = await C.contractSovryn.methods.getLoan(loanId).call();
    console.log(pos);
    const token = pos.loanToken.toLowerCase() === conf.testTokenRBTC ? "rBtc" : pos.loanToken;
    const [wallet, wBalance] = await Liquidator.getWallet(pos, token);

    if (!wallet || wBalance.isZero()) {
        throw "No wallet found";
    }

    const liquidateAmount = await Liquidator.calculateLiquidateAmount(wBalance, pos, token, wallet);
    const nonce = await C.web3.eth.getTransactionCount(wallet.adr, 'pending');
    console.log("trying to liquidate loan " + loanId + " from wallet " + wallet.adr + ", amount: " + liquidateAmount);
    console.log("Nonce: " + nonce);

    const gasPrice = await C.getGasPrice();

    return new Promise((resolve) => {
        C.contractSovryn.methods.liquidate(loanId, wallet.adr, liquidateAmount.toString())
            .send({ from: wallet.adr, gas: conf.gasLimit, gasPrice: gasPrice, nonce: nonce, value: 0 })
            .on('hash', async (tx) => {
                console.log('tx hash', tx);
            })
            .on('receipt', async (tx) => {
                console.log("loan " + loanId + " liquidated!", "tx hash", tx.transactionHash);
                resolve();
            })
            .on('error', async (err) => {
                console.error("Error on liquidating loan " + loanId);
                console.error(err);
            });
    });
};

console.log('using network', conf.network);

liquidate('0xed93e73d7daca3e42e9f170f8fd16695fb39970c5354c7c56ce515a96845a030')
.catch(console.error);