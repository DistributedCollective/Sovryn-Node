import c from '../../config/config_testnet';
import abiComplete from '../../config/abiComplete';

var contractBzx;

setTimeout(()=>{
    contractBzx =new window.web3.eth.Contract(abiComplete, c.bzxProtocolAdr);
},1000);

async function liquidate(p) {
    console.log("init liquidation");
    const loanId = "0xd93e64dfa3f103d0584d8e513a19bad7555f75a86cd83eb7a9585cea9c98eacf";

    const liqAmount = window.web3.utils.fromWei("79404534796813989926", "Ether");
    console.log("liquidating: "+liqAmount);
    let l = await liquidatePos(loanId, window.acc, liqAmount);
    console.log(l);
}

async function getLoan() {
    const loanId = "0xd93e64dfa3f103d0584d8e513a19bad7555f75a86cd83eb7a9585cea9c98eacf";
    let l = await getLoanStatus(loanId);
    console.log(l);
}




/*
**************************************************************************
*helpers******************************************************************
**************************************************************************
*/


/**
 * Liquidates a position
 */
function liquidatePos(loanId, receiver, closeAmount) {
    return new Promise(resolve => {
        contractBzx.methods.liquidate(loanId, receiver, web3.utils.toWei(closeAmount.toString(), 'Ether'))
            .send({ from: window.acc })
            .then(async (tx) => {
                console.log("liquidate pos Transaction: ", tx);
                resolve(tx.transactionHash);
            })
            .catch((err) => {
                console.error("Error on liquidation");
                console.error(err);
            });
    });
}



function getLoanStatus(loanId) {
    console.log("retrieve loan "+loanId);
    return new Promise(resolve => {
        contractBzx.methods.getLoan(loanId).call((error, result) => {
            if (error) {
                console.log(error);
                return resolve(0);
            }

            console.log("checking loan " + loanId);
            resolve(result);
        });
    });
}

window.liquidate = liquidate;
window.getLoan = getLoan;