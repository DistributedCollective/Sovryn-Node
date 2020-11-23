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
            const name = event.name.replace('_', '');
            params[name] = event.value;
        });
        return params;
    }
}


export default new Util();