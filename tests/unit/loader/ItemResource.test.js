
import chai, { assert, expect } from 'chai';
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
import { Unknown } from '../../../lib-esm/schema/Schema.js';
import agentMock from '../../resources/agent_mock.js';

import adapter from '../../../lib-esm/loader/Adapter.js';
import { DecodeError } from '../../../lib-esm/schema/Schema.js';
import { resourceDef } from '../../../lib-esm/loader/Resource.js';
import ItemResource from '../../../lib-esm/loader/ItemResource.js';


require('util').inspect.defaultOptions.depth = Infinity;

chai.use(chaiAsPromised);
chai.use(chaiMatchPattern);

describe('ItemResource', () => {
    const contextTrivial = {
        agent: createAgent({
            adapter: async request => { throw new Error(`Not supported`); },
        }),
        options: { adapter },
        path: [],
        uri: '',
        store: [],
    };
    
    it('should have sensible defaults', () => {
        const resourceCreator = ItemResource(Unknown);
        const resource = resourceCreator(contextTrivial);
        
        // The resource creator should expose its schema
        expect(resourceCreator).property('schema').to.equal(Unknown);
        
        // The resource should have a private symbol `resourceDef` exposing its internal definition
        expect(resource).property(resourceDef).property('path').to.deep.equal([]);
        expect(resource).property(resourceDef).property('store').to.deep.equal([]);
        expect(resource).property(resourceDef).property('uri').to.deep.equal('');
    });
    
    it('should allow configuration of the `path`', () => {
        const resource1 = ItemResource(Unknown, { path: [] })(contextTrivial);
        const resource2 = ItemResource(Unknown, { path: ['x'] })(contextTrivial);
        
        // With non-empty context `path`
        const resource3 = ItemResource(Unknown, { path: ['y', 'z'] })({ ...contextTrivial, path: ['x'] });
        
        expect(resource1).property(resourceDef).property('path').to.deep.equal([]);
        expect(resource2).property(resourceDef).property('path').to.deep.equal(['x']);
        expect(resource3).property(resourceDef).property('path').to.deep.equal(['x', 'y', 'z']);
    });
    
    it('should allow configuration of the `uri`', () => {
        const resource1 = ItemResource(Unknown, { uri: '' })(contextTrivial);
        const resource2 = ItemResource(Unknown, { uri: 'x' })(contextTrivial);
        
        // With non-empty context `uri`
        const resource3 = ItemResource(Unknown, { uri: 'y/z' })({ ...contextTrivial, uri: '/x' });
        
        // Should properly handle relative paths, slashes, etc. when concatenating
        const resource4 = ItemResource(Unknown, { uri: '/y/z//' })({ ...contextTrivial, uri: '/x/' });
        
        expect(resource1).property(resourceDef).property('uri').to.deep.equal('');
        expect(resource2).property(resourceDef).property('uri').to.deep.equal('x');
        expect(resource3).property(resourceDef).property('uri').to.deep.equal('/x/y/z');
        expect(resource4).property(resourceDef).property('uri').to.deep.equal('/x/y/z');
    });
    
    it('should allow configuration of the `store`', () => {
        const resource1 = ItemResource(Unknown, { store: [] })(contextTrivial);
        const resource2 = ItemResource(Unknown, { store: ['x'] })(contextTrivial);
        
        // With non-empty context `store`
        const resource3 = ItemResource(Unknown, { store: ['y', 'z'] })({ ...contextTrivial, store: ['x'] });
        
        expect(resource1).property(resourceDef).property('store').to.deep.equal([]);
        expect(resource2).property(resourceDef).property('store').to.deep.equal(['x']);
        expect(resource3).property(resourceDef).property('store').to.deep.equal(['x', 'y', 'z']);
    });
    
    it('should allow definition of methods', () => {
        const methodMock = sinon.stub().callsFake(name => `Hello ${name}`);
        
        const resource = ItemResource(Unknown, {
            methods: {
                greet: methodMock,
            },
        })(contextTrivial);
        
        expect(resource).to.have.property('greet').to.be.a('function');
        
        const result = resource.greet('Alice');
        
        expect(result).to.equal('Hello Alice');
        sinon.assert.calledOnce(methodMock);
        sinon.assert.calledWith(methodMock, 'Alice');
        sinon.assert.calledOn(methodMock, resource); // `this` should be the resource
    });
    
    it('should allow definition of subresources', () => {
        const resource = ItemResource(Unknown, {
            resources: {
                foo: ItemResource(Unknown),
            },
        })(contextTrivial);
        
        expect(resource).to.have.property('foo').to.be.an('object');
    });
    
    it('should use sensible defaults for subresources', () => {
        const context = {
            ...contextTrivial,
            path: ['x'],
            uri: '/x',
            store: ['x'],
        };
        
        const resource = ItemResource(Unknown, {
            path: ['y'],
            uri: 'y',
            store: ['y'],
            resources: {
                z: ItemResource(Unknown),
            },
        })(context);
        
        // Subresources should use their key as the default label (in this case, `z`)
        expect(resource.z).property(resourceDef).property('path').to.deep.equal(['x', 'y', 'z']);
        expect(resource.z).property(resourceDef).property('uri').to.equal('/x/y/z');
        expect(resource.z).property(resourceDef).property('store').to.deep.equal(['x', 'y', 'z']);
    });
    
    
    // Test the default methods (without doing any real schema encoding/decoding yet, i.e. use `Unknown`)
    describe('default methods (with trivial schema)', () => {
        // Use `agentMock` as the agent, see `tests/resources/agent_mock.js` for the definition
        const contextWithAgent = {
            agent: agentMock,
            options: { adapter },
            path: [],
            uri: '',
            store: [],
        };
        
        const apiStandard = ItemResource(Unknown, {
            uri: '/api',
            resources: {
                users: ItemResource(Unknown, {
                    resources: {
                        alice: ItemResource(Unknown),
                    },
                }),
            },
        })(contextWithAgent);
        
        describe('method `get`', () => {
            it('should be supported as default method', async () => {
                const api = ItemResource(Unknown, {
                    uri: '/api',
                    resources: {
                        greet: ItemResource(Unknown, {
                            uri: 'greet',
                        }),
                    },
                })(contextWithAgent);
                
                const result1 = await api.get();
                expect(result1).to.deep.equal({ version: 42 });
                
                // Should be able to pass query parameters
                const result2 = await api.greet.get({ name: 'Alice', score: 101 });
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
                // Partial update
                const userUpdated = await apiStandard.users['alice'].patch({
                    name: 'Alice!',
                });
                
                // Result should only have the partial update applied
                expect(userUpdated).to.deep.equal({
                    name: 'Alice!',
                    score: 101,
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
    
    describe('schema decoding/encoding', () => {
        // Schemas
        
        // Util
        const orThrow = decodeResult => {
            if ('left' in decodeResult) {
                throw new Error('Decode failed');
            } else {
                return decodeResult.right;
            }
        };
        
        // Note: manually create a new `t.Type` (rather than using existing primitives)
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
            score: t.number,
        });
        
        // Create two versions of user collection schemas: one array (with ID as prop), one map (key as ID)
        const UserKey = t.string;
        const UsersListSchema = t.array(t.intersection([t.type({ id: UserKey }), UserSchema]));
        const UsersMapSchema = t.record(UserKey, UserSchema);
        
        
        const contextWithAgent = {
            agent: agentMock,
            options: { adapter },
            path: [],
            store: [],
            uri: '',
        };
        
        // Define an API with the actual schemas
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
                expect(result1).to.deep.equal({ name: 'Alice', score: 101 });
                
                // Test failed decode
                expect(
                    await expect(api.users['alice'].get({ bug: 'wrong-type' }))
                        .to.be.rejectedWith(DecodeError, /failed to decode/i)
                ).to.have.property('errors').to.matchPattern(`[{ value: 'string', ... }]`);
                // await expect(api.users['alice'].get({ bug: 'extra-properties' }))
                //     .to.be.rejectedWith(DecodeError, /failed to decode/i);
            });
            
            it('should decode the response using the given schema (schema: collection)', async () => {
                // Test successful encode
                const result1 = await api.users.get();
                expect(result1).to.deep.equal({
                    'alice': { name: 'Alice', score: 101 },
                    'bob': { name: 'Bob', score: 7 },
                    'john': { name: 'John', score: 42 },
                });
                
                const result2 = await api.usersAsList.get({ format: 'list' });
                expect(result2).to.deep.equal([
                    { id: 'alice', name: 'Alice', score: 101 },
                    { id: 'bob', name: 'Bob', score: 7 },
                    { id: 'john', name: 'John', score: 42 },
                ]);
                
                // TODO: test failed decode
            });
        });
        
        describe('method `put`', () => {
            it('should encode the request/decode the response using the given schema', async () => {
                const aliceUpdated = orThrow(UserSchema.decode({
                    name: 'Alice!',
                    score: 102,
                }));
                
                const result = await api.users['alice'].put(aliceUpdated);
                expect(result).to.deep.equal(aliceUpdated);
                
                // TODO: test failed decode
            });
        });
        
        describe('method `patch`', () => {
            it('should encode the request/decode the response using the given schema', async () => {
                const PartialUserSchema = t.partial(UserSchema.props);
                
                // Partial update
                const aliceUpdated = orThrow(PartialUserSchema.decode({
                    score: 102,
                }));
                
                const result = await api.users['alice'].patch(aliceUpdated);
                expect(result).to.deep.equal({
                    name: 'Alice', // Unchanged
                    score: 102, // Updated
                });
                
                // TODO: test failed decode
            });
        });
        
        describe('method `delete`', () => {
            it('should not need to decode/encode', async () => {
                assert(true); // Nothing to test
            });
        });
        
        describe('method `post`', () => {
            it('should not need to decode/encode', async () => {
                assert(true); // Nothing to test
            });
        });
    });
    
    /*
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
        })(contextTrivial);
        
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
        })(contextTrivial);
        
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
        })(contextTrivial);
        
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
