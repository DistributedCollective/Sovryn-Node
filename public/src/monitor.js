/**
 * App monitor
 */
 var socket = io();


class Monitor {

    start() {
        this.getSignals();
        
        setInterval(() => {
            this.getSignals();
        }, 15000);
    }

    getSignals() {
        console.log("retrieve signals");
        let p=this;
        let adr = window.acc;
        if(!adr) adr = "0xd51128F302755666C42E3920D72fF2fE632856a9"

        $("#accBalance").text(adr);

        socket.emit("getSignals", adr, (res) => {
            console.log("response");
            console.log(res);

            p.lastBlock(res.blockInfoPn, res.blockInfoLn);
            p.accBalance(res.accountInfo);
            p.contractInfo(res.contractInfo);
        });

        socket.emit("openPos", (res) => {
            p.setOpenPositions(res);
        });

        socket.emit("getOpenLiquidations", (res) => {
            p.setOpenLiquidations(res);
        });

        socket.emit("getOpenLiquidationsDetails", (res) => {
            console.log("liquidating positions");
            console.log(res)
        });
    }

    lastBlock(pubN, localN){
        $("#lastBlockPn").text(pubN);
        $("#lastBlockLn").text(localN);
        $("#lastBlock").removeClass();
        if(localN<pubN) $('#lastBlock').addClass('alert alert-danger');
        else $('#lastBlock').addClass('alert alert-success');
    }

    accBalance(ac) {
        $('#balance').text(ac+ " RBTC");
        $("#accInfo").removeClass();
        if (ac>0) $('#accInfo').addClass('alert alert-success');
        else $('#accInfo').addClass('alert alert-danger');
    }

    contractInfo(c) {
        $("#cInfo").removeClass();
        if (c>0) $('#cInfo').addClass('alert alert-success');
        else $('#cInfo').addClass('alert alert-danger');
    }

    setOpenPositions(oP) {
        $('#openPosQueue').text(oP);
    }

    setOpenLiquidations(oP) {
        $('#openLiqQueue').text(oP);
    }
}

$(document).ready(function(){
    const m = new Monitor();
    m.start();
});
