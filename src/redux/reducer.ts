// @ts-nocheck

import match from 'case-match';
import $msg from 'message-tag';

import merge from '../util/merge.js';
import { isPlainObject } from '../util/ObjectUtil.js';


// type Step = string;
// type Path = Array<Step>;

const setIn = (state, path /*: Path*/, value) => {
    if (path.length === 0) {
        return value;
    }
    
    const [step, ...tail] = path;
    
    // Reject updating a child of an empty state type. The user is expected to at the very least initialize
    // state to an object or some other supported data structure.
    if (state === undefined || state === null) {
        throw new TypeError($msg`Cannot set value in empty state, given ${state} [at ${path}]`);
    }
    
    if (typeof state === 'object') { // Note: already checked to not be `null`
        // Note: check plain object first, so that we do not accidentally match a `get`/`set` property
        // on a plain object
        if (isPlainObject(state)) {
            if (tail.length === 0) {
                return { ...state, [step]: value };
            } else if (Object.prototype.hasOwnProperty.call(state, step)) {
                return { ...state, [step]: setIn(state[step], tail, value) };
            } else {
                // Refuse to create steps "in between". We could chose to create new objects with
                // just the single step as key, but unless we see a clear use case we will reject.
                throw new TypeError($msg`No such state at ${step} [at ${path}]`);
            }
        } else if ('setIn' in state) {
            return state.setIn(path, value);
        } else if ('has' in state && 'get' in state && 'set' in state) {
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
        let index = step;
        if (typeof step === 'string') {
            if (!/^[0-9]+$/.test(step)) {
                throw new TypeError($msg`Trying to set in array, but given non-numerical index ${step} [at ${path}]`);
            }
            index = parseInt(step);
        }
        
        const stateShallowCopy = [...state];
        stateShallowCopy[index] = value;
        return stateShallowCopy;
    }
    
    throw new TypeError($msg`Cannot update value of unknown state type ${state} [at ${path}]`);
};

export default (_config = {}) => {
    const configDefaults = { prefix: 'lifecycle', trackRequests: false, requestsPath: ['requests'] };
    const config = merge(configDefaults, _config);
    
    return (state, action) => {
        if (!action.type.startsWith(`${config.prefix}:`)) {
            return state;
        }
        
        //
        // TOOD: update requests map
        //
        
        return setIn(state, action.path, action.item);
    };
};
