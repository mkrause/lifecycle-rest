
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
    // The prefix used for lifecycle action types
    prefix : string,
    
    // Whether to keep track of all requests in a separate log (so that we can know the status of requests
    // without having to traverse the whole tree).
    trackRequests : boolean,
    requestsPath : StatePath, // The path at which to store tracked requests
};

/*
const supportsSetIn = (obj : object) : obj is { setIn : (path : StatePath, value : unknown) => State } =>
    ObjectUtil.hasProp(obj, 'setIn') && typeof obj.setIn === 'function';

const supportsHasGetSet = (obj : object) : obj is {
        has : (step : LocationStep) => boolean,
        get : (step : LocationStep) => unknown,
        set : (step : LocationStep, value : unknown) => State,
    } =>
        'has' in obj && 'get' in obj && 'set' in obj;

// Immutable support
} else if (supportsSetIn(state)) {
    return state.setIn(path, value);
} else if (supportsHasGetSet(state)) {
    if (tail.length === 0) {
        return state.set(step, value);
    } else if (state.has(step)) {
        return state.set(step, setIn(state.get(step), tail, value));
    } else {
        // Cannot create steps "in between", would require us to know what constructor to use
        throw new TypeError($msg`No such state at ${step} [at ${path}]`);
    }
*/

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
    mapUpdated.set(step, updateChild(state.get(step)));
    return mapUpdated;
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
        throw new TypeError($msg`Cannot set property in empty state, given ${state} [at ${path}]`);
    }
    
    if (!ObjectUtil.isObject(state)) {
        throw new TypeError($msg`Cannot set property on primitive, given ${state} [at ${path}]`);
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


const configDefaults = { prefix: 'lifecycle', trackRequests: false, requestsPath: ['requests'] };
export default (_config : Partial<ReducerConfig> = {}) : Reducer<State> => {
    const config = merge(configDefaults, _config) as ReducerConfig;
    
    return (state, action) => {
        if (!isLifecycleAction(action)) {
            return state;
        }
        
        // TOOD: update requests map
        //if (config.trackRequests) { ... }
        
        if ('item' in action) {
            //return setIn(state, action.path, action.item);
            return updateIn(state, action.path, <T>(_ : Loadable<T>) => action.item);
        } else if ('update' in action && action.update !== undefined) {
            return updateIn(state, action.path, action.update);
        } else {
            return new TypeError(`Invalid action`);
        }
    };
};
