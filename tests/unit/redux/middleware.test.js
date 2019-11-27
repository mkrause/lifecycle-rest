
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

//import { status, Loadable, LoadablePromise } from '@mkrause/lifecycle-loader';
import * as Redux from 'redux';

import createAgent from '../../../lib-esm/agent.js';
import RestApi from '../../../lib-esm/loader/RestApi.js';
import { makeStorable, isStorable, isStorableKey } from '../../../lib-esm/loader/StorablePromise.js';
import createLifecycleMiddleware, { isLifecycleAction } from '../../../lib-esm/redux/middleware.js';


chai.use(chaiAsPromised);

describe('redux middleware', () => {
    const lifecycleMiddleware = createLifecycleMiddleware({
        prefix: 'test',
    });
    
    it('should produce loading + ready actions given a promise that resolves', async () => {
        const reduceMock = sinon.stub()
            //.callsFake((state, action) => state);
            .callsFake((state, action) => { return state; });
        
        const initialState = {};
        
        const store = Redux.createStore(
            reduceMock,
            initialState,
            Redux.applyMiddleware(lifecycleMiddleware)
        );
        
        const storablePromise = makeStorable(new Promise((resolve, reject) => { resolve(42); }), {
            location: ['x', 'y', 'z'],
            operation: 'put',
        });
        
        const dispatchPromise = store.dispatch(storablePromise);
        await expect(dispatchPromise).to.eventually.equal(42);
        
        sinon.assert.calledThrice(reduceMock);
        sinon.assert.calledWith(reduceMock.secondCall, sinon.match.any, sinon.match({
            [isLifecycleAction]: null,
            type: 'test:x.y.z:loading',
            request: sinon.match.string,
            path: ['x', 'y', 'z'],
            state: 'loading',
        }));
        sinon.assert.calledWith(reduceMock.thirdCall, sinon.match.any, sinon.match({
            [isLifecycleAction]: null,
            type: 'test:x.y.z:ready',
            request: sinon.match.string,
            path: ['x', 'y', 'z'],
            state: 'ready',
            item: 42,
        }));
    });
    
    it('should produce loading + failed actions given a promise that rejects', async () => {
        const reduceMock = sinon.stub()
            //.callsFake((state, action) => state);
            .callsFake((state, action) => { return state; });
        
        const initialState = {};
        
        const store = Redux.createStore(
            reduceMock,
            initialState,
            Redux.applyMiddleware(lifecycleMiddleware)
        );
        
        const storablePromise = makeStorable(new Promise((resolve, reject) => { reject(new Error('fail')); }), {
            location: ['x', 'y', 'z'],
            operation: 'put',
        });
        
        const dispatchPromise = store.dispatch(storablePromise);
        await expect(dispatchPromise).to.be.rejectedWith(Error, /fail/);
        
        sinon.assert.calledThrice(reduceMock);
        sinon.assert.calledWith(reduceMock.secondCall, sinon.match.any, sinon.match({
            [isLifecycleAction]: null,
            type: 'test:x.y.z:loading',
            request: sinon.match.string,
            path: ['x', 'y', 'z'],
            state: 'loading',
        }));
        sinon.assert.calledWith(reduceMock.thirdCall, sinon.match.any, sinon.match({
            [isLifecycleAction]: null,
            type: 'test:x.y.z:failed',
            request: sinon.match.string,
            path: ['x', 'y', 'z'],
            state: 'failed',
            reason: sinon.match.instanceOf(Error),
        }));
    });
    
    /*
    describe('with RestApi', () => {
        const agentMock = createAgent({
            adapter: async request => { throw new Error(`Not supported`); },
        });
        
        // const reducers = [
        //     (state, action) => {
        //         console.log('action: ' + JSON.stringify(action));
        //         return state;
        //     },
        // ];
        // const reduce = (state : mixed, action : { type : string }) =>
        //     reducers.reduce((state, reducer) => reducer(state, action), state);
        
        const initialState = {
            app: {
                users: {},
            },
        };
        
        const api = RestApi(agentMock, {
            store: ['app'],
            resources: {
                users: RestApi.Collection(UsersCollection, {
                    methods: {},
                }),
            },
        });
        
        it('...', () => {
            const reduceMock = sinon.stub()
                .callsFake((state, action) => state);
            
            const store = Redux.createStore(reduceMock, initialState, Redux.applyMiddleware(lifecycleMiddleware));
            
            store.dispatch(api.users.list());
            
            sinon.assert.calledTwice(reduceMock);
        });
    });
    */
});
