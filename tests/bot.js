import c from '../config/config_testnet';
global.conf = c;

const TelegramBot = require('node-telegram-bot-api');

console.log("start bot "+conf.errorBotNodeTelegramToken)
const bot = new TelegramBot(conf.errorBotNodeTelegramToken, {polling: true});

bot.on('message', (msg) => {
  console.log(msg);
  //type other code here
});

bot.sendMessage(conf.sovrynInternalTelegramId, "hello");