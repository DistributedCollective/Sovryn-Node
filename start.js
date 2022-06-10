/**
 * Sovryn Node
*/
const express= require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

import mainController from './controller/main';
import conf from './config/config';

const _oldConsole = console;

global.console = {
    ..._oldConsole,
    log: (...args) => {
        _oldConsole.log(`${new Date().toISOString()}:: `, ...args);
    },
    error: (...args) => {
        _oldConsole.error(`${new Date().toISOString()}:: `, ...args);
    },
}


       
app.use('/', express.static('public/dist'));
http.listen(conf.serverPort, () => {
    console.log('listening on *:'+conf.serverPort);
});

console.log("Hola. Starting the app on "+process.argv[2]);
mainController.start(io);


