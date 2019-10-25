
import axios from 'axios';
// import * as t from 'io-ts';
// import Fp, { either } from 'fp-ts';
import { Loadable } from '@mkrause/lifecycle-loader';

//import RestApi from './loader/RestApi.js';


//const x : never = Loadable({ x: 42 });

/*
const agent = axios.create();

const spec = RestApi.Item(null, {
    methods: {
        foo({ spec }) { return 42 as const; },
    },
});


const usersApi = RestApi.Collection(null, {
    entry: RestApi.Item(User, {
        methods: {
            getName() { return 'John' as const; },
        },
    }),
});

const api = RestApi(agent, RestApi.Item(null, {
    methods: {
        getVersion({ spec }) { return 1 as const; },
    },
    resources: {
        config: RestApi.Item(null, {
            methods: { getConfig() { return 'config' as const; } }
        }),
        users: usersApi,
    },
}));

const test1 = api.getVersion();
const test2 = api.config.get();
const test3 = api.config.getConfig();
const test4 = api.users('user1').getName();
*/

/*
console.log('hello');


const string = new t.Type<string, string, unknown>(
  'string',
  (input: unknown): input is string => typeof input === 'string',
  // `t.success` and `t.failure` are helpers used to build `Either` instances
  (input, context) => (typeof input === 'string' ? t.success(input) : t.failure(input, context)),
  // `A` and `O` are the same, so `encode` is just the identity function
  t.identity
);

const User = t.type({
    name: t.string,
});
*/








require('util').inspect.defaultOptions.depth = Infinity;

import { either } from 'fp-ts';
import * as t from 'io-ts';

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
