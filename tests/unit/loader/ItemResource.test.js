
import { expect } from 'chai';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import * as t from 'io-ts';

import { status, Loadable } from '@mkrause/lifecycle-loader';

import createAgent from '../../../lib-esm/agent.js';
// import StorablePromise from '../../../lib-esm/loader/StorablePromise.js';
// import { SimpleItem } from '../../../lib-esm/loader/Resource.js';

import ItemResource from '../../../lib-esm/loader/ItemResource.js';


// TEMP
const SimpleItem = {
    name: 'SimpleItem',
    is(other) { return true; },
    validate(instance, context) { return {}; },
    decode(instance) { return {}; },
    encode(instance) { return {}; },
    //pipe() {},
    //asDecoder() {},
    //asEncoder() {},
};

const Identity = new t.Type('Identity', _ => true, t.success, t.identity);

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
        
        expect(api).to.have.nested.property('_spec.store').to.deep.equal([]);
        expect(api).to.have.nested.property('_spec.uri').to.deep.equal('');
    });
    
    it('should allow customization', () => {
        const api = ItemResource(Identity, {
            store: ['foo', 'bar'],
            uri: 'x/y',
        })(context);
        
        expect(api).to.have.nested.property('_spec.store').to.deep.equal(['foo', 'bar']);
        expect(api).to.have.nested.property('_spec.uri').to.equal('x/y');
    });
    
    it('should allow definition of methods', () => {
        const methodMock = sinon.stub().callsFake(({ context, agent, spec, schema }, name) => `Hello ${name}`);
        
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
        sinon.assert.calledOn(methodMock, api._spec); // `this` should be the spec
        sinon.assert.calledWith(methodMock, sinon.match.object, sinon.match('Alice'));
        sinon.assert.calledWith(methodMock, sinon.match.has('context', sinon.match(context)));
        sinon.assert.calledWith(methodMock, sinon.match.has('agent', sinon.match.same(context.agent)));
        sinon.assert.calledWith(methodMock, sinon.match.has('schema', sinon.match.same(Identity)));
        sinon.assert.calledWith(methodMock, sinon.match.has('spec', sinon.match({
            store: ['foo', 'bar'],
            uri: 'x/y',
        })));
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
        
        expect(api.baz).to.have.nested.property('_spec.store').to.deep.equal(['foo', 'bar', 'baz']);
        expect(api.baz).to.have.nested.property('_spec.uri').to.equal('x/y/baz');
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
        
        expect(api.baz).to.have.nested.property('_spec.store').to.deep.equal(['foo', 'bar', 'baz']);
        expect(api.baz).to.have.nested.property('_spec.uri').to.equal('x/y/z');
    });
    
    
    // Simple mock REST API endpoint
    const agentMock = createAgent({
        adapter: async request => {
            const { method, url, params } = request;
            
            if (method === 'get' && url === '/api') {
                const item = {
                    version: 42,
                };
                
                return Promise.resolve({ data: item });
            } else if (method === 'get' && url === '/api/greet') {
                return Promise.resolve({ data: `Hello ${params.name}` });
            } else if (method === 'get' && url === '/api/user') {
                const user = {
                    name: 'Alice',
                };
                
                return Promise.resolve({ data: user });
            } else if (method === 'get' && url === '/api/user/query') {
                const user = {
                    name: 'Alice',
                    profile: 'Lorem ipsum...',
                };
                
                const response = {
                    metadata: { profile_length: 1000 },
                    item: user,
                };
                
                return Promise.resolve({ data: response });
            } else if (method === 'put' && url === '/api/user') {
                const userRequest = JSON.parse(request.data);
                
                const user = {
                    ...userRequest,
                    user_id: 42, // Simulate create response with newly added ID
                };
                
                return Promise.resolve({ data: user });
            } else {
                throw new Error($msg`Unknown route ${method} ${url}`);
            }
        },
    });
    
    const contextWithAgent = {
        agent: agentMock,
        options: {},
        path: [],
        store: [],
        uri: '',
    };
    
    it('should support default method `get`', async () => {
        const api = ItemResource(Identity, {
            store: ['app'],
            uri: '/api',
            resources: {
                greet: ItemResource(Identity, {
                    store: ['greet'],
                    uri: 'greet',
                }),
            },
        })(contextWithAgent);
        
        const result1 = await api.get();
        expect(result1).to.deep.equal({ version: 42 });
        expect(result1[status]).to.have.property('ready', true);
        expect(result1[status]).to.have.property('loading', false);
        expect(result1[status]).to.have.property('error', null);
        
        // Subresource
        const result2 = await api.greet.get({ name: 'Alice' });
        expect(String(result2)).to.equal('Hello Alice');
        expect(result2[status]).to.have.property('ready', true);
        expect(result2[status]).to.have.property('loading', false);
        expect(result2[status]).to.have.property('error', null);
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
