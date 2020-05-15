
import $msg from 'message-tag';
import * as ObjectUtil from '../util/ObjectUtil.js';

import /*type*/ { Action as ReduxAction } from 'redux';


/*
Extension of Promise, where the promise object also carries instructions on how the promise result is to be
stored in a (redux) store.
*/

export type Showable = string | number
    | { toString : () => string }
    | { toJSON : () => unknown };

export const showableToString = (showable : Showable) : string => {
    if (typeof showable === 'string') {
        return showable;
    } else if (typeof showable === 'number') {
        return String(showable);
    } else if ('toJSON' in showable) {
        // Note: the `toJSON` if branch must come before the `toString` one, otherwise TypeScript (as of v3.7) seems
        // to have a bug where it infers the type as `never` after the `toString` case.
        return JSON.stringify(showable);
    } else if ('toString' in showable) {
        return showable.toString();
    } else {
        throw new TypeError($msg`Invalid argument given, unable to convert to string: ${showable}`);
    }
};


export type Step = string | Showable;

export const stepToString = (step : Step) : string => {
    return showableToString(step);
};


type Item = unknown; // TODO

export const storableKey = Symbol('storable');

export type StorableSpec<T> = {
    // The location where this item is to be stored. Each "step" is either a string (object key), or
    // could be anything else (e.g. index into a hash map) as long as we can convert it to a string.
    // Can be a promise, if the location is not known ahead of time (e.g. depends on a dynamically created ID).
    location : Array<Step> | Promise<Array<Step>>,
    
    // XXX alternatively, we could enforce `location` to always be known (no promise) up until the last step, and
    // then have a separate `getKey` function that should give the last step for a resolved promise.
    //getKey : () => null | string,
    
    // Function that transforms the promise result to the item that we can store
    accessor : (result : T) => Item,
    
    // The operation to perform on the store
    operation :
        | 'skip' // Do nothing
        | 'clear' // Remove the current item (by replacing it with an empty/invalidated item)
        | 'put' // Replace the current item with the given one
        | 'merge' // Merge the current item with the given one
        | 'update', // Apply a function that takes the current value and returns an updated version
};

export type StorablePromise<T> = Promise<T>
    // Needed in order to be able to dispatch a storable promise in redux (i.e. must be an action)
    & ReduxAction<typeof storableKey>
    & { [storableKey] : StorableSpec<T> };

export const isStorable = <T>(value : unknown) : value is StorablePromise<T> => {
    if (typeof value !== 'object' || value === null) { return false; }
    
    if (!ObjectUtil.hasProp(value, 'type') || value.type !== storableKey) {
        return false;
    }
    
    if (!ObjectUtil.hasProp(value, storableKey)) {
        return false;
    }
    
    return true;
};


const specDefault = {
    location: [],
    accessor: <T>(result : T) => result,
    operation: 'put',
};

export const makeStorable = <T>(promise : Promise<T>, spec : Partial<StorableSpec<T>>) : StorablePromise<T> => {
    const specWithDefaults = { ...specDefault, ...spec } as StorableSpec<T>;
    
    const promiseCopy = promise.then(); // Copy promise before mutating it
    const storablePromise : StorablePromise<T> = Object.assign(promiseCopy, {
        // Make this promise into a valid Redux action
        type: storableKey as typeof storableKey, // `as` needed to make this a `unique symbol`
        
        // Add the spec
        [storableKey]: specWithDefaults,
    });
    return storablePromise;
};

export default makeStorable;




/*
type Fulfill = (
        resolve : Loadable => void,
        reject : Error => void
    ) => void;

const specDefault = {
    location: [],
    accessor: (result : Result) => result,
    operation: 'put',
};

// Promise for some item to be stored in a (global) store. Includes a specification that describes
// how it's intended to be stored.
export default class StorablePromise<T> extends Promise<T> {
    spec : Spec;
    
    // Set the species to regular `Promise`, so that `then()` chaining will not try to create
    // a new StorablePromise (which fails due to lack of information given to the constructor).
    static [Symbol.species] = Promise;
    
    // Create from existing promise
    // static from(item : Loadable, spec : Spec, promise : Promise<Loadable>) {
    //     return new StorablePromise(
    //         (resolve, reject) => { promise.then(resolve, reject); },
    //         item,
    //         spec
    //     );
    // }
    
    constructor(fulfill : Fulfill, item : Loadable, spec : Spec = {}) {
        super(fulfill, item);
        
        this.spec = { ...specDefault, ...spec };
    }
    
    // Convert to a plain promise
    asPromise() : Promise<Loadable> {
        return new Promise((resolve, reject) => this.then(resolve, reject));
    }
}
*/
