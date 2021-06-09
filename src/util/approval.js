/**
 * Wallet token approvals
 * These approvals should be executed for every liquidator and arbitrage wallet once in order for liquidation or interacting with the 
 * Swap contract can work flawlessly
*/
import C from '../controller/contract';
import W from '../secrets/accounts';
import Util from '../util/helper';
import conf from '../config/config';

const web3 = C.web3;
const BN = web3.utils.BN;
const MAX_UINT256 = new BN('2').pow(new BN('256')).sub(new BN('1'));
const amount = MAX_UINT256;
const amountThreshold = amount.div(new BN('10')).mul(new BN('9')); // 90% of uint256 might be enough
const tokenAddresses = C.getAllTokenAddresses();
const maxPendingTransactions = 4;

async function approve() {
    await approveLiquidatorWallets();
    await approveArbitrageWallets();
    await approveRolloverWallets();
}

async function approveLiquidatorWallets() {
    console.log("start approving liquidator wallets")

    for (let wallet of W.liquidator) {
        const walletAddress = wallet.adr;
        for (let tokenContractAddress of tokenAddresses) {
            await approveToken(tokenContractAddress, walletAddress, conf.sovrynProtocolAdr);
        }
    }
}

async function approveArbitrageWallets() {
    console.log("start approving arbitrage wallets")

    for (let wallet of W.arbitrage) {
        const walletAddress = wallet.adr;
        for (let tokenContractAddress of tokenAddresses) {
            // approve both the AMM and RBTC proxy to spend the tokens
            // in theory, RBTC proxy should be enough....
            await approveToken(tokenContractAddress, walletAddress, conf.swapsImpl);
            await approveToken(tokenContractAddress, walletAddress, conf.wRbtcWrapper);
        }
    }
}

async function approveRolloverWallets() {
    console.log("start approving rollover wallets")

    for (let wallet of W.rollover) {
        const walletAddress = wallet.adr;
        for (let tokenContractAddress of tokenAddresses) {
            await approveToken(tokenContractAddress, walletAddress, conf.sovrynProtocolAdr);
        }
    }
}

const alreadyApproved = {};
let numPendingTransactions = 0;
async function approveToken(tokenAddress, ownerAddress, spenderAddress) {
    const tokenSymbol = C.getTokenSymbol(tokenAddress);
    tokenAddress = tokenAddress.toLowerCase();
    ownerAddress = ownerAddress.toLowerCase();
    spenderAddress = spenderAddress.toLowerCase();
    const cacheKey = `${tokenAddress}-${ownerAddress}-${spenderAddress}`;
    if(alreadyApproved[cacheKey]) {
        console.log(`already approved ${spenderAddress} to spend ${tokenSymbol} on behalf of ${ownerAddress}`);
        return;
    }
    alreadyApproved[cacheKey] = true;

    const tokenContract = C.getTokenInstance(tokenAddress);
    if(!tokenContract) {
        throw new Error(`unknown token: ${tokenAddress}`);
    }
    const allowance = await tokenContract.methods.allowance(ownerAddress, spenderAddress).call();
    if(new BN(allowance).gt(amountThreshold)) {
        console.log(`${spenderAddress} already has enough allowance to spend ${tokenSymbol} on behalf of ${ownerAddress}`);
        return;
    }

    await waitForPendingTransactions();
    const nonce = await web3.eth.getTransactionCount(ownerAddress, 'pending');
    const gasPrice = await C.getGasPrice();
    console.log(`approving ${spenderAddress} to spend unlimited ${tokenSymbol} on behalf of ${ownerAddress} (nonce ${nonce})`);

    numPendingTransactions++;
    const txHash = await new Promise((resolve, reject) => {
        tokenContract.methods.approve(spenderAddress, amount).send({
            from: ownerAddress,
            nonce,
            gas: 200000,
            gasPrice,
        }).once(
            'transactionHash',
            hash => resolve(hash)
        ).catch(
            error => reject(error)
        );
    });
    console.log("tx hash:", txHash);
    waitForTransaction(txHash).then(txReceipt => {
        numPendingTransactions--;
        if(txReceipt.status) {
            console.log(`Approval transaction successful for ${tokenSymbol}: ${txHash}`);
        } else {
            console.error(`Errored approval transaction for ${tokenSymbol}: ${txHash}`);
        }
    }).catch(e => {
        console.error('Error waiting approval transaction', e);
    });
}

async function waitForPendingTransactions(max = maxPendingTransactions) {
    let iteration = 0;
    while (numPendingTransactions >= max) {
        if(iteration % 10 === 0) {
            // avoid spam by only logging every 10 seconds
            console.log(`Waiting until there are less than ${max} pending transactions (currently ${numPendingTransactions})...`)
        }
        iteration++;
        await Util.wasteTime(1);
    }
}

async function waitForTransaction(txHash) {
    while(true) {
        let txReceipt = await web3.eth.getTransactionReceipt(txHash);
        if(txReceipt) {
            return txReceipt;
        }
        await Util.wasteTime(3);
    }
}

if(require.main === module) {
    approve().then(() => {
        console.log('All wallets approved. Waiting for all transactions');
        waitForPendingTransactions(1).then(() => {
            console.log('All wallets approved successfully.')
        }).catch(e => {
            console.error('Error waiting for transactions', e);
        });
    }).catch(e => {
        console.error('Error in approval:', e);
    })
}
