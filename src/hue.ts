import fetch, { RequestInit } from 'node-fetch';
import { Espresso } from '../../../espresso/declarations/core/espresso';

declare const espresso: Espresso;

interface Settings {
    token: string | null;
    address: string | null;
    version: string;
}

// TODO verify connection to hue
class EspressoHue {
    public settings: Settings;

    constructor() {
        let settings = espresso.store.get('hue') as Settings | undefined;

        if (settings === undefined) {
            settings = this.setDefaultSettings();
        }

        this.settings = settings;
    }

    private setDefaultSettings() {
        const defaultSettings: Settings = {
            token: null,
            address: null,
            version: '1.0.0',
        };
        espresso.store.set('hue', defaultSettings);
        return defaultSettings;
    }

    public authenticate(ip: string, token: string) {
        const tokenId = espresso.tokens.set(token);

        espresso.store.set('hue.address', ip);
        espresso.store.set('hue.token', tokenId);
        this.settings.token = tokenId;
        this.settings.address = ip;
    }

    public revoke() {
        espresso.tokens.delete(espresso.store.get('hue.token'));
        espresso.store.set('hue.address', null);
        espresso.store.set('hue.token', null);
        this.settings.token = null;
        this.settings.address = null;
    }

    public fetch(path: string, body?: RequestInit) {
        // Check if hue is authenticated
        if (this.settings.address === null || this.settings.token === null) return null;

        // Create the API url
        const url = `http://${this.settings.address}/api/${espresso.tokens.get(this.settings.token)}${path}`;

        // Return the request
        return fetch(url, body);
    }
}

const hue = new EspressoHue();
export default hue;
