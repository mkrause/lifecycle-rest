
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import * as t from 'io-ts';

import { status, Loadable } from '@mkrause/lifecycle-loader';

import createAgent from '../../../lib-esm/agent.js';
// import StorablePromise from '../../../lib-esm/loader/StorablePromise.js';
// import { SimpleItem } from '../../../lib-esm/loader/Resource.js';
import { Unknown } from '../../../lib-esm/schema/Schema.js';
import agentMock, { users as apiMockUsers } from '../../resources/agent_mock.js';

import adapter from '../../../lib-esm/loader/Adapter.js';
import { resourceDef } from '../../../lib-esm/loader/Resource.js';
import { storableKey } from '../../../lib-esm/loader/StorablePromise.js';
import ItemResource from '../../../lib-esm/loader/ItemResource.js';
import CollectionResource from '../../../lib-esm/loader/CollectionResource.js';

import ResourceCommonTests from './ResourceCommonTests.js';


require('util').inspect.defaultOptions.depth = Infinity;

chai.use(chaiAsPromised);

describe('CollectionResource', () => {
    const contextTrivial = {
        agent: createAgent({
            adapter: async request => { throw new Error(`Not supported`); },
        }),
        options: { adapter },
        path: [],
        uri: '',
        store: [],
    };
    
    ResourceCommonTests(CollectionResource);
    
    describe('entry function', () => {
        it('should use a relative path appending the index', () => {
            const resource = CollectionResource(Unknown, {
                path: ['x'],
                uri: 'x',
                store: ['x'],
                entry: ItemResource(Unknown),
            })(contextTrivial);
            
            const entryString = resource('index');
            expect(entryString).property(resourceDef).property('path').to.deep.equal(['x', { index: 'index' }]);
            expect(entryString).property(resourceDef).property('uri').to.equal('x/index');
            expect(entryString).property(resourceDef).property('store').to.deep.equal(['x', { index: 'index' }]);
            
            const entryNumber = resource(42);
            expect(entryNumber).property(resourceDef).property('path').to.deep.equal(['x', { index: 42 }]);
            expect(entryNumber).property(resourceDef).property('uri').to.equal('x/42');
            expect(entryNumber).property(resourceDef).property('store').to.deep.equal(['x', { index: 42 }]);
        });
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
                users: CollectionResource(Unknown, {
                    getKey(user) { return user.user_id; },
                    entry: ItemResource(Unknown, {
                        resources: {
                            posts: CollectionResource(Unknown),
                        },
                    }),
                }),
            },
        })(contextWithAgent);
        
        describe('method `get`', () => {
            it('should be supported as default method', async () => {
                const result = await apiStandard.users.get();
                
                expect(result).to.deep.equal(apiMockUsers);
            });
        });
        
        describe('method `put`', () => {
            // TODO
            it('should be supported as default method');
        });
        
        describe('method `patch`', () => {
            // TODO
            it('should be supported as default method');
        });
        
        describe('method `delete`', () => {
            // TODO
            it('should be supported as default method');
        });
        
        describe('method `post`', () => {
            // TODO
            it('should be supported as default method');
        });
        
        describe('method `create`', () => {
            it('should be supported as default method', async () => {
                const promise = apiStandard.users.create({ name: 'Zackary' });
                
                expect(promise).to.have.property(storableKey).to.have.property('location').to.be.a('function');
                expect(promise[storableKey].location(undefined)).to.deep.equal(['users', undefined]);
                
                const result = await promise;
                
                expect(result).to.deep.equal({ user_id: 'user42', name: 'Zackary' });
                expect(promise[storableKey].location(result)).to.deep.equal(['users', 'user42']);
            });
        });
    });
});
