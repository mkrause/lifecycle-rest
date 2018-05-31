// @flow
declare var describe : Function;
declare var it : Function;

import { expect } from 'chai';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import { status, Loadable } from '@mkrause/lifecycle-loader';
import { Entity, Collection } from '@mkrause/lifecycle-immutable';

import createAgent from '../../../src/agent.js';
import StorablePromise from '../../../src/loader/StorablePromise.js';
import { SimpleItem } from '../../../src/loader/Resource.js';
import ItemResource from '../../../src/loader/ItemResource.js';


describe('ItemResource', () => {
    const agentMock = createAgent({
        adapter: async request => {
            const { method, url, params } = request;
            
            if (method === 'get' && url === '/api') {
                const item = {
                    version: 42,
                };
                
                return Promise.resolve({ data: item });
            } else if (method === 'get' && url === '/api/foo') {
                return Promise.resolve({ data: { x: 42 } });
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
    
    const context = {
        agent: agentMock,
        config: {},
        path: [],
        store: [],
        uri: '',
    };
    
    it('should have sensible defaults', () => {
        const api = ItemResource(SimpleItem)(context);
        
        expect(api).to.have.nested.property('_spec.store').to.deep.equal([]);
        expect(api).to.have.nested.property('_spec.uri').to.deep.equal('');
    });
    
    it('should allow customization', () => {
        const api = ItemResource(SimpleItem, {
            store: ['foo', 'bar'],
            uri: 'x/y',
        })(context);
        
        expect(api).to.have.nested.property('_spec.store').to.deep.equal(['foo', 'bar']);
        expect(api).to.have.nested.property('_spec.uri').to.equal('x/y');
    });
    
    it('should allow definition of subresources', () => {
        const api = ItemResource(SimpleItem, {
            store: ['foo', 'bar'],
            uri: 'x/y',
            resources: {
                baz: ItemResource(SimpleItem),
            },
        })(context);
        
        expect(api).to.have.property('baz');
        
        expect(api.baz).to.have.nested.property('_spec.store').to.deep.equal(['foo', 'bar', 'baz']);
        expect(api.baz).to.have.nested.property('_spec.uri').to.equal('x/y/baz');
    });
    
    it('should use relative behavior by default for subresources', () => {
        const api = ItemResource(SimpleItem, {
            store: ['foo', 'bar'],
            uri: 'x/y',
            resources: {
                baz: ItemResource(SimpleItem, {
                    store: ['baz'],
                    uri: 'z',
                }),
            },
        })(context);
        
        expect(api).to.have.property('baz');
        
        expect(api.baz).to.have.nested.property('_spec.store').to.deep.equal(['foo', 'bar', 'baz']);
        expect(api.baz).to.have.nested.property('_spec.uri').to.equal('x/y/z');
    });
    
    it('should support default methods on SimpleItem', async () => {
        const api = ItemResource(SimpleItem, {
            store: ['app'],
            uri: '/api',
            resources: {
                foo: ItemResource(SimpleItem, {
                    store: ['foo'],
                    uri: 'foo',
                }),
            },
        })(context);
        
        const result = await api.foo.get();
        
        expect(result).to.deep.equal({ x: 42 });
    });
    
    
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
                                { location: spec.location, operation: 'put' },
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
                                    location: spec.location,
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
        
        const result = await resultPromise;
        
        expect(result).to.deep.equal({
            user: { name: 'Alice', profile: 'Lorem ipsum...' },
            metadata: {
                profileLength: 1000,
            },
        });
    });
});
