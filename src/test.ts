
require('util').inspect.defaultOptions.depth = Infinity;

import { either } from 'fp-ts';
import * as t from 'io-ts';

import ItemResource from './loader/ItemResource.js';
import CollectionResource from './loader/CollectionResource.js';


const testContext = {
    options : {},
    path : [],
    uri : '',
    store : [],
    agent : null as any,
};
const api = ItemResource(t.string, {
    methods: {
        foo() { return 42 as const; }
    },
    resources: {
        item: ItemResource(t.string, {
            methods: {
                foo() { return 43 as const; }
            },
            resources: {},
        }),
        coll: CollectionResource(t.string, {
            methods: {
                foo() { return 44 as const; }
            },
            resources: {},
            entry: CollectionResource(t.string, {
                methods: {
                    foo() { return 45 as const; }
                },
                resources: {},
            }),
        }),
    },
})(testContext);

//const test0 : null = { ...api };
const test1 : 42 = api.foo();
const test2 : 43 = api.item.foo();
const test3 : 44 = api.coll.foo();
const test4 : 45 = api.coll('user42').foo();






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
