import readline from 'readline';
import fs from 'fs';

import { Provider } from "@ethersproject/abstract-provider";
import { Wallet, utils as ethersUtils } from 'ethers';

export const addressType: any = {
    name: 'address',
    parse: (argName: string, strValue: string) => strValue,
    validate(argName: string, argumentValue: any) {
        if (!ethersUtils.isAddress(argumentValue)) {
            throw new Error(`${argName} must be address, got ${argumentValue}`);
        }
    },
}

export  async function promptPassword(prompt: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        //no output, don't show password
        //output: fs.createWriteStream('/dev/null'),
        terminal: true,
    });
    console.log(`${prompt} (output is silenced)`);
    const it = rl[Symbol.asyncIterator]();
    const ret = await it.next();
    await rl.close();
    if (ret.value === undefined) {
        throw new Error('password prompt cancelled');
    }
    return ret.value;
}

export async function loadAccountFromKeystorePath(path: string, provider?: Provider): Promise<Wallet> {
    if (!fs.existsSync(path)) {
        throw new Error(`Keystore path ${path} doesn't exist`);
    }
    const keystoreRaw = fs.readFileSync(path, 'utf-8');
    const password = await promptPassword('Enter keystore password');
    console.log('Decrypting keystore file...');
    let wallet = await Wallet.fromEncryptedJson(keystoreRaw, password);
    if (provider) {
        wallet = wallet.connect(provider);
    }
    return wallet;
}

export async function loadAccountFromKeystoreOrPrivateKeyPath(
    keyStorePath?: string | null,
    privateKeyPath?: string | null,
    provider?: Provider
): Promise<Wallet> {
    if(keyStorePath && privateKeyPath) {
        throw new Error('provide either keystore path or private key path, not both');
    }
    if(!keyStorePath && !privateKeyPath) {
        throw new Error('provide either keystore path or private key path');
    }
    if (keyStorePath) {
        return await loadAccountFromKeystorePath(keyStorePath, provider);
    }
    if (privateKeyPath) {
        if (!fs.existsSync(privateKeyPath)) {
            throw new Error(`Private key path ${privateKeyPath} doesn't exist`);
        }
        const privateKey = fs.readFileSync(privateKeyPath, 'utf-8').trim();
        return new Wallet(privateKey, provider);
    }
    throw new Error('should not get here');
}
