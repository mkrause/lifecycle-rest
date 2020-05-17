// @flow

import { status, Loadable } from '@mkrause/lifecycle-loader';
import { type Loadable as LoadableT } from '@mkrause/lifecycle-loader';


export class LoadError extends Error {
    constructor(reason : mixed, item : LoadableT) {
        let message = '';
        if (reason instanceof Error) {
            message = reason.message;
        } else {
            message = String(message);
        }
        
        super('Loading failed: ' + message);
        this.item = item;
    }
}

type Fulfill = (mixed => void, mixed => void) => void;

// Extended version of `Promise` that works with loadable items.
// Note: although the ES6 spec allows extending Promise, babel by default does not support
// it. `transform-builtin-extend` can be used to enable this.
// https://github.com/babel/babel/issues/1120
// 
// Note: should extending Promise become an issue, we could always fall back to just implementing
// the "thenable" interface (i.e. just a method named `then()`).
export class LoadablePromise extends Promise {
    // Set the species to regular `Promise`, so that `then()` chaining will not try to create
    // a new LoadablePromise (which fails due to lack of information given to the constructor).
    static [Symbol.species] = Promise;
    
    // Create from existing promise
    static from(item : LoadableT, promise : typeof Promise) : LoadablePromise {
        return new LoadablePromise((resolve, reject) => {
            promise.then(resolve, reject);
        }, item);
    }
    
    item = null;
    
    constructor(fulfill : Fulfill, item : LoadableT) {
        super((resolve, reject) => {
            // FIXME: we assume support for status methods (like `asReady`) below, but these are not
            // guaranteed to exist
            fulfill(
                value => { resolve(Loadable.asReady(item, value)); },
                reason => { reject(new LoadError(reason, Loadable.asFailed(item, reason))); },
            );
        });
        
        this.item = item;
    }
    
    // Similar to `then()`, but will be called:
    // - Once, synchronously, with the item in loading state, *if* the item is not already
    //   fulfilled synchronously.
    // - Second, when the item is fulfilled (resolved or rejected), with the item in the
    //   corresponding state (ready/failed).
    // In addition, `subscribe` does not distinguish between resolved/reject, it only takes
    // one function which is called regardless of the result (check the `status` instead).
    subscribe(subscriber : LoadableT => void) : LoadablePromise {
        let fulfilled = false;
        
        const promise = this.then(
            itemReady => {
                fulfilled = true;
                subscriber(itemReady);
            },
            itemFailed => {
                fulfilled = true;
                subscriber(itemFailed);
            },
        );
        
        // FIXME: likely doesn't work as expected. `fulfilled` should never be true here, because `.then()`
        // is always scheduled async. Possible solution: run the `fulfill` function ourselves and extract the
        // value synchronously.
        if (!fulfilled) {
            subscriber(Loadable.asLoading(this.item));
        }
        
        return this;
    }
}
