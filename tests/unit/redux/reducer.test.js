
import { expect } from 'chai';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import { Loadable, status } from '@mkrause/lifecycle-loader';
import * as Redux from 'redux';

import { lifecycleActionKey } from '../../../lib-esm/redux/middleware.js';
import createLifecycleReducer from '../../../lib-esm/redux/reducer.js';


const MapFromObject = obj => new Map(Object.entries(obj));
const MapToObject = map => Object.fromEntries(map.entries());

const lifecycleAction = action => ({
    [lifecycleActionKey]: null,
    type: 'test',
    requestId: 'C31817AC-9A82-4DE1-AD71-89F2DBD4DC47',
    state: 'ready',
    ...action,
    
    // TEMP: convenience: if given `item`, turn it into an `update` function automatically
    update: action.update ? action.update : item => {
        return Loadable.asReady(item, action.item);
    },
});

const itemReady = value => Loadable.asReady(Loadable(value));

describe('redux reducer', () => {
    const reduce = createLifecycleReducer({
        prefix: 'test',
    });
    
    const state1 = {
        app: {
            users: {
                user42: itemReady({ name: 'John' }),
                user43: itemReady({ name: 'Alice' }),
            },
        },
    };
    
    it('should not reduce if not a lifecycle action', () => {
        // Not a lifecycle action (missing `lifecycleActionKey` symbol), thus should be ignored
        const action = {
            type: 'test',
        };
        
        expect(reduce(state1, action)).to.deep.equal(state1);
    });
    
    
    describe('updating state', () => {
        it('should replace the entire state if path is empty', () => {
            const action = lifecycleAction({
                path: [],
                state: 'ready',
                update: state => 42,
            });
            
            expect(reduce(state1, action)).to.equal(42);
        });
        
        it('should fail to update on an undefined state', () => {
            const action = lifecycleAction({
                path: ['app'],
                state: 'ready',
                update: state => 42,
            });
            
            expect(() => reduce(undefined, action)).throw(TypeError);
        });
        
        it('should fail to update on a state which is a primitive value', () => {
            const action = lifecycleAction({
                path: ['app'],
                state: 'ready',
                update: state => 42,
            });
            
            expect(() => reduce(null, action)).throw(TypeError);
            expect(() => reduce(42, action)).throw(TypeError);
            expect(() => reduce('hello', action)).throw(TypeError);
            expect(() => reduce(true, action)).throw(TypeError);
        });
        
        describe('on plain object', () => {
            it('should fail to update nonexistent property', () => {
                const action = lifecycleAction({
                    path: ['app', 'nonexistent'],
                    state: 'ready',
                    update: state => 42,
                });
                
                expect(() => reduce(state1, action)).to.throw(TypeError);
            });
            
            /*
            it('should create the intermediate step on single nonexistent step', () => {
                const action = lifecycleAction({
                    path: ['app', 'users', 'nonexistent'],
                    state: 'ready',
                    item: { name: 'Bob' },
                });
                
                expect(reduce(state1, action)).to.deep.equal({
                    app: {
                        ...state1.app,
                        users: {
                            ...state1.app.users,
                            nonexistent: { name: 'Bob' },
                        },
                    },
                });
            });
            */
            
            it('should update value given a valid path', () => {
                const action = lifecycleAction({
                    path: ['app', 'users', 'user42'],
                    state: 'ready',
                    item: { name: 'Alice' },
                });
                
                expect(reduce(state1, action)).to.deep.equal({
                    app: {
                        ...state1.app,
                        users: {
                            ...state1.app.users,
                            user42: { name: 'Alice' },
                        },
                    },
                });
            });
        });
        
        describe('on array', () => {
            it('should fail to update on an array if the index is not a valid array index', () => {
                const state = {
                    ordering: [itemReady({ name: 'foo' }), itemReady({ name: 'bar' })],
                };
                
                const action = lifecycleAction({
                    path: ['ordering', 'nonnumerical'],
                    state: 'ready',
                    item: { name: 'baz' },
                });
                
                expect(() => reduce(state, action)).throw(TypeError);
            });
            
            it('should fail to update on an array if the index is out of bounds', () => {
                const state = {
                    ordering: [itemReady({ name: 'foo' }), itemReady({ name: 'bar' })],
                };
                
                const action = lifecycleAction({
                    path: ['ordering', 5], // Index out of bounds
                    state: 'ready',
                    item: { name: 'baz' },
                });
                
                expect(() => reduce(state, action)).throw(TypeError);
            });
            
            it('should update on an array if the index is a valid array index', () => {
                const state = {
                    ordering: [itemReady({ name: 'foo' }), itemReady({ name: 'bar' })],
                };
                
                const action1 = lifecycleAction({
                    path: ['ordering', 0],
                    state: 'ready',
                    item: { name: 'baz' },
                });
                
                const action2 = lifecycleAction({
                    path: ['ordering', '1'], // Index can also be a string
                    state: 'ready',
                    item: { name: 'baz' },
                });
                
                expect(reduce(state, action1)).deep.equal({
                    ordering: [{ name: 'baz' }, { name: 'bar' }],
                });
                expect(reduce(state, action2)).deep.equal({
                    ordering: [{ name: 'foo' }, { name: 'baz' }],
                });
            });
        });
        
        describe('on Map', () => {
            const stateWithMap = {
                app: {
                    users: MapFromObject({
                        user42: itemReady({ name: 'John' }),
                        user43: itemReady({ name: 'Alice' }),
                    }),
                },
            };
            
            it('should update value given a valid path', () => {
                const action = lifecycleAction({
                    path: ['app', 'users', 'user43'],
                    state: 'ready',
                    item: { name: 'Alice!' },
                });
                
                expect(reduce(stateWithMap, action)).to.deep.equal({
                    app: {
                        ...stateWithMap.app,
                        users: MapFromObject({
                            ...MapToObject(stateWithMap.app.users),
                            user43: { name: 'Alice!' },
                        }),
                    },
                });
            });
        });
        
        describe('on ImmutableJS', () => {
            // Immutable data structures that support get(), set(), etc.
            it('TODO');
        });
    });
    
    describe('with updater', () => {
        it('should be able to update an existing item', () => {
            const state = { count: 42 };
            
            const action = lifecycleAction({
                path: ['count'],
                state: 'ready',
                update: count => count + 1,
            });
            
            const result = reduce(state, action);
            expect(result).to.deep.equal({ count: 43 });
        });
    });
    
    describe('with loadable item', () => {
        const stateWithLoadable = {
            app: {
                users: {
                    user42: itemReady({ name: 'John' }),
                    user43: itemReady({ name: 'Alice' }),
                },
            },
        };
        
        it('should be able to update a loadable item', () => {
            const action = lifecycleAction({
                path: ['app', 'users', 'user43'],
                state: 'ready',
                update: item => Loadable.update(item, { name: 'Alice!' }, { loading: true }),
            });
            
            const result = reduce(stateWithLoadable, action);
            expect(result).to.deep.equal({
                app: {
                    ...stateWithLoadable.app,
                    users: {
                        ...stateWithLoadable.app.users,
                        user43: { name: 'Alice!' },
                    },
                },
            });
            expect({ ...result.app.users.user43 }).to.deep.equal({ name: 'Alice!' });
            expect({ ...result.app.users.user43[status] }).to.deep.equal({
                ready: false,
                loading: true,
                error: null,
            });
        });
    });
});
