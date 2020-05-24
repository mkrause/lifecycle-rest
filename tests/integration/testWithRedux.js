
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
import agentMock from '../resources/agent_mock.js';

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
    
    const api = RestApi({ agentMock }, RestApi.Item(Unknown, {
        uri: '/api',
        resources: {
            users: RestApi.Collection(t.record(t.string, User), {
                entry: RestApi.Item(User),
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
    
    const store = Redux.createStore(
        createLifecycleReducer(),
        initialState,
        Redux.applyMiddleware(lifecycleMiddleware)
    );
    
    it('should support fetching a collection', async () => {
        //await store.dispatch(api.users.list());
        
        // TODO: need CollectionResource to return a StorablePromise
        const action = makeStorable(api.users.list(), {
            location: ['users'],
            //getKey: () => null | string,
            accessor: x => x,
            operation: 'put',
        });
        
        const result = await store.dispatch(action);
        
        expect(result).to.deep.equal({
            alice: { name: 'Alice', score: 101 },
            bob: { name: 'Bob', score: 7 },
            john: { name: 'John', score: 42 },
        });
        
        expect(store.getState()).to.deep.equal({
            //users: new Map(Object.entries({
            users: {
                alice: { name: 'Alice', score: 101 },
                bob: { name: 'Bob', score: 7 },
                john: { name: 'John', score: 42 },
            },
            //})),
        });
    });
});
