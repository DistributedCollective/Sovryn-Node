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
        console.log("retrive signals");
        let p=this;
        socket.emit("getSignals", (res) => {
            console.log("response");
            console.log(res);

            p.lastBlock(res.blockInfoPn, res.blockInfoLn);
            p.accBalance(res.accBalance);
            p.cInfo(res.cInfo);
        });
    }

    lastBlock(pN, lN){
        $("#lastBlockPn").text(pN);
        $("#lastBlockLn").text(lN);
        if(lN<pN) $('#lastBlock').addClass('alert alert-danger');
        else $('#lastBlock').addClass('alert alert-success');
    }

    accBalance(ac) {
        if (ac>0) $('#accBalance').addClass('alert alert-success');
        else $('#accBalance').addClass('alert alert-danger');
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
