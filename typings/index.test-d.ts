
import { expectType, expectError } from 'tsd';

import * as t from 'io-ts';

import ItemResource from '../src/loader/ItemResource.js';
import CollectionResource from '../src/loader/CollectionResource.js';

const contextRoot = {
    options : {},
    path : [],
    uri : '',
    store : [],
    agent : null as any,
};

// Test type generation
{
    const resource = ItemResource(t.unknown, {
        methods: {
            foo() { return 42 as const; }
        },
        resources: {
            item: ItemResource(t.unknown, {
                methods: {
                    foo() { return 43 as const; }
                },
                resources: {},
            }),
            coll: CollectionResource(t.unknown, {
                methods: {
                    foo() { return 44 as const; }
                },
                resources: {},
                entry: CollectionResource(t.unknown, {
                    methods: {
                        foo() { return 45 as const; }
                    },
                    resources: {},
                }),
            }),
        },
    })(contextRoot);

    expectType<42>(resource.foo());
    expectType<43>(resource.item.foo());
    expectType<44>(resource.coll.foo());
    expectType<45>(resource.coll('user42').foo());
};

// Test integration with schemas
{
    const User = t.type({ name: t.string });
    type User = t.TypeOf<typeof User>;
    
    const resource1 = ItemResource(User, {
        methods: {},
        resources: {},
    })(contextRoot);
    
    expectType<Promise<User>>(resource1.get());
    
    
    const UserMap = t.record(t.string, User);
    type UserMap = t.TypeOf<typeof UserMap>;
    
    const resource2 = CollectionResource(UserMap, {
        methods: {},
        resources: {},
        entry: ItemResource(User),
    })(contextRoot);
    
    expectType<Promise<UserMap>>(resource2.list());
};
