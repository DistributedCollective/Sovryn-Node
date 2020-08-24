/**
 * App monitor
 */
 var socket = io();


class Monitor {

    start() {
        setInterval(() => {
            this.getSignals();
        }, 5000);
    }

    getSignals() {
        console.log("retrieve signals");
        let p=this;
        let adr = window.acc;
        if(!adr) adr = "0xAb242e50E95C2f539242763A4eD5Db1aEE5ce461"

        $("#accBalance").text(adr);

        socket.emit("getSignals", adr, (res) => {
            console.log("response");
            console.log(res);

            p.lastBlock(res.blockInfoPn, res.blockInfoLn);
            p.accBalance(res.accountInfo);
            p.cInfo(res.contractInfo);
        });
    }

    lastBlock(pN, lN){
        $("#lastBlockPn").text(pN);
        $("#lastBlockLn").text(lN);
        if(lN<pN) $('#lastBlock').addClass('alert alert-danger');
        else $('#lastBlock').addClass('alert alert-success');
    }

    accBalance(ac) {
        $('#balance').text(ac+ " RBTC");
        if (ac>0) $('#accInfo').addClass('alert alert-success');
        else $('#accInfo').addClass('alert alert-danger');
    }

    cInfo(c) {
        if (c>0) $('#cInfo').addClass('alert alert-success');
        else $('#cInfo').addClass('alert alert-danger');
    }
}

$(document).ready(function(){
    const m = new Monitor();
    m.start();
});
