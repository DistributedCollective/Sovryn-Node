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
        let p=this;

        socket.emit("getSignals", (res) => {
            console.log("response signals");
            console.log(res);

            p.lastBlock(res.blockInfoPn, res.blockInfoLn);
            p.accBalances(res.accountInfoLiq, res.accountInfoRoll, res.accountInfoArb, res.accountInfoFbr, res.accountInfoOg);
            p.showOpenPositions(res.positionInfo);
            p.showLiquidations(res.liqInfo);
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

    accBalances(liq, roll, arb, fbr, og) {
        let i=1;
        const threshold = 0.002;
        
        for(let b in liq) {
            $("#balanceL"+i).text(b+": "+liq[b]+ " RBTC");
            $("#accInfoL"+i).removeClass();
            if (liq[b]>threshold) $('#accInfoL'+i).addClass('alert alert-success');
            else $('#accInfoL'+i).addClass('alert alert-danger');
            i++;
        }
       
        for(let b in roll) {
            $('#balanceR1').text(b+ ": "+roll[b]+" RBTC");
            $("#accInfoR1").removeClass();
            if (roll[b]>threshold) $('#accInfoR1').addClass('alert alert-success');
            else $('#accInfoR1').addClass('alert alert-danger');
        }

        for(let b in arb) {
            $('#balanceAr1').text(b+ ": "+arb[b]+" RBTC");
            $("#accInfoAr1").removeClass();
            if (arb[b]>threshold) $('#accInfoAr1').addClass('alert alert-success');
            else $('#accInfoAr1').addClass('alert alert-danger');
        }

        for(let b in fbr) {
            $('#balanceFbr').text(b+ ": "+fbr[b]+" RBTC");
            $("#accInfoFbr").removeClass();
            if (fbr[b]>0.01) $('#accInfoFbr').addClass('alert alert-success');
            else $('#accInfoFbr').addClass('alert alert-danger');
        }

        for(let b in og) {
            $('#balanceOg').text(b+ ": "+og[b]+" RBTC");
            $("#accInfoOg").removeClass();
            if (og[b]>threshold) $('#accInfoOg').addClass('alert alert-success');
            else $('#accInfoOg').addClass('alert alert-danger');
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
