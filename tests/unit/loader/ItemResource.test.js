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
import ItemResource, { SimpleResource } from '../../../src/loader/ItemResource.js';


describe('RestApi', () => {
    describe('ItemResource', () => {
        class Item {
            static empty() {
                return {};
            }
            
            static decode(instanceEncoded) {
                return instanceEncoded.reduce(
                    (acc, item) => {
                        return { ...acc, [item.user_id]: item };
                    },
                    {}
                );
            }
        }
        
        const agentMock = createAgent({
            adapter: request => {
                const { method, baseUrl, url, params } = request;
                
                if (url === '/api') {
                    const item = {
                        version: 42,
                    };
                    
                    // Simulate an async request
                    return new Promise(resolve => {
                        setTimeout(() => { resolve({ data: item }); }, 0);
                    });
                } else if (url === '/api/user') {
                    const user = {
                        name: 'Alice',
                    };
                    
                    // Simulate an async request
                    return new Promise(resolve => {
                        setTimeout(() => { resolve({ data: user }); }, 0);
                    });
                } else {
                    throw new Error($msg`Unknown route ${url}`);
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
            const api = SimpleResource()(context);
            
            expect(api).to.have.nested.property('_spec.store').to.deep.equal([]);
            expect(api).to.have.nested.property('_spec.uri').to.deep.equal('');
        });
        
        it('should allow customization', () => {
            const api = SimpleResource({
                store: ['foo', 'bar'],
                uri: 'x/y',
            })(context);
            
            expect(api).to.have.nested.property('_spec.store').to.deep.equal(['foo', 'bar']);
            expect(api).to.have.nested.property('_spec.uri').to.equal('x/y');
        });
        
        it('should allow definition of subresources', () => {
            const api = SimpleResource({
                store: ['foo', 'bar'],
                uri: 'x/y',
                resources: {
                    baz: SimpleResource(),
                },
            })(context);
            
            expect(api).to.have.property('baz');
            
            expect(api.baz).to.have.nested.property('_spec.store').to.deep.equal(['foo', 'bar', 'baz']);
            expect(api.baz).to.have.nested.property('_spec.uri').to.equal('x/y/baz');
        });
        
        it('should use relative behavior by default for subresources', () => {
            const api = SimpleResource({
                store: ['foo', 'bar'],
                uri: 'x/y',
                resources: {
                    baz: SimpleResource({
                        store: ['baz'],
                        uri: 'z',
                    }),
                },
            })(context);
            
            expect(api).to.have.property('baz');
            
            expect(api.baz).to.have.nested.property('_spec.store').to.deep.equal(['foo', 'bar', 'baz']);
            expect(api.baz).to.have.nested.property('_spec.uri').to.equal('x/y/z');
        });
        
        it('should support the method fetch()', async () => {
            const api = SimpleResource({
                store: ['app'],
                uri: '/api',
                resources: {
                    user: SimpleResource({
                        store: ['user'],
                        uri: 'user',
                    }),
                },
            })(context);
            
            const user = await api.user.fetch();
            
            expect(user).to.have.property('name', 'Alice');
        });
    });
});
