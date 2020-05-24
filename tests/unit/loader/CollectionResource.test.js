
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
            it('should be supported as default method', async () => {
                const userUpdated = await apiStandard.users('alice').put({
                    name: 'Alice!',
                });
                
                // Should replace the entire user
                expect(userUpdated).to.deep.equal({
                    name: 'Alice!',
                });
            });
        });
        
        describe('method `patch`', () => {
            it('should be supported as default method', async () => {
                // Partial update
                const userUpdated = await apiStandard.users('alice').patch({
                    name: 'Alice!',
                });
                
                // Result should only have the partial update applied
                expect(userUpdated).to.deep.equal({
                    ...apiMockUsers.alice,
                    name: 'Alice!',
                });
            });
        });
        
        describe('method `delete`', () => {
            it('should be supported as default method', async () => {
                const result = await apiStandard.users('alice').delete();
                
                expect(result).to.equal(undefined);
            });
        });
        
        describe('method `post`', () => {
            it('should be supported as default method', async () => {
                const promise = apiStandard.users('alice').post();
                
                await expect(promise).to.be.rejectedWith(Error, /request failed with status code 409/i);
            });
        });
        
        describe('method `create`', () => {
            it('should be supported as default method', async () => {
                const result = await apiStandard.users.create({ name: 'Zackary' });
                
                expect(result).to.deep.equal({ user_id: 'user42', name: 'Zackary' });
            });
        });
    });
});
