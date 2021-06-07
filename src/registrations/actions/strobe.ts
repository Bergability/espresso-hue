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
    onDuration: number;
    offDuration: number;
    flashes: number;
    changeColor: boolean;
    useSingleColor: boolean;
    color: Color | string;
    colors: { color: Color | string }[];
    brightness: number;
    useEndColor: boolean;
    endColor: Color | string;
    setDuration: boolean;
    duration: number;
}

const lightStateSettings: Input<LightStateSettings, { color: Color | string }>[] = [
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
        type: 'title',
        title: 'Flash settings',
        description: ['The settings that control how many times the lights flash, and for how long.'],
    },
    {
        type: 'number',
        key: 'flashes',
        default: 5,
        label: 'Number of flashes',
    },
    {
        type: 'number',
        key: 'onDuration',
        min: 900,
        default: 1000,
        label: 'On duration (in milliseconds)',
    },
    {
        type: 'number',
        key: 'offDuration',
        min: 400,
        default: 1000,
        label: 'Off duration (in milliseconds)',
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
        label: 'Flash lights in a single color?',
        key: 'useSingleColor',
        default: false,
        conditions: [{ value: 'changeColor', operator: 'equal', comparison: true }],
    },
    {
        type: 'color',
        label: 'Light color',
        key: 'color',
        default: '#ff00ff',
        conditions: [
            [
                { value: 'changeColor', operator: 'equal', comparison: true },
                { value: 'useSingleColor', operator: 'equal', comparison: true },
            ],
        ],
    },
    {
        type: 'repeater',
        default: [{ color: '#ff00ff' }],
        key: 'colors',
        label: 'Colors',
        inputs: [
            {
                type: 'color',
                label: 'Light color',
                key: 'color',
                default: '#ff00ff',
            },
        ],
        emptyLabel: 'No colors selected',
        addLabel: 'Add color',
        removeLabel: 'Remove color',
        conditions: [
            [
                { value: 'changeColor', operator: 'equal', comparison: true },
                { value: 'useSingleColor', operator: 'equal', comparison: false },
            ],
        ],
    },
    {
        type: 'toggle',
        label: 'Set specific end color?',
        key: 'useEndColor',
        default: false,
        conditions: [
            [
                { value: 'changeColor', operator: 'equal', comparison: true },
                { value: 'useSingleColor', operator: 'equal', comparison: false },
            ],
        ],
    },
    {
        type: 'color',
        label: 'Light color',
        key: 'endColor',
        default: '#ff00ff',
        conditions: [
            [
                { value: 'changeColor', operator: 'equal', comparison: true },
                { value: 'useEndColor', operator: 'equal', comparison: true },
                { value: 'useSingleColor', operator: 'equal', comparison: false },
            ],
        ],
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
    },
];

espresso.actions.register({
    slug: 'hue:flash-lights',
    name: 'Flash lights',
    catigory: 'Lights',
    provider: 'Philips Hue',
    description: 'Flash one or more lights a set number of times.',
    version: '1.0.0',
    settings: lightStateSettings,
    // @ts-ignore
    run: async (triggerSettings: unknown, actionSettings: LightStateSettings, triggerData: any) => {
        const payload: Payload = {};

        // Set transition
        if (actionSettings.setDuration) payload.transitiontime = actionSettings.duration / 100;

        // Set brightness
        payload.bri = (actionSettings.brightness / 100) * 254;

        const getRequests = (p: Payload) => {
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
                    body: JSON.stringify(p),
                });

                if (request === null) return acc;

                return [...acc, request];
            }, []);

            return requests;
        };

        const sleep = (duration: number) => {
            return new Promise<void>((resovle) => {
                setTimeout(() => {
                    resovle();
                }, duration);
            });
        };

        for (let i = 0; i < actionSettings.flashes; i++) {
            // Get the colors
            if (actionSettings.changeColor) {
                if (actionSettings.useSingleColor) {
                    const color = getColor(actionSettings.color);
                    if (color === null) return;
                    payload.xy = color;
                } else {
                    if (actionSettings.colors.length !== 0) {
                        let raw: Color | string;
                        if (actionSettings.colors[i]) {
                            raw = actionSettings.colors[i].color;
                        } else {
                            let index = i;

                            while (index >= actionSettings.colors.length) {
                                index = index - actionSettings.colors.length;
                            }

                            raw = actionSettings.colors[index].color;
                        }

                        const color = getColor(raw);
                        if (color === null) return;
                        payload.xy = color;
                    }
                }

                if (actionSettings.useEndColor && i === actionSettings.flashes - 1) {
                    const color = getColor(actionSettings.endColor);
                    if (color === null) return;
                    payload.xy = color;
                }
            }

            // Get the off flash requests
            const offRequets = getRequests({ ...payload, bri: 0 });

            try {
                // if (offRequets.length === 0) return false;

                // Send the off flash requets
                const offs = await Promise.all(offRequets);
                // console.log(
                //     offs.reduce<number[]>((acc, res) => {
                //         return [...acc, res.status];
                //     }, [])
                // );

                // Wait the off duration
                await sleep(actionSettings.offDuration);

                const onRequets = getRequests(payload);

                if (onRequets.length === 0) return false;

                // send the on flash requets
                const ons = await Promise.all(onRequets);
                // console.log(
                //     ons.reduce<number[]>((acc, res) => {
                //         return [...acc, res.status];
                //     }, [])
                // );

                // Wait the on flash duration
                await sleep(actionSettings.onDuration);
            } catch (e) {
                console.log(e);
                return false;
            }
        }
    },
});
