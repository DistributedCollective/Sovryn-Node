import c from '../config/config_testnet';
global.conf = c;

const { Bot, Polling } = require('api-telegram-bot');

const telegramBotNode = new Bot(conf.errorBotNodeTelegramToken);
const polling = new Polling(telegramBotNode);
console.log("start bot "+conf.errorBotNodeTelegramToken)

/*
telegramBotNode.on('message', (msg) => {

    console.log("new msg received");
    console.log(msg);

});*/

// subscribe to all message types (texts, photos, videos, and others)
telegramBotNode.messages().subscribe(data => {
    // data is a object with 2 props:
    //   data.update - is the update received,
    //   data.actions - actions object with some helper functions
    // log to see what it is:
    console.log(data);
  });

//p.telegramBotNode.sendMessage({ chat_id: -1001216925293, text: user + " joined the game" });