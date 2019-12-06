
import $msg from 'message-tag';

//import { LoadablePromise } from '@mkrause/lifecycle-loader';
//import type { Loadable } from '@mkrause/lifecycle-loader';


export const isStorableKey = Symbol('storable');

export const isStorable = <T>(value : unknown) : value is StorablePromise<T> => {
    return typeof value === 'object' && value !== null && isStorableKey in value;
};


type Showable = string | number
    | { toString : () => string }
    | { toJSON : () => unknown };

export type Step = string | Showable;

export const stepToString = (step : Step) : string => {
    if (typeof step === 'string') {
        return step;
    } else if (typeof step === 'number') {
        return String(step);
    } else if ('toJSON' in step) {
        // Note: the `toJSON` if branch must come before the `toString` one, otherwise TypeScript (as of v3.7) seems
        // to have a bug where it infers the type as `never` after the `toString` case.
        return JSON.stringify(step.toJSON());
    } else if ('toString' in step) {
        return step.toString();
    } else {
        throw new TypeError($msg`Unexpected step type ${step}`);
    }
};


type Item = unknown; // TODO

export type StorableSpec<T> = {
    // The location where this item is to be stored. Each "step" is either a string (object key), or
    // could be anything else (e.g. index into a hash map) as long as we can convert it to a string.
    location : Array<Step>,
    
    getKey : () => null | string,
    
    // Function that transforms the promise result to the item that we can store
    accessor : (result : T) => Item,
    
    // The operation to perform on the store
    // Note: "clearing" an item can be done by updating with an invalidated loadable (empty value).
    operation :
        | 'skip' // Do nothing
        | 'put' // Place the item in the store wholesale
        | 'merge' // Merge the given item with the existing one
        | 'update' // Apply a function that takes the current value and returns an updated version
        ;
};

export type StorablePromise<T> = Promise<T> & {
    [isStorableKey] : null,
    
    // Needed in order to be able to dispatch a storable promise in redux (i.e. must be an action)
    type : typeof isStorableKey,
    
    spec : StorableSpec<T>,
};

const specDefault = {
    location: [],
    accessor: <T>(result : T) => result,
    operation: 'put',
};

export const makeStorable = <T>(promise : Promise<T>, spec : StorableSpec<T>) : StorablePromise<T> => {
    const specWithDefaults = { ...specDefault, ...spec };
    
    const storablePromise : StorablePromise<T> = Object.assign(promise, {
        [isStorableKey]: null,
        type: isStorableKey as typeof isStorableKey, // `as` needed to make this a `unique symbol`
        spec: specWithDefaults,
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
