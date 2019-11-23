/*
import { expect } from 'chai';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import * as Redux from 'redux';

import createLifecycleReducer from '../../../lib-esm/redux/reducer.js';


describe('redux reducer', () => {
    const reduce = createLifecycleReducer({
        prefix: 'test',
    });
    
    const state1 = {
        app: {
            users: {
                user42: { name: 'John' },
            },
        },
    };
    
    it('should not reduce if the prefix does not match', () => {
        const action = {
            type: 'foo', // Does not match prefix
        };
        
        expect(reduce(state1, action)).to.deep.equal(state1);
    });
    
    
    describe('on JS primitives', () => {
        /*
        // TODO: should we not accept inserts into arbitrary objects? But only in dedicated hash maps
        // like Immutable.Map? Make it configurable?
        it('should fail on nonexistent path', () => {
            const action = {
                type: 'test:',
                path: ['nonexistent'],
                //state: 'ready', // Unused
            };
            //...
        });
        * /
        
        it('should fail to update on a state which is null or undefined', () => {
            const action = {
                type: 'test:',
                path: ['app'],
                //state: 'ready', // Unused
                item: 42,
            };
            
            expect(() => reduce(undefined, action)).throw(TypeError);
            expect(() => reduce(null, action)).throw(TypeError);
        });
        
        it('should fail to update on an array if the index is not an unsigned integer', () => {
            const state = {
                ordering: [{ name: 'foo' }, { name: 'bar' }],
            };
            
            const action = {
                type: 'test:',
                path: ['ordering', 'nonnumerical'],
                //state: 'ready', // Unused
                item: { name: 'baz' },
            };
            
            expect(() => reduce(state, action)).throw(TypeError);
        });
        
        it('should update on an array if the index is a valid array index', () => {
            const state = {
                ordering: [{ name: 'foo' }, { name: 'bar' }],
            };
            
            const action1 = {
                type: 'test:',
                path: ['ordering', 0],
                //state: 'ready', // Unused
                item: { name: 'baz' },
            };
            
            const action2 = {
                type: 'test:',
                path: ['ordering', '5'], // Can be a string
                //state: 'ready', // Unused
                item: { name: 'baz' },
            };
            
            expect(reduce(state, action1)).deep.equal({
                ordering: [{ name: 'baz' }, { name: 'bar' }],
            });
            expect(reduce(state, action2)).deep.equal({
                ordering: [{ name: 'foo' }, { name: 'bar' }, , , , { name: 'baz' }],
            });
        });
        
        it('should replace the entire state if path is empty', () => {
            const action = {
                type: 'test:',
                path: [],
                //state: 'ready', // Unused
                item: 42,
            };
            
            expect(reduce(state1, action)).to.equal(42);
        });
        
        it('should fail to create intermediate steps for non-single step', () => {
            const action = {
                type: 'test:',
                path: ['app', 'nonexistent1', 'nonexistent2'],
                //state: 'ready', // Unused
                item: 42,
            };
            
            expect(() => reduce(state1, action)).to.throw(TypeError);
        });
        
        it('should create the intermediate step on single nonexistent step', () => {
            const action = {
                type: 'test:',
                path: ['app', 'users', 'nonexistent'],
                //state: 'ready', // Unused
                item: { name: 'Bob' },
            };
            
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
        
        it('should override any existing value', () => {
            const action = {
                type: 'test:',
                path: ['app', 'users', 'user42'],
                //state: 'ready', // Unused
                item: { name: 'Alice' },
            };
            
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
    
    describe('on compatible immutable data structures', () => {
        // Immutable data structures that support get(), set(), etc.
        it('TODO');
    });
});
*/
