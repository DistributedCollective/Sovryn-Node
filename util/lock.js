import { Mutex } from 'async-mutex';

class Lock {
    constructor () {
        this._mutexes = {};
    }

    async acquire(key, tag) {
        // console.log(tag, 'acquiring key', key);
        let mutex;
        if (this.checkNewKey(key, tag)) {
            // console.log(tag, 'using old mutex');
            mutex = this._mutexes[key];
        } else {
            mutex = new Mutex();
            this._mutexes[key] = mutex;
        }

        const release = await mutex.acquire();
        return () => {
            try {
                // console.log(tag, 'release key', key, mutex.isLocked());
                release();
            } catch(e) {
                console.log(e);
            }
        };
    }

    checkNewKey(key, tag) {
        if (!this._mutexes[key]) return false;

        if (!this._mutexes[key].isLocked()) {
            // console.log(tag, 'mutex of key unlocked', key);
            delete this._mutexes[key];
            return false;
        }
        return true;
    }
}

export default new Lock();


// const wait = async(mil) => new Promise(resolve => setTimeout(resolve, mil));
// const lock = new Lock();
// async function test(delay) {
//     const key = 'test_lock';
//     console.log('#testing lock with delay: ', delay);

//     const release0 = await lock.acquire(key, delay);
//     setTimeout(release0, delay);
// }

// const _old = console.log;
// console.log = (...args) => _old(new Date(), ":", ...args);

// (async () => {
//     test(5000);

//     // await wait(200);
//     // test(2000);

//     // await wait(1000);
//     // test(800);
//     // test(1800);
    
//     // await wait(4000);
//     // test(1000);

//     await wait(4000);
//     console.log(lock._mutexes['test_lock'].isLocked())
//     await wait(2000);
//     // console.log(lock._mutexes);
//     console.log(lock._mutexes['test_lock'].isLocked())
//     test(1000);
// })();
