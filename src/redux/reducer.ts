
import match from 'case-match';
import $msg from 'message-tag';

import merge from '../util/merge';
import * as ObjectUtil from '../util/ObjectUtil';

import { Reducer } from 'redux';
import { Loadable } from '@mkrause/lifecycle-loader';
import * as Location from '../loader/Location';
import { isLifecycleAction } from './middleware';


type State = unknown;

type StatePath = Array<Location.Step>;

type ReducerConfig = {
    // The prefix used for lifecycle action types (should match the prefix configured in the middleware)
    prefix : string,
    
    // Whether to keep track of all requests in a separate log (so that we can know the status of requests
    // without having to traverse the whole tree).
    trackRequests : boolean,
    requestsPath : StatePath, // The path at which to store tracked requests
};


type Updater = <T>(item : Loadable<T>) => undefined | Loadable<T>;


// `updatePlainObjectAsRecord` treats objects as closed records, `updatePlainObject` below allows objects to be
// treated as dictionaries as well. Swap out either based on what we want to allow.
/*
const updatePlainObjectAsRecord = (state : object, step : Location.Step, updateChild : (value : unknown) => unknown) => {
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
*/
const updatePlainObject = (state : object, step : Location.Step, updateChild : (value : unknown) => unknown) => {
    // Step must be a string (or number), because we're using it to index into a plain JS object
    if (!Location.isStep(step)) {
        throw new TypeError($msg`Invalid step ${step}`);
    }
    
    let propKey : PropertyKey;
    if (Location.isIndexStep(step)) {
        propKey = step.index;
    } else {
        propKey = step;
    }
    
    const propUpdated = ObjectUtil.hasOwnProp(state, propKey)
        ? updateChild(state[propKey])
        : updateChild(undefined);
    if (typeof propUpdated === 'undefined') {
        // Delete property
        const stateUpdated : any = { ...state };
        delete stateUpdated[propKey];
        return stateUpdated;
    } else {
        return { ...state, [propKey]: propUpdated };
    }
};

const updateArray = (state : Array<unknown>, step : Location.Step, updateChild : (value : unknown) => unknown) => {
    let stepIndex: unknown = step;
    if (Location.isIndexStep(step)) {
        stepIndex = step.index;
    }
    
    let index : number;
    if (typeof stepIndex === 'number') {
        index = stepIndex;
    } else if (typeof stepIndex === 'string') {
        if (!/^[0-9]+$/.test(stepIndex)) {
            throw new TypeError($msg`Trying to set in array, but given non-numerical index ${stepIndex}`);
        }
        index = parseInt(stepIndex);
    } else {
        throw new TypeError($msg`Trying to set in array, but given non-numerical index ${stepIndex}`);
    }
    
    if (!(index in state)) {
        throw new TypeError($msg`No such index ${index} in array`);
    }
    
    const entryUpdated = updateChild(state[index]);
    if (typeof entryUpdated === 'undefined') {
        // Delete array entry
        // TODO: should we slice out this array entry altogether?
        return Object.assign([...state], {
            [index]: undefined,
        });
    } else {
        return Object.assign([...state], {
            [index]: entryUpdated,
        });
    }
};

const updateMap = <K, V>(state : Map<K, V>, step : Location.Step, updateChild : (value : V) => V) => {
    const mapUpdated = new Map(state);
    
    const key = step as unknown as K; // Assert that the step is a valid key
    
    if (!state.has(key)) {
        throw new TypeError($msg`Missing key ${key} in map ${state}`);
    }
    
    const value = state.get(key) as V; // Should exist (due to check above)
    
    const entryUpdated = updateChild(value);
    if (typeof entryUpdated === 'undefined') {
        mapUpdated.delete(key);
    } else {
        mapUpdated.set(key, entryUpdated);
        return mapUpdated;
    }
};


// ImmutableJS
const supportsSetIn = (obj : object) : obj is { setIn : (path : StatePath, value : unknown) => State } =>
    ObjectUtil.hasProp(obj, 'setIn') && typeof obj.setIn === 'function';

type ImmCompatible = {
    has : (step : Location.Step) => boolean,
    get : (step : Location.Step) => unknown,
    set : (step : Location.Step, value : unknown) => State,
};
const isImmCompatible = (obj : object) : obj is ImmCompatible =>
        'has' in obj && 'get' in obj && 'set' in obj;

const updateImmutable = (state : ImmCompatible, step : Location.Step, updateChild : (value : unknown) => unknown) => {
    const key = step;
    
    if (Location.isIndexStep(step)) {
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
        throw Object.assign(
            new TypeError($msg`Cannot set property in empty state, given ${state}`),
            { location: path },
        );
    }
    
    if (!ObjectUtil.isObject(state)) {
        throw Object.assign(
            new TypeError($msg`Cannot set property on primitive, given ${state}`),
            { location: path },
        );
    }
    
    // Handle items that are Loadable (i.e. have a status associated)
    if (Loadable.isLoadable(state)) {
        const stateItem = Loadable.getItem(state);
        
        if (!Loadable.getStatus(state).ready) {
            // Special case: indexing into object
            // FIXME: need better handling for this
            if (typeof stateItem === 'object' && stateItem !== null && Location.isIndexStep(step)) {
                // Continue
            } else {
                throw Object.assign(
                    new TypeError($msg`Trying to set property on state that is not yet loaded`),
                    { location: path },
                );
            }
        }
        
        // @ts-ignore
        const stateUpdated = updateIn(stateItem, path, updater);
        
        // TODO: what do we do with the status? May need to be updated/invalidated
        return Loadable.update(state, stateUpdated, {
            //ready: false,
            //loading: false,
            //error: null,
        });
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
            throw new TypeError($msg`No such state at ${step}`);
        }
        */
        
        try {
            return updateImmutable(state, step, (value : unknown) => updateIn(value, tail, updater));
        } catch (e) {
            if (e instanceof TypeError) {
                // Add location information to exception message (if not added already)
                throw Object.assign(e, {
                    // @ts-ignore
                    location: e.location ?? path,
                });
            }
            throw e;
        }
    }
    
    if (ObjectUtil.isPlainObject(state)) {
        try {
            return updatePlainObject(state, step, (value : unknown) => updateIn(value, tail, updater));
        } catch (e) {
            if (e instanceof TypeError) {
                // Add location information to exception message (if not added already)
                throw Object.assign(e, {
                    // @ts-ignore
                    location: e.location ?? path,
                });
            }
            throw e;
        }
    } else if (Array.isArray(state)) {
        try {
            return updateArray(state, step, (value : unknown) => updateIn(value, tail, updater));
        } catch (e) {
            if (e instanceof TypeError) {
                // Add location information to exception message (if not added already)
                throw Object.assign(e, {
                    // @ts-ignore
                    location: e.location ?? path,
                });
            }
            throw e;
        }
    } else if (state instanceof Map) {
        try {
            return updateMap(state, step, (value : unknown) => updateIn(value, tail, updater));
        } catch (e) {
            if (e instanceof TypeError) {
                // Add location information to exception message (if not added already)
                throw Object.assign(e, {
                    // @ts-ignore
                    location: e.location ?? path,
                });
            }
            throw e;
        }
    } else {
        throw Object.assign(
            new TypeError($msg`Cannot update value of unknown state type ${state}`),
            { location: path },
        );
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
        
        try {
            return updateIn(state, action.path, action.update);
        } catch (e) {
            if (e.location && Location.isLocation(e.location)) {
                e.message += ` [at ${Location.locationAsString(e.location)}]`;
            }
            throw e;
        }
    };
};
