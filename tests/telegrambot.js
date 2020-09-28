/**
 * Testing telegram bot api
 */

import c from '../config/config_testnet';
const TelegramBot = require('node-telegram-bot-api');

console.log("start bot "+c.errorBotNodeTelegramToken)
const bot = new TelegramBot(c.errorBotNodeTelegramToken, {polling: true});

bot.on('message', (msg) => {
  console.log(msg);
});

bot.sendMessage(conf.sovrynInternalTelegramId, "hello");