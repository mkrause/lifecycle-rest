
import match from 'case-match';
import $msg from 'message-tag';

import merge from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';

import { Reducer } from 'redux';
import { Step as LocationStep } from '../loader/StorablePromise.js';
import { isLifecycleAction } from './middleware.js';


type State = unknown;

type StatePath = Array<LocationStep>;

type ReducerConfig = {
    prefix : string,
    trackRequests : boolean,
    requestsPath : StatePath,
};

const supportsSetIn = (obj : object) : obj is { setIn : (path : StatePath, value : unknown) => State } =>
    ObjectUtil.hasProp(obj, 'setIn') && typeof obj.setIn === 'function';

const supportsHasGetSet = (obj : object) : obj is {
        has : (step : LocationStep) => boolean,
        get : (step : LocationStep) => unknown,
        set : (step : LocationStep, value : unknown) => State,
    } =>
        ObjectUtil.hasProp(obj, 'has')
            && ObjectUtil.hasProp(obj, 'get')
            && ObjectUtil.hasProp(obj, 'set');

const setIn = <V>(state : State, path : StatePath, value : V) : State => {
    if (path.length === 0) {
        return value;
    }
    
    const [step, ...tail] = path;
    
    // Reject updating a child of an empty state type. The user is expected to at the very least initialize
    // state to an object or some other supported data structure.
    if (state === undefined || state === null) {
        throw new TypeError($msg`Cannot set value in empty state, given ${state} [at ${path}]`);
    }
    
    if (ObjectUtil.isObject(state)) {
        // Note: check plain object first, so that we do not accidentally match a `get`/`set` property
        // on a plain object
        if (ObjectUtil.isPlainObject(state)) {
            if (tail.length === 0) {
                return { ...state, [step]: value };
            } else if (ObjectUtil.hasOwnProp(state, step)) {
                return { ...state, [step]: setIn(state[step], tail, value) };
            } else {
                // Refuse to create steps "in between". We could choose to create new objects with
                // just the single step as key, but unless we see a clear use case, we will reject.
                throw new TypeError($msg`No such state at ${step} [at ${path}]`);
            }
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
        }
    }
    
    if (Array.isArray(state)) {
        let index : number;
        if (typeof step === 'number') {
            index = step;
        } else if (typeof step === 'string') {
            if (!/^[0-9]+$/.test(step)) {
                throw new TypeError($msg`Trying to set in array, but given non-numerical index ${step} [at ${path}]`);
            }
            index = parseInt(step);
        } else {
            throw new TypeError($msg`Trying to set in array, but given non-numerical index ${step} [at ${path}]`);
        }
        
        const stateShallowCopy = [...state];
        stateShallowCopy[index] = value;
        return stateShallowCopy;
    }
    
    throw new TypeError($msg`Cannot update value of unknown state type ${state} [at ${path}]`);
};


const configDefaults = { prefix: 'lifecycle', trackRequests: false, requestsPath: ['requests'] };
export default (_config : Partial<ReducerConfig> = {}) : Reducer<State> => {
    const config = merge(configDefaults, _config) as ReducerConfig;
    
    return (state, action) => {
        if (!isLifecycleAction(action)) {
            return state;
        }
        
        //
        // TOOD: update requests map
        //
        
        return setIn(state, action.path, action.item);
    };
};
