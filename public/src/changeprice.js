import c from '../../config/config_testnet';
import abiPriceFeed from '../../tests/abi/abiPriceFeed';

var contractPriceFeed;
const adrPriceFeed = "0xf2e9fD37912aB53D0FEC1eaCE86d6A14346Fb6dD";


async function changeP(p) {
    console.log("init");
    contractPriceFeed = new web3.eth.Contract(abiPriceFeed, adrPriceFeed);
    
    //change price
    let newPrice = $('#price').val();
    let a = await changePrice(c.testTokenRBTC, c.testTokenSUSD, newPrice);
    console.log(a);
}


/*
**************************************************************************
*helpers******************************************************************
**************************************************************************
*/


/**
 * Change token price
 */
function changePrice(srcToken, destToken, rate) {
    console.log("change price to "+rate);
    return new Promise(resolve => {
        contractPriceFeed.methods.setRates(srcToken, destToken, web3.utils.toWei(rate.toString(), 'Ether'))
            .send({ from: window.acc})
            .then(async (tx) => {
                console.log("change price Transaction: ", tx);
                resolve(tx.transactionHash);
            })
            .catch((err) => {
                console.error("Error on changing price");
                console.error(err);
            });
    });
}



  
  //calc liquidation price for long position
  function calcLiquidationPrice (startPrice, leverage) {
    const maintenanceMargin = 0.15;
    const maxPriceMovement = 1/leverage - maintenanceMargin;
    return (1 - maxPriceMovement) * price; 
  }


  window.changeP = changeP;