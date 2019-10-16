
import axios from 'axios';
import { Loadable } from '@mkrause/lifecycle-loader';

import RestApi from './loader/RestApi.js';


//const x : never = Loadable({ x: 42 });

const agent = axios.create();

const spec = RestApi.Item({
    methods: {
        foo({ spec }) { return 42 as const; },
    },
});


const usersApi = RestApi.Collection({
    entry: RestApi.Item({
        methods: {
            getName() { return 'John' as const; },
        },
    }),
});

const api = RestApi(agent, RestApi.Item({
    methods: {
        getVersion({ spec }) { return 1 as const; },
    },
    resources: {
        config: RestApi.Item({
            methods: { getConfig() { return 'config' as const; } }
        }),
        users: usersApi,
    },
}));

const test1 : 1 = api.getVersion();
const test2 = api.config.get();
const test3 = api.config.getConfig();
const test4 = api.users('user1').getName();
