import Web3 from 'web3';

window.addEventListener('load', async () => {
    if (window.ethereum) {
        console.log("web3 provider found");
        window.web3 = new Web3(window.ethereum);
        window.ethereum.enable();

        const accounts = await web3.eth.getAccounts();
        console.log("main adr: "+accounts[0]);
        window.acc = accounts[0];    
    }
    else window.web3 = new Web3(Web3.givenProvider);

    console.log("web3 loaded");
    //console.log(window.web3);
});