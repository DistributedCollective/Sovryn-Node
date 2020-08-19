/**
 * Sovryn Liquidation watcher
*/
const express= require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

import cTest from './config/config_testnet';
import cMain from './config/config_mainnet';
if(process.argv[2]=="mainnet") global.c=cMain;
else global.c=cTest;

import mainController from './controller/main';

console.log("Hola. It is "+new Date(Date.now())+ ". Starting the app on "+process.argv[2]);
       
app.use(express.static('public/dist'));

http.listen(c.serverPort, () => {
    console.log('listening on *:'+c.serverPort);
});

mainController.start(io);

