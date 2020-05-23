
import match from 'case-match';
import $msg from 'message-tag';

import merge from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';

import { Reducer } from 'redux';
import { Loadable } from '@mkrause/lifecycle-loader';
import { Step as LocationStep, stepToString } from '../loader/StorablePromise.js';
import { isLifecycleAction } from './middleware.js';


type State = unknown;

type StatePath = Array<LocationStep>;

type ReducerConfig = {
    // The prefix used for lifecycle action types (should match the prefix configured in the middleware)
    prefix : string,
    
    // Whether to keep track of all requests in a separate log (so that we can know the status of requests
    // without having to traverse the whole tree).
    trackRequests : boolean,
    requestsPath : StatePath, // The path at which to store tracked requests
};


type Updater = <T>(item : Loadable<T>) => Loadable<T>;

const updatePlainObject = (state : object, step : LocationStep, updateChild : (value : unknown) => unknown) => {
    // Step must be a string (or number), because we're using it to index into a plain JS object
    if (typeof step !== 'string' && typeof step !== 'number') {
        throw new TypeError($msg`Invalid step ${step} into plain object, need a string or number`);
    }
    
    const propKey : PropertyKey = step;
    
    if (!ObjectUtil.hasOwnProp(state, propKey)) {
        // Refuse to create new properties, only update existing
        throw new TypeError($msg`No such state at ${step}`);
    }
    
    return { ...state, [propKey]: updateChild(state[propKey]) };
};

const updateArray = (state : Array<unknown>, step : LocationStep, updateChild : (value : unknown) => unknown) => {
    let index : number;
    if (typeof step === 'number') {
        index = step;
    } else if (typeof step === 'string') {
        if (!/^[0-9]+$/.test(step)) {
            throw new TypeError($msg`Trying to set in array, but given non-numerical index ${step}`);
        }
        index = parseInt(step);
    } else {
        throw new TypeError($msg`Trying to set in array, but given non-numerical index ${step}`);
    }
    
    if (!(index in state)) {
        throw new TypeError($msg`No such index ${index} in array`);
    }
    
    return Object.assign([...state], {
        [index]: updateChild(state[index]),
    });
};

const updateMap = <K, V>(state : Map<K, V>, step : LocationStep, updateChild : (value : V) => V) => {
    const mapUpdated = new Map(state);
    
    const key = step as K; // Assert that the step is a valid key
    
    if (!state.has(key)) {
        throw new TypeError($msg`Missing key ${key} in map ${state}`);
    }
    
    const value = state.get(key) as V; // Should exist (due to check above)
    
    mapUpdated.set(key, updateChild(value));
    return mapUpdated;
};


// ImmutableJS
const supportsSetIn = (obj : object) : obj is { setIn : (path : StatePath, value : unknown) => State } =>
    ObjectUtil.hasProp(obj, 'setIn') && typeof obj.setIn === 'function';

type ImmCompatible = {
    has : (step : LocationStep) => boolean,
    get : (step : LocationStep) => unknown,
    set : (step : LocationStep, value : unknown) => State,
};
const isImmCompatible = (obj : object) : obj is ImmCompatible =>
        'has' in obj && 'get' in obj && 'set' in obj;

const updateImmutable = (state : ImmCompatible, step : LocationStep, updateChild : (value : unknown) => unknown) => {
    const key = step;
    
    if (step.index) {
        const index = step.index;
        if (state.has(index)) {
            return state.set(index, updateChild(state.get(index)));
        } else {
            // FIXME: only possible if last step
            return state.set(index, updateChild(undefined));
        }
    } else {
        if (!state.has(key)) {
            throw new TypeError($msg`Missing key ${key} in map ${state}`);
        }
        
        const value = state.get(key);
        
        return state.set(key, updateChild(value));
    }
};


const updateIn = (state : State, path : StatePath, updater : Updater) : State => {
    // Base case: given an empty path, just update the current state
    if (path.length === 0) {
        const currentItem = state as Loadable<unknown>;
        return updater(currentItem);
    }
    
    const [step, ...tail] = path;
    
    // Reject updating a child of an empty state type. The user is expected to at the very least initialize
    // state to an object or some other supported data structure.
    if (state === undefined || state === null) {
        debugger;
        throw new TypeError($msg`Cannot set property in empty state, given ${state} [at ${path}]`);
    }
    
    if (!ObjectUtil.isObject(state)) {
        throw new TypeError($msg`Cannot set property on primitive, given ${state} [at ${path}]`);
    }
    
    // Immutable support
    /*
    if (supportsSetIn(state)) {
        return state.setIn(path, value);
    }
    */
    if (isImmCompatible(state)) {
        /*
        if (tail.length === 0) {
            return state.set(step, value);
        } else if (state.has(step)) {
            return state.set(step, setIn(state.get(step), tail, value));
        } else {
            // Cannot create steps "in between", would require us to know what constructor to use
            throw new TypeError($msg`No such state at ${step} [at ${path}]`);
        }
        */
        
        try {
            return updateImmutable(state, step, (value : unknown) => updateIn(value, tail, updater));
        } catch (e) {
            if (e instanceof TypeError) {
                // Add path information to exception message
                throw new TypeError(`${e.message} [at ${path}]`);
            } else {
                throw e;
            }
        }
    }
    
    if (ObjectUtil.isPlainObject(state)) {
        try {
            return updatePlainObject(state, step, (value : unknown) => updateIn(value, tail, updater));
        } catch (e) {
            if (e instanceof TypeError) {
                // Add path information to exception message
                throw new TypeError(`${e.message} [at ${path}]`);
            } else {
                throw e;
            }
        }
    } else if (Array.isArray(state)) {
        try {
            return updateArray(state, step, (value : unknown) => updateIn(value, tail, updater));
        } catch (e) {
            if (e instanceof TypeError) {
                // Add path information to exception message
                throw new TypeError(`${e.message} [at ${path}]`);
            } else {
                throw e;
            }
        }
    } else if (state instanceof Map) {
        try {
            return updateMap(state, step, (value : unknown) => updateIn(value, tail, updater));
        } catch (e) {
            if (e instanceof TypeError) {
                // Add path information to exception message
                throw new TypeError(`${e.message} [at ${path}]`);
            } else {
                throw e;
            }
        }
    } else {
        throw new TypeError($msg`Cannot update value of unknown state type ${state} [at ${path}]`);
    }
};


const configDefault = {
    prefix: 'lifecycle',
    trackRequests: false,
    requestsPath: ['requests'],
};
export default (configPartial : Partial<ReducerConfig> = {}) : Reducer<State> => {
    const config = merge(configDefault, configPartial) as ReducerConfig;
    
    return (state, action) => {
        // Only handle lifecycle actions
        if (!isLifecycleAction(action)) {
            return state;
        }
        
        // TOOD: update requests map
        //if (config.trackRequests) { ... }
        
        /*
        if ('item' in action) {
            //return setIn(state, action.path, action.item);
            return updateIn(state, action.path, <T>(_ : Loadable<T>) => action.item);
        }if ('update' in action && action.update !== undefined) {
            return updateIn(state, action.path, action.update);
        } else {
            return new TypeError(`Invalid action`);
        }
        */
        
        return updateIn(state, action.path, action.update);
    };
};
