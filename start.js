/**
 * Sovryn Watcher: liquidating/rollover active positions
*/
const express= require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

import mainController from './controller/main';
import cTest from './config/config_testnet';
import cMain from './config/config_mainnet';
let conf = process.argv[2]=="mainnet"?cMain:cTest;

const monitor = require('pm2-server-monitor');
monitor({
    name: conf.network,
    port: conf.healthMonitorPort
});

console.log("Hola. It is "+new Date(Date.now())+ ". Starting the app on "+process.argv[2]);
       
app.use('/', express.static('public/dist'));
http.listen(conf.serverPort, () => {
    console.log('listening on *:'+conf.serverPort);
});

mainController.start(conf, io);


