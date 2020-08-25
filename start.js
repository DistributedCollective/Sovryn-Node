/**
 * Sovryn Liquidation watcher
*/
const express= require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

import cTest from './config/config_testnet';
import cMain from './config/config_mainnet';
if(process.argv[2]=="mainnet") global.conf=cMain;
else global.conf=cTest;


const monitor = require('./monitor/index.js');
monitor({
    name: 'liquidation-watcher',
    port: conf.serverPort+1
});

import mainController from './controller/main';

console.log("Hola. It is "+new Date(Date.now())+ ". Starting the app on "+process.argv[2]);
       
app.use('/', express.static('public/dist'));

app.use('/monitor', express.static('monitor/webUI'));


http.listen(conf.serverPort, () => {
    console.log('listening on *:'+conf.serverPort);
});

mainController.start(io);

