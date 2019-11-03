
import { expectType, expectError } from 'tsd';

import ItemResource from '../src/loader/ItemResource.js';
import CollectionResource from '../src/loader/CollectionResource.js';


const Any = null as any;

const testContext = {
    options : {},
    path : [],
    uri : '',
    store : [],
    agent : null as any,
};
const api = ItemResource(Any, {
    methods: {
        foo() { return 42 as const; }
    },
    resources: {
        item: ItemResource(Any, {
            methods: {
                foo() { return 43 as const; }
            },
            resources: {},
        }),
        coll: CollectionResource(Any, {
            methods: {
                foo() { return 44 as const; }
            },
            resources: {},
            entry: CollectionResource(Any, {
                methods: {
                    foo() { return 45 as const; }
                },
                resources: {},
            }),
        }),
    },
})(testContext);

expectType<42>(api.foo());
expectType<43>(api.item.foo());
expectType<44>(api.coll.foo());
expectType<45>(api.coll('user42').foo());
