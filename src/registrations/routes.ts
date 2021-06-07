import path from 'path';
import fetch from 'node-fetch';
import { Espresso } from '../../../../espresso/declarations/core/espresso';
import Hue from '../hue';

declare const espresso: Espresso;

interface AuthError {
    error: {
        type: number;
        address: string;
        description: string;
    };
}

interface AuthSuccess {
    success: {
        username: string;
    };
}

type AuthPayload = (AuthError | AuthSuccess)[];

espresso.server.register({
    path: '/hue',
    method: 'get',
    response: (req, res) => {
        const pluginDirPath = espresso.plugins.getPath('hue');
        if (!pluginDirPath) {
            res.send('error file not found');
            return;
        }

        res.sendFile(path.join(pluginDirPath, 'public', 'dashboard.html'));
    },
});

espresso.server.register({
    path: '/api/hue',
    method: 'get',
    response: (req, res) => {
        const connected = Hue.settings.address !== null && Hue.settings.token !== null;
        res.status(200).json({ connected });
    },
});

espresso.server.register({
    path: '/api/hue/auth',
    method: 'get',
    response: async (req, res) => {
        try {
            // Attempt to find a hue bridge
            const discovery = await fetch('https://discovery.meethue.com/');
            if (!discovery.ok) {
                res.status(500).json({
                    error: "Can't connect to birdge discovery utility.",
                    code: 'discovery_error',
                });
                return;
            }

            // Check if we found at least one IP
            const discoveryJson = (await discovery.json()) as { id: string; internalipaddress: string }[];
            if (!discoveryJson.length) {
                res.status(500).json({
                    error: 'No bridges discovered on your network.',
                    code: 'no_bridge',
                });
                return;
            }

            const authRequst = await fetch(`http://${discoveryJson[0].internalipaddress}/api`, {
                method: 'POST',
                body: JSON.stringify({ devicetype: 'espresso-hue' }),
            });

            const authJson = (await authRequst.json()) as AuthPayload;

            if (!authJson.length) {
                res.status(500).json({
                    error: 'No auth response?.',
                    code: 'no_auth_res',
                });
            }

            const authRes = authJson[0];

            if ('success' in authRes) {
                Hue.authenticate(discoveryJson[0].internalipaddress, authRes.success.username);
                res.status(200).send();
            } else if ('error' in authRes) {
                res.status(500).json({
                    error: authRes.error.description,
                    code: 'auth_fail',
                });
                return;
            }
        } catch (e) {
            console.log(e);
        }

        res.status(500).send();
    },
});

espresso.server.register({
    path: '/api/hue/auth/revoke',
    method: 'post',
    response: async (req, res) => {
        Hue.revoke();
        res.status(200).send();
    },
});
