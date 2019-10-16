
import axios from 'axios';
import * as t from 'io-ts';
import { Loadable } from '@mkrause/lifecycle-loader';

import RestApi from './loader/RestApi.js';


//const x : never = Loadable({ x: 42 });


const User = t.type({
    name: t.string,
});


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
