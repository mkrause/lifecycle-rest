
require('util').inspect.defaultOptions.depth = Infinity;

import { either } from 'fp-ts';
import * as t from 'io-ts';

import ItemResource from './loader/ItemResource.js';


const testContext = {
    options : {},
    path : [],
    uri : '',
    store : [],
    agent : null as any,
};
const test = ItemResource(t.string, {
    methods: {
        foo() { return 42 as const; }
    },
    resources: {
        res: ItemResource(t.string, {
            methods: {
                foo() { return 43 as const; }
            },
            resources: {
                
            },
        }),
    },
    entry: ItemResource(t.string, {
        methods: {
            foo() { return 44 as const; }
        },
        resources: {
            
        },
    }),
})(testContext);

//const x1 : never = test('user42').foo();







/*
type User = { name : string, score : number };

const UserDecoder : t.Decoder<unknown, User> = {
    name: 'UserDecoder',
    validate(input : unknown, context : t.Context) : t.Validation<User> {
        // return either.right({ name: 'John', score: 42 });
        return either.left([
            { value: 'x', context, message: 'foo' },
        ]);
    },
    decode(input : unknown) : t.Validation<User> {
        return this.validate(input, [{ key: '', type: UserDecoder, actual: input }]);
    },
};

const john = UserDecoder.decode({ name: 'John' });

console.log(t.string.decode(42));
console.log('result', john);

console.log(t.type({ x: t.type({ y: t.string }), a: t.string }).decode({ x: { y: 5 }, a: 7 }));
*/
