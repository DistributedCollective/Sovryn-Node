/**
 * Helper and utilities functions
 */

class Util {
    async wasteTime(s) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, s * 1000);
        });
    }

    parseEventParams(logEvents) {
        const params = {};
        (logEvents || []).forEach(event => {
            params[event.name] = event.value;
        });
        return params;
    }
}


export default new Util();