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
    // Simulate an async response
    const makeResponse = response => new Promise(resolve => {
        setTimeout(() => { resolve(response); }, 0);
    });
    
    const agentMock = createAgent({
        adapter: async request => {
            const { method, url, params } = request;
            
            if (method === 'get' && url === '/api') {
                const item = {
                    version: 42,
                };
                
                return await makeResponse({ data: item });
            } else if (method === 'get' && url === '/api/foo') {
                return await makeResponse({ data: { x: 42 } });
            } else if (method === 'get' && url === '/api/user') {
                const user = {
                    name: 'Alice',
                };
                
                return await makeResponse({ data: user });
            } else if (method === 'put' && url === '/api/user') {
                const userRequest = JSON.parse(request.data);
                
                const user = {
                    ...userRequest,
                    user_id: 42, // Simulate create response with newly added ID
                };
                
                return await makeResponse({ data: user });
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
    
    it('should support methods', async () => {
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
        
        const user = await api.user.get();
        
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
        
        const user = await api.user.put({ name: 'Alice' });
        
        expect(user).to.deep.equal({ user_id: 42, name: 'Alice' });
    });
});
