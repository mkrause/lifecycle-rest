
import chai, { assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiMatchPattern from 'chai-match-pattern';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import * as t from 'io-ts';

import { status, Loadable } from '@mkrause/lifecycle-loader';

import createAgent from '../../lib-esm/agent.js';
import { Unknown } from '../../lib-esm/schema/Schema.js';
import agentMock, { users as usersMock } from '../resources/agent_mock.js';

import { DecodeError } from '../../lib-esm/schema/Schema.js';
import { resourceDef } from '../../lib-esm/loader/Resource.js';
import RestApi from '../../lib-esm/loader/RestApi.js';

import * as Redux from 'redux';
import { makeStorable, isStorable, isStorableKey } from '../../lib-esm/loader/StorablePromise.js';
import createLifecycleMiddleware, { lifecycleActionKey } from '../../lib-esm/redux/middleware.js';
import createLifecycleReducer from '../../lib-esm/redux/reducer.js';


chai.use(chaiAsPromised);
chai.use(chaiMatchPattern);

describe('integration - REST API with redux store', () => {
    const User = t.type({
        name: t.string,
        score: t.number,
    });
    
    const Post = t.type({
        title: t.string,
    });
    
    const api = RestApi({ agent: agentMock }, RestApi.Item(t.unknown, {
        uri: '/api',
        resources: {
            users: RestApi.Collection(t.record(t.string, User), {
                getKey(user) {
                    return user.user_id;
                },
                entry: RestApi.Item(User, {
                    resources: {
                        posts: RestApi.Collection(t.record(t.string, Post), {
                            entry: RestApi.Item(Post),
                        }),
                    },
                }),
            }),
        },
    }));
    
    const lifecycleMiddleware = createLifecycleMiddleware({
        prefix: 'test',
    });
    
    const initialState = {
        // users: Loadable(new Map()), // TODO: need io-ts definition for ES6 `Map`
        users: Loadable({}),
    };
    
    it('should support fetching a collection', async () => {
        const store = Redux.createStore(
            createLifecycleReducer(),
            initialState,
            Redux.applyMiddleware(lifecycleMiddleware),
        );
        
        const result = await store.dispatch(api.users.list());
        
        expect(result).to.deep.equal(usersMock);
        
        expect(store.getState()).to.deep.equal({
            users: {
                alice: usersMock.alice,
                bob: usersMock.bob,
                john: usersMock.john,
            },
        });
        
        expect(store.getState().users).to.have.property(status).to.deep.equal({
            ready: true,
            loading: false,
            error: null,
        });
        
        // Each entry should be `Loadable` (should still have a status)
        // expect(store.getState().users['alice']).to.have.property(status).to.deep.equal({
        //     ready: true,
        //     loading: false,
        //     error: null,
        // });
    });
    
    it('should support creating an entry', async () => {
        const store = Redux.createStore(
            createLifecycleReducer(),
            initialState,
            Redux.applyMiddleware(lifecycleMiddleware),
        );
        
        await store.dispatch(api.users.list());
        
        const zoe = {
            name: 'Zoe',
            score: 999,
            posts: {},
        };
        
        const result = await store.dispatch(api.users.create(zoe));
        
        expect(result).to.deep.equal({ ...zoe, user_id: 'user42' });
        
        expect(store.getState().users).to.have.property(status).to.deep.equal({
            ready: true,
            loading: false,
            error: null,
        });
        expect(store.getState()).to.deep.equal({
            users: {
                ...usersMock,
                'user42': { ...zoe, user_id: 'user42' },
            },
        });
    });
    
    it('should support indexing into a collection', async () => {
        const store = Redux.createStore(
            createLifecycleReducer(),
            initialState,
            Redux.applyMiddleware(lifecycleMiddleware),
        );
        
        const result = await store.dispatch(api.users('alice').get());
        
        expect(result).to.deep.equal(usersMock.alice);
        
        expect(store.getState()).to.deep.equal({
            users: {
                alice: usersMock.alice,
            },
        });
        
        expect(store.getState().users).to.have.property(status).to.deep.equal({
            ready: true, // TODO: invalidated?
            loading: false,
            error: null,
        });
        expect(store.getState().users['alice']).to.have.property(status).to.deep.equal({
            ready: true,
            loading: false,
            error: null,
        });
    });
    
    it('should support deleting an entry', async () => {
        const store = Redux.createStore(
            createLifecycleReducer(),
            initialState,
            Redux.applyMiddleware(lifecycleMiddleware),
        );
        
        await store.dispatch(api.users.list());
        
        const result = await store.dispatch(api.users('bob').delete());
        
        expect(result).to.deep.equal({
            response: undefined,
        });
        
        expect(store.getState().users).to.have.property(status).to.deep.equal({
            ready: true, // TODO: invalidated?
            loading: false,
            error: null,
        });
        expect(store.getState()).to.deep.equal({
            users: {
                alice: usersMock.alice,
                //bob: usersMock.bob, // Deleted
                john: usersMock.john,
            },
        });
    });
    
    it('should support updating an entry', async () => {
        const store = Redux.createStore(
            createLifecycleReducer(),
            initialState,
            Redux.applyMiddleware(lifecycleMiddleware),
        );
        
        await store.dispatch(api.users.list());
        
        const patchAlice = { name: 'Alice @' };
        
        const result = await store.dispatch(api.users('alice').patch(patchAlice));
        
        expect(result).to.deep.equal({ ...usersMock.alice, ...patchAlice });
        
        expect(store.getState().users).to.have.property(status).to.deep.equal({
            ready: true,
            loading: false,
            error: null,
        });
        expect(store.getState()).to.deep.equal({
            users: {
                ...usersMock,
                alice: { ...usersMock.alice, ...patchAlice },
            },
        });
    });
});
