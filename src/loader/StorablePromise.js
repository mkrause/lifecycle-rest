// @flow

import { LoadablePromise } from '@mkrause/lifecycle-loader';
import type { Loadable } from '@mkrause/lifecycle-loader';


type Showable = string | number
    | { toString : () => string }
    | { toJSON : () => mixed };

export type Step = string | Showable;

type Result = mixed;

export type Spec = {
    // The location where this item is to be stored. Each "step" is either a string (object key), or
    // could be anything else (e.g. index into a hash map) as long as we can convert it to a string.
    location : Array<Step>,
    
    // Function that transforms the promise result to the item that we can store
    accessor : Result => Loadable,
    
    // The operation to perform on the store
    // Note: "clearing" an item can be done by updating with an invalidated loadable (empty value).
    operation :
        | 'skip' // Do nothing
        | 'put' // Place the item in the store wholesale
        | 'merge' // Merge the given item with the existing one
        | 'update' // Apply a function that takes the current value and returns an updated version
        ;
};

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
export default class StorablePromise extends LoadablePromise {
    spec : Spec;
    
    // Set the species to regular `Promise`, so that `then()` chaining will not try to create
    // a new StorablePromise (which fails due to lack of information given to the constructor).
    static [Symbol.species] = Promise;
    
    // Create from existing promise
    static from(item : Loadable, spec : Spec, promise : Promise<Loadable>) {
        return new StorablePromise(
            (resolve, reject) => { promise.then(resolve, reject); },
            item,
            spec
        );
    }
    
    constructor(fulfill : Fulfill, item : Loadable, spec : Spec = {}) {
        super(fulfill, item);
        
        this.spec = { ...specDefault, ...spec };
    }
    
    // Convert to a plain promise
    asPromise() : Promise<Loadable> {
        return new Promise((resolve, reject) => this.then(resolve, reject));
    }
}
