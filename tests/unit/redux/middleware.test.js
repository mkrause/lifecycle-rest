
import { expect } from 'chai';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import { status, Loadable, LoadablePromise } from '@mkrause/lifecycle-loader';
import * as Redux from 'redux';

import createAgent from '../../../src/agent.js';
import RestApi from '../../../src/loader/RestApi.js';
import createLifecycleMiddleware from '../../../src/redux/middleware.js';


describe('redux middleware', () => {
    const agentMock = createAgent({
        adapter: request => {
            const { method, baseUrl, url } = request;
            
            if (url === '/users') {
                // Simulate an async request
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve({
                            data: [
                                { user_id: 'user42', name: 'John' },
                                { user_id: 'user43', name: 'Alice' },
                            ],
                        });
                    }, 0);
                });
            } else {
                throw new Error($msg`Unknown route ${url}`);
            }
        },
    });
    
    class UsersCollection {
        static decode(instanceEncoded) {
            return instanceEncoded.reduce(
                (acc, item) => {
                    return { ...acc, [item.user_id]: item };
                },
                {}
            );
        }
    }
    
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
    const lifecycleMiddleware = createLifecycleMiddleware({
        //...
    });
    
    const api = RestApi(agentMock, {
        store: ['app'],
        resources: {
            users: RestApi.Collection(UsersCollection, {
                methods: {},
            }),
        },
    });
    
    describe('...', () => {
        it('...', () => {
            const reduceMock = sinon.stub()
                .callsFake((state, action) => state);
            
            const store = Redux.createStore(reduceMock, initialState, Redux.applyMiddleware(lifecycleMiddleware));
            
            store.dispatch(api.users.list());
            
            sinon.assert.calledTwice(reduceMock);
        });
    });
});
