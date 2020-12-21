/**
 * Testing telegram bot api
 */

import c from '../config/config';
const Telegram = require('telegraf/telegram');

console.log("start bot "+c.errorBotTelegram)
const bot = new Telegram(c.errorBotTelegram);


bot.sendMessage(c.sovrynInternalTelegramId, "hello");