import { Espresso } from '../../../../espresso/declarations/core/espresso';
import { Option } from '../../../../espresso/declarations/typings/inputs';
import Hue from '../hue';
import { Light } from '../types/hue';

declare const espresso: Espresso;

espresso.options.register({
    slug: 'hue:lights-and-groups',
    get: async () => {
        try {
            const lightRequest = Hue.fetch('/lights');
            const groupRequest = Hue.fetch('/groups');
            if (lightRequest === null || groupRequest === null) return [];

            const lightRes = await lightRequest;
            const groupRes = await groupRequest;

            const lightJson = (await lightRes.json()) as { [key: string]: Light };
            const groupJson = (await groupRes.json()) as { [key: string]: Light };

            const lights = Object.entries(lightJson).reduce<Option[]>((acc, [id, light]) => {
                return [...acc, { text: light.name, value: `light:${id}`, catigory: 'Lights' }];
            }, []);

            const groups = Object.entries(groupJson).reduce<Option[]>((acc, [id, light]) => {
                return [...acc, { text: light.name, value: `group:${id}`, catigory: 'Groups' }];
            }, []);

            return [...lights, ...groups];
        } catch (e) {
            console.log(e);
            return [];
        }
    },
});
