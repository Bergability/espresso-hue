import { Response } from 'node-fetch';
import { Espresso } from '../../../../../espresso/declarations/core/espresso';
import { Input, Color } from '../../../../../espresso/declarations/typings/inputs';
import Hue from '../../hue';
import calcXY from '../../color';

declare const espresso: Espresso;

interface Payload {
    xy?: [number, number];
    on?: boolean;
    bri?: number;
    transitiontime?: number;
    effect?: 'none' | 'colorloop';
    alert?: 'none' | 'select' | 'lselect';
}

const getColor = (color: string | Color): [number, number] | null => {
    const raw = espresso.utilities.getColorValue(color);
    if (raw === null) return null;
    return calcXY(...raw.rgb);
};

interface LightStateSettings {
    lights: string[];
    on: boolean;
    setDuration: boolean;
    duration: number;
    changeColor: boolean;
    useColorPicker: boolean;
    colorPicker: string | Color;
    colorText: string;
    setBrightness: boolean;
    brightness: number;
}

const lightStateSettings: Input<LightStateSettings>[] = [
    {
        type: 'title',
        title: 'Lights',
        description: ['Select the light(s) or groups that you would like to change the state of.'],
    },
    {
        type: 'select',
        label: 'Lights',
        options: 'hue:lights-and-groups',
        default: [],
        multiple: true,
        key: 'lights',
    },
    {
        type: 'toggle',
        label: 'Turn lights on?',
        key: 'on',
        default: true,
    },
    {
        type: 'title',
        title: 'Color',
        description: ['Set the color of the ligths using either a color picker or a text field to add dynamic color changing.'],
    },
    {
        type: 'toggle',
        label: 'Change the color of the selected light(s).',
        key: 'changeColor',
        default: false,
    },

    {
        type: 'toggle',
        label: 'Use color picker?',
        key: 'useColorPicker',
        default: false,
        conditions: [[{ value: 'changeColor', operator: 'equal', comparison: true }]],
    },
    {
        type: 'color',
        label: 'Light color',
        key: 'colorPicker',
        default: '#ff00ff',
        conditions: [
            [
                { value: 'changeColor', operator: 'equal', comparison: true },
                { value: 'useColorPicker', operator: 'equal', comparison: true },
            ],
        ],
    },
    {
        type: 'text',
        label: 'Light color',
        key: 'colorText',
        default: '#ff00ff',
        conditions: [
            [
                { value: 'changeColor', operator: 'equal', comparison: true },
                { value: 'useColorPicker', operator: 'equal', comparison: false },
            ],
        ],
    },
    {
        type: 'title',
        title: 'Transition',
        description: ['The transition is the speed that the lights change from the previous state to the new state.'],
    },
    {
        type: 'toggle',
        label: 'Set transition duration?',
        key: 'setDuration',
        default: false,
    },
    {
        type: 'slider',
        label: 'Transition duration (in milliseconds)',
        helper: 'Transition works best when changing the light color. It DOES NOT work when turning the light on.',
        key: 'duration',
        default: 400,
        min: 0,
        max: 10000,
        step: 100,
        minLabel: '0ms',
        maxLabel: '10000ms',
        conditions: [{ value: 'setDuration', operator: 'equal', comparison: true }],
    },
    {
        type: 'title',
        title: 'Brightness',
        description: ['Change the brightness of of the lights.'],
    },
    {
        type: 'toggle',
        label: 'Set brightness?',
        key: 'setBrightness',
        default: false,
    },
    {
        type: 'slider',
        label: 'Brightness',
        key: 'brightness',
        default: 50,
        min: 0,
        max: 100,
        step: 1,
        minLabel: '0%',
        maxLabel: '100%',
        helper: 'Setting the brightness to "0" does not turn the lights off.',
        conditions: [{ value: 'setBrightness', operator: 'equal', comparison: true }],
    },
];

espresso.actions.register({
    slug: 'hue:set-light-state',
    name: 'Set light state',
    catigory: 'Lights',
    provider: 'Philips Hue',
    description: 'Change the state of a light or multiple lights.',
    version: '1.0.0',
    settings: lightStateSettings,
    // @ts-ignore
    run: async (triggerSettings: unknown, actionSettings: LightStateSettings, triggerData: any) => {
        const payload: Payload = {
            on: actionSettings.on,
        };

        // Set color
        if (actionSettings.changeColor) {
            if (actionSettings.useColorPicker) {
                const color = getColor(actionSettings.colorPicker);
                if (color === null) return;
                payload.xy = color;
            } else {
                const color = getColor(espresso.parseVariables(actionSettings.colorText, triggerData));

                if (color === null) return;
                payload.xy = color;
            }
        }

        // Set transition
        if (actionSettings.setDuration) payload.transitiontime = actionSettings.duration / 100;

        // Set brightness
        if (actionSettings.setBrightness) payload.bri = (actionSettings.brightness / 100) * 254;

        const requests = actionSettings.lights.reduce<Promise<Response>[]>((acc, light) => {
            const split = light.split(':');

            // If the string does not split into two parts this is likely an error
            if (split.length !== 2) return acc;

            let url: string = '';

            switch (split[0]) {
                case 'group':
                    url = `/groups/${split[1]}/action`;
                    break;
                case 'light':
                    url = `/lights/${split[1]}/state`;
                    break;
            }

            if (url === '') return acc;

            const request = Hue.fetch(url, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });

            if (request === null) return acc;

            return [...acc, request];
        }, []);

        try {
            const responses = await Promise.all(requests);
            // TODO check https status
            // responses.forEach((res) => {
            //     console.log(res.status);
            // });

            return true;
        } catch (e) {
            console.log(e);
            return false;
        }
    },
});
