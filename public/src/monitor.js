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

        socket.emit("getSignals", (res) => {
            console.log("response signals");
            console.log(res);

            p.lastBlock(res.blockInfoPn, res.blockInfoLn);
            p.accBalances(res.accountInfoLiq, res.accountInfoRoll);
            p.showOpenPositions(res.positionInfo);
            p.showOpenPositions(res.liqInfo);
        });

        /*
        socket.emit("getOpenPositionsDetails", (res) => {
            console.log("open positions");
            console.log(res);
            p.showOpenPositions(res);
        });

        socket.emit("getOpenLiquidationsDetails", (res) => {
            console.log("liquidating positions");
            console.log(res)
            p.showLiquidations(res);
        });
        */
    }

    lastBlock(pubN, localN){
        $("#lastBlockPn").text(pubN);
        $("#lastBlockLn").text(localN);
        $("#lastBlock").removeClass();
        if(localN<pubN) $('#lastBlock').addClass('alert alert-danger');
        else $('#lastBlock').addClass('alert alert-success');
    }

    accBalances(liq, roll) {
        let i=1;
        for(let b in liq) {
            $("#balanceL"+i).text(b+": "+liq[b]+ " RBTC");
            $("#accInfoL"+i).removeClass();
            if (liq[b]>0) $('#accInfoL'+i).addClass('alert alert-success');
            else $('#accInfoL'+i).addClass('alert alert-danger');
            i++;
        }
       
        for(let b in roll) {
            $('#balanceR1').text(b+ ": "+roll[b]+" RBTC");
            $("#accInfoR1").removeClass();
            if (roll[b]>0) $('#accInfoR1').addClass('alert alert-success');
            else $('#accInfoR1').addClass('alert alert-danger');
        }
    }


    showOpenPositions(oP) {
        $('#openPosQueue').text(oP);
    }

    showLiquidations(oL) {
        $('#openLiqQueue').text(oL);
    }
}

$(document).ready(function(){
    const m = new Monitor();
    m.start();
});
