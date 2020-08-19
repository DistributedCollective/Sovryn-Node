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
}


export default new Util();