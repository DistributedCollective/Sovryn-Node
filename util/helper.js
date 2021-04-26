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

    formatLoanId(loanId, length = 4) {
        return loanId.slice(0, length) + `…` + loanId.slice(-1 * length);
    }
}


export default new Util();