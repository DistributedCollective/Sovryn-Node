import Telegram from 'telegraf/telegram';
import PosScanner from './scanner';
import U from '../util/helper';
import conf from '../config/config';

class TelegramBot {
    constructor() {
        this.bot = conf.errorBotTelegram ? new Telegram(conf.errorBotTelegram) : null;
    }

    async sendMessage(msg, extra) {
        if (this.bot) {
            try {
                await this.bot.sendMessage(conf.sovrynInternalTelegramId, msg, extra);
            } catch(err) {
                console.log(err)
            }
        }
    }
}

async function getCurrentActivePositions() {
    let positions = {}
    let from = 0;
    let to = conf.nrOfProcessingPositions;
    let posFound=0;

    while (true) {
        const pos = await PosScanner.loadActivePositions(from, to);
        //console.log(pos);
        if (pos && pos.length > 0) {
            console.log(pos.length + " active positions found");
            PosScanner.addPosition(pos);
            from = to;
            to = from + to;
            posFound+=pos.length;
            await U.wasteTime(1);
        }
        //reached current state
        else if(pos && pos.length==0) {
            for (let k in PosScanner.positionsTmp) {
                if (PosScanner.positionsTmp.hasOwnProperty(k)) {
                    positions[k] = PosScanner.positionsTmp[k]; //JSON.parse(JSON.stringify(PosScanner.positionsTmp[k]));
                }
            }

            console.log("Round ended. "+Object.keys(positions).length + " active positions found");
            break;
        }
        //error retrieving pos for this interval
        else {
            console.log("error retrieving pos for this interval. continue")
            from = to;
            to = from + to;
            await U.wasteTime(1);
        }
    }
}

function formatDate(str) {
    const output = new Date(parseInt(str) * 1000).toISOString().slice(0, 19).replace("T", " ");
    return output;
};

export default { 
    telegramBot: new TelegramBot(), 
    getCurrentActivePositions, 
    formatDate 
}
