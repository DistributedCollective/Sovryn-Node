import c from '../config/config_testnet';
import abiLoanToken from '../config/abiLoanToken';
import abiLoanOpeningEvents from "../config/abiLoanOpeningEvents.js";

import Rsk3 from '@rsksmart/rsk3';


let rsk3 = new Rsk3('http://18.138.223.132:4444');
let rsk3s = new Rsk3('ws://18.138.223.132:4445');
//let rsk3 = new Rsk3('https://public-node.testnet.rsk.co'); //getPastEvents and events in general not allowed


rsk3.getBalance("0xe2b59CD37D173D550D75e9891376bf21b3f996F1").then((res)=> {
    console.log("balance");
    console.log(res);
});

/*
let contractSUSD = new rsk3.Contract(abiLoanToken.concat(abiLoanOpeningEvents), c.loanTokenSUSD);


contractSUSD.getPastEvents('Transfer', {
    fromBlock: 664110,
    toBlock: 'latest'
}, (error, events) => {
    if (error) {
        console.log("had an error"); console.log(error);
    }
    console.log("no err")
    console.log(events);
}); 

/*
contractSUSD.events.Transfer({
    fromBlock: 1087727,
    toBlock: 1087729
}, (error, events) => {
    if (error) {
        console.log("had an error"); console.log(error);
    }
    console.log("no err")
    console.log(events);
});           
*/