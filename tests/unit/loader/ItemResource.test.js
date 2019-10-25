
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiMatchPattern from 'chai-match-pattern';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import * as t from 'io-ts';

import { status, Loadable } from '@mkrause/lifecycle-loader';

import createAgent from '../../../lib-esm/agent.js';
// import StorablePromise from '../../../lib-esm/loader/StorablePromise.js';
// import { SimpleItem } from '../../../lib-esm/loader/Resource.js';
import { Identity } from '../../../lib-esm/schema/Schema.js';
import agentMock from '../../resources/agent_mock.js';

import ItemResource, { DecodeError, contextKey } from '../../../lib-esm/loader/ItemResource.js';


require('util').inspect.defaultOptions.depth = Infinity;

chai.use(chaiAsPromised);
chai.use(chaiMatchPattern);

describe('ItemResource', () => {
    const context = {
        agent: createAgent({
            adapter: async request => { throw new Error(`Not supported`); },
        }),
        options: {},
        path: [],
        store: [],
        uri: '',
    };
    
    it('should have sensible defaults', () => {
        const api = ItemResource(Identity)(context);
        
        expect(api).property(contextKey).nested.property('spec.store').to.deep.equal([]);
        expect(api).property(contextKey).nested.property('spec.uri').to.deep.equal('');
    });
    
    it('should allow customization', () => {
        const api = ItemResource(Identity, {
            store: ['foo', 'bar'],
            uri: 'x/y',
        })(context);
        
        expect(api).property(contextKey).nested.property('spec.store').to.deep.equal(['foo', 'bar']);
        expect(api).property(contextKey).nested.property('spec.uri').to.equal('x/y');
    });
    
    it('should allow definition of methods', () => {
        const methodMock = sinon.stub().callsFake(name => `Hello ${name}`);
        
        const api = ItemResource(Identity, {
            store: ['foo', 'bar'],
            uri: 'x/y',
            methods: {
                greet: methodMock,
            },
        })(context);
        
        expect(api).to.have.property('greet');
        
        const result = api.greet('Alice');
        
        expect(result).to.equal('Hello Alice');
        
        sinon.assert.calledOnce(methodMock);
        
        // TODO
        // sinon.assert.calledOn(methodMock, api._spec); // `this` should be the spec
        // sinon.assert.calledWith(methodMock, sinon.match.object, sinon.match('Alice'));
        // sinon.assert.calledWith(methodMock, sinon.match.has('context', sinon.match(context)));
        // sinon.assert.calledWith(methodMock, sinon.match.has('agent', sinon.match.same(context.agent)));
        // sinon.assert.calledWith(methodMock, sinon.match.has('schema', sinon.match.same(Identity)));
        // sinon.assert.calledWith(methodMock, sinon.match.has('spec', sinon.match({
        //     store: ['foo', 'bar'],
        //     uri: 'x/y',
        // })));
        sinon.assert.calledWith(methodMock, 'Alice');
    });
    
    it('should allow definition of subresources', () => {
        const api = ItemResource(Identity, {
            store: ['foo', 'bar'],
            uri: 'x/y',
            resources: {
                baz: ItemResource(Identity),
            },
        })(context);
        
        expect(api).to.have.property('baz');
        
        expect(api.baz).property(contextKey).nested.property('spec.store').to.deep.equal(['foo', 'bar', 'baz']);
        expect(api.baz).property(contextKey).nested.property('spec.uri').to.equal('x/y/baz');
    });
    
    it('should use relative behavior by default for subresources', () => {
        const api = ItemResource(Identity, {
            store: ['foo', 'bar'],
            uri: 'x/y',
            resources: {
                baz: ItemResource(Identity, {
                    store: ['baz'],
                    uri: 'z',
                }),
            },
        })(context);
        
        expect(api).to.have.property('baz');
        
        expect(api.baz).property(contextKey).nested.property('spec.store').to.deep.equal(['foo', 'bar', 'baz']);
        expect(api.baz).property(contextKey).nested.property('spec.uri').to.equal('x/y/z');
    });
    
    
    const contextWithAgent = {
        agent: agentMock,
        options: {},
        path: [],
        store: [],
        uri: '',
    };
    
    describe('without schema', () => {
        // Test
        
        const apiStandard = ItemResource(Identity, {
            uri: '/api',
            resources: {
                users: ItemResource(Identity, {
                    resources: {
                        alice: ItemResource(Identity),
                    },
                }),
            },
        })(contextWithAgent);
        
        describe('method `get`', () => {
            it('should be supported as default method', async () => {
                const api = ItemResource(Identity, {
                    uri: '/api',
                    resources: {
                        greet: ItemResource(Identity, {
                            uri: 'greet',
                        }),
                    },
                })(contextWithAgent);
                
                const result1 = await api.get();
                expect(result1).to.deep.equal({ version: 42 });
                
                // Should be able to pass query parameters
                const result2 = await api.greet.get({ name: 'Alice' });
                expect(result2).to.equal('Hello Alice');
            });
        });
        
        describe('method `put`', () => {
            it('should be supported as default method', async () => {
                const userUpdated = await apiStandard.users['alice'].put({
                    name: 'Alice!',
                });
                
                expect(userUpdated).to.deep.equal({
                    name: 'Alice!',
                });
            });
        });
        
        describe('method `patch`', () => {
            it('should be supported as default method', async () => {
                const userUpdated = await apiStandard.users['alice'].patch({
                    name: 'Alice!',
                });
                
                expect(userUpdated).to.deep.equal({
                    name: 'Alice!',
                });
            });
        });
        
        describe('method `delete`', () => {
            it('should be supported as default method', async () => {
                const result = await apiStandard.users['alice'].delete();
                
                expect(result).to.equal(undefined);
            });
        });
        
        describe('method `post`', () => {
            it('should be supported as default method', async () => {
                const promise = apiStandard.users['alice'].post();
                
                await expect(promise).to.be.rejectedWith(Error, /request failed with status code 409/i);
            });
        });
    });
    
    describe('with schema', () => {
        const ApiVersionSchema = new t.Type(
            'ApiVersion',
            instance => Object.prototype.hasOwnProperty.call(instance, '$test'),
            (instanceEncoded, context) => {
                if (typeof instanceEncoded !== 'object' || instanceEncoded === null) {
                    return t.failure(instanceEncoded, context, 'Expected an object');
                } else if (!Object.prototype.hasOwnProperty.call(instanceEncoded, 'version')) {
                    return t.failure(instanceEncoded, context, 'Missing property `version`');
                } else if (typeof instanceEncoded.version !== 'number') {
                    return t.failure(instanceEncoded, context, 'Expected `version` to be a number');
                } else {
                    return t.success({ $test: instanceEncoded });
                }
            },
            instance => instance.$test,
        );
        
        const UserSchema = t.type({
            name: t.string,
        });
        
        const UserKey = t.string;
        const UsersListSchema = t.array(t.intersection([t.type({ id: UserKey }), UserSchema]));
        const UsersMapSchema = t.record(t.string, UserSchema);
        
        const api = ItemResource(ApiVersionSchema, {
            uri: '/api',
            resources: {
                users: ItemResource(UsersMapSchema, {
                    resources: {
                        alice: ItemResource(UserSchema),
                    },
                }),
                usersAsList: ItemResource(UsersListSchema, {
                    uri: 'users',
                    resources: {
                        alice: ItemResource(UserSchema),
                    },
                }),
            },
        })(contextWithAgent);
        
        describe('method `get`', () => {
            it('should decode the response using the given schema (schema: custom)', async () => {
                // Test successful decode
                const result1 = await api.get();
                expect(result1).to.deep.equal({ $test: { version: 42 } });
                
                // Test failed decode
                await expect(api.get({ bug: 'number-as-string' }))
                    .to.be.rejectedWith(DecodeError, /failed to decode/i);
                
                try {
                    await api.get({ bug: 'number-as-string' });
                    assert(false);
                } catch (e) {
                    expect(e).to.be.instanceOf(DecodeError);
                    // TODO: check the error report
                }
            });
            
            it('should decode the response using the given schema (schema: item)', async () => {
                // Test successful decode
                const result1 = await api.users['alice'].get();
                expect(result1).to.deep.equal({ name: 'Alice' });
                
                // Test failed decode
                expect(
                    await expect(api.users['alice'].get({ bug: 'wrong-type' }))
                        .to.be.rejectedWith(DecodeError, /failed to decode/i)
                ).to.have.property('errors').to.matchPattern(`[{ value: 'string', ... }]`);
                // await expect(api.users['alice'].get({ bug: 'extra-properties' }))
                //     .to.be.rejectedWith(DecodeError, /failed to decode/i);
            });
            
            it('should decode the response using the given schema (schema: collection)', async () => {
                // Test successful decode
                const result1 = await api.users.get();
                expect(result1).to.deep.equal({
                    'alice': { name: 'Alice' },
                    'bob': { name: 'Bob' },
                    'john': { name: 'John' },
                });
                
                const result2 = await api.usersAsList.get({ format: 'list' });
                expect(result2).to.deep.equal([
                    { id: 'alice', name: 'Alice' },
                    { id: 'bob', name: 'Bob' },
                    { id: 'john', name: 'John' },
                ]);
                
                // Test failed decode
                // TODO
            });
        });
    });
    
    /*
    class User {
        static instantiate() {
            return {
                name: null,
            };
        }
        
        static decode(instanceEncoded) {
            return instanceEncoded;
        }
        
        static encode(instance) {
            return instance;
        }
    }
    
    it('should support the method get()', async () => {
        const api = ItemResource(SimpleItem, {
            store: ['app'],
            uri: '/api',
            resources: {
                user: ItemResource(User, {
                    store: ['user'],
                    uri: 'user',
                }),
            },
        })(context);
        
        const userPromise = api.user.get();
        
        expect(userPromise).to.be.an.instanceOf(StorablePromise);
        
        const user = await userPromise;
        
        expect(user).to.deep.equal({ name: 'Alice' });
    });
    
    it('should support the method put()', async () => {
        const api = ItemResource(SimpleItem, {
            store: ['app'],
            uri: '/api',
            resources: {
                user: ItemResource(User, {
                    store: ['user'],
                    uri: 'user',
                }),
            },
        })(context);
        
        const userPromise = api.user.put({ name: 'Alice' });
        
        expect(userPromise).to.be.an.instanceOf(StorablePromise);
        
        const user = await userPromise;
        
        expect(user).to.deep.equal({ user_id: 42, name: 'Alice' });
    });
    
    it('should support custom methods — returning a storable promise', async () => {
        const api = ItemResource(SimpleItem, {
            store: ['app'],
            uri: '/api',
            resources: {
                user: ItemResource(User, {
                    store: ['user'],
                    uri: 'user',
                    methods: {
                        customGet({ spec, agent }, query) {
                            return StorablePromise.from(
                                Loadable(null),
                                { location: spec.store, operation: 'put' },
                                agentMock.get('/api/user')
                                    .then(response => response.data),
                            );
                        },
                    },
                }),
            },
        })(context);
        
        const userPromise = api.user.customGet({ name: 'Alice' });
        
        expect(userPromise).to.be.an.instanceOf(StorablePromise);
        
        const user = await userPromise;
        
        expect(user).to.deep.equal({ name: 'Alice' });
    });
    
    it('should support custom methods — returning a plain promise', async () => {
        const api = ItemResource(SimpleItem, {
            store: ['app'],
            uri: '/api',
            resources: {
                user: ItemResource(User, {
                    store: ['user'],
                    uri: 'user',
                    methods: {
                        customGet({ spec, agent }, query) {
                            return agent.get(spec.uri, { params: query });
                        },
                    },
                }),
            },
        })(context);
        
        const userPromise = api.user.customGet({ name: 'Alice' });
        
        expect(userPromise).to.be.an.instanceOf(StorablePromise);
        
        const user = await userPromise;
        
        expect(user).to.deep.equal({ name: 'Alice' });
    });
    
    it('should support custom methods — returning a custom result', async () => {
        const api = ItemResource(SimpleItem, {
            store: ['app'],
            uri: '/api',
            resources: {
                user: ItemResource(User, {
                    store: ['user'],
                    uri: 'user',
                    methods: {
                        query({ spec, agent }, query) {
                            return StorablePromise.from(
                                Loadable(null),
                                {
                                    location: spec.store,
                                    operation: 'merge',
                                    accessor: queryResult => queryResult.user,
                                },
                                agentMock.get('/api/user/query')
                                    .then(response => {
                                        const parse = response => response.data;
                                        const decode = User.decode;
                                        
                                        const responseParsed = parse(response);
                                        
                                        return {
                                            user: decode(responseParsed.item),
                                            metadata: {
                                                profileLength: responseParsed.metadata.profile_length,
                                            },
                                        };
                                    }),
                            );
                        },
                    },
                }),
            },
        })(context);
        
        const resultPromise = api.user.query({ name: 'Alice' });
        
        expect(resultPromise).to.be.an.instanceOf(StorablePromise);
        expect(resultPromise.spec.operation).to.equal('merge');
        expect(resultPromise.spec.accessor).satisfy(accessor => {
            return accessor({ user: 'foo' }) === 'foo';
        });
        
        const result = await resultPromise;
        
        expect(result).to.deep.equal({
            user: { name: 'Alice', profile: 'Lorem ipsum...' },
            metadata: {
                profileLength: 1000,
            },
        });
    });
    */
});
