
import $msg from 'message-tag';
import * as ObjectUtil from '../util/ObjectUtil.js';

import type { Action as ReduxAction, Store } from 'redux';

import * as Location from './Location.js';


/*
Extension of `Promise`, where the promise object also carries instructions on how the promise result is intended
to be stored in a (redux) store.
*/

export const storableKey = Symbol('storable');

// Spec for storing a resource of type `R` in the store as an item of type `T`
export type StorableSpec<R, T = unknown> = {
    // The location where this item is to be stored. Each "step" is either a string (object key), or could be
    // anything else (e.g. index into a hash map) as long as we can convert it to a string.
    // Can be a function, if the location is not known ahead of time (e.g. it depends on a dynamically created ID).
    location : Location.Location | ((result : undefined | R, store: Store) => Location.Location),
    
    // XXX alternatively, we could enforce `location` to always be known (no promise) up until the last step, and
    // then have a separate `getKey` function that should give the last step for a resolved promise.
    //getKey : () => null | string,
    
    // Function that transforms the promise result to the item that we can store
    accessor : (result : R) => T,
    
    // The operation to perform on the store
    operation :
        | 'skip' // Do nothing
        | 'clear' // Remove the current item (by replacing it with an empty/invalidated item)
        | 'put' // Replace the current item with the given one
        | 'merge' // Merge the current item with the given one (e.g. for collections to merge entries)
        | 'update', // Apply a function that takes the current value and returns an updated version
};

export type StorablePromise<R> = Promise<R>
    & { [storableKey] : StorableSpec<R> }
    // `ReduxAction` needed in order to be able to dispatch a storable promise in redux (i.e. it must be an action)
    & ReduxAction<typeof storableKey>;

export const isStorable = <R>(value : unknown) : value is StorablePromise<R> => {
    if (!ObjectUtil.isObject(value)) { return false; }
    
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
    accessor: <R>(result : R) : R => result,
    operation: 'put',
};

export const makeStorable = <R>(promise : Promise<R>, spec : Partial<StorableSpec<R>>) : StorablePromise<R> => {
    const specWithDefaults = { ...specDefault, ...spec } as StorableSpec<R>;
    
    const promiseCopy = promise.then(); // Copy promise before mutating it
    const storablePromise : StorablePromise<R> = Object.assign(promiseCopy, {
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
export default class StorablePromise<R> extends Promise<R> {
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
