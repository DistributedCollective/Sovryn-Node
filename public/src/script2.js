var socket = io();


setInterval(()=> {
    socket.emit('getBlock', (res)=> {
        console.log("current block is");
        console.log(res);
        $('#block').text(res);
    });

}, 30000);