
/*
//not working, but used by web3:
//var WebSocketClient = require('websocket').w3cwebsocket;
var client = new WebSocketClient('wss:18.138.223.132:443', {
    tlsOptions: {
            rejectUnauthorized: false
    }
});


*/
var WebSocketClient = require('websocket').client;


var client = new WebSocketClient({
    tlsOptions: {
            rejectUnauthorized: false
    }
});


client.connect('wss://18.138.223.132:443/');

 
client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
});
 
client.on('connect', function(connection) {
    console.log('WebSocket Client Connected');
    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function() {
        console.log('echo-protocol Connection Closed');
    });
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log("Received: '" + message.utf8Data + "'");
        }
    });
    
    function getBlockNumber() {

       // --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

        if (connection.connected) {
            var data= {
                    jsonrpc: "2.0",
                    method: "eth_blockNumber",
                    params: [],
                    id: 1
                };
            
            connection.sendUTF(JSON.stringify(data));
            setTimeout(getBlockNumber, 1000);
        }
    }
    getBlockNumber();
});
 


/*
//for w3cwebsocket
client.onerror = function() {
    console.log('Connection Error');
};

client.onopen = function() {
    console.log('WebSocket Client Connected');

    function sendNumber() {
        if (client.readyState === client.OPEN) {
            var number = Math.round(Math.random() * 0xFFFFFF);
            client.send(number.toString());
            setTimeout(sendNumber, 1000);
        }
    }
    sendNumber();
};

client.onclose = function() {
    console.log('echo-protocol Client Closed');
};

client.onmessage = function(e) {
    if (typeof e.data === 'string') {
        console.log("Received: '" + e.data + "'");
    }
};


*/
