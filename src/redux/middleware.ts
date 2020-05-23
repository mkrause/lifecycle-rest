
import $msg from 'message-tag';
import { v4 as uuid } from 'uuid';
import merge from '../util/merge.js';

import { Loadable, status } from '@mkrause/lifecycle-loader';
import type { Showable, StorableSpec, StorablePromise, Step as LocationStep } from '../loader/StorablePromise.js';
import makeStorable, { showableToString, isStorable, storableKey } from '../loader/StorablePromise.js';

import type { Store, AnyAction as ReduxAnyAction, Dispatch as ReduxDispatch } from 'redux';


type Location = Array<LocationStep>;

const locationToString = (location : Location) => {
    return location
        .map(step => {
            // FIXME
            if (step.index) {
                return showableToString(step.index);
            } else {
                return step;
            }
        })
        .join('.');
};

export type Config = {
    prefix : string,
};
const configDefault : Config = {
    prefix: 'lifecycle',
};

export const lifecycleActionKey = Symbol('lifecycle.action');
export type LifecycleAction = {
    [lifecycleActionKey] : null,
    type : string,
    path : Location,
    state : 'loading' | 'failed' | 'ready',
    requestId : string,
    
    item ?: unknown,
    reason ?: Error,
    
    update : <T>(item : Loadable<T>) => Loadable<T>,
    // update : (item : unknown) => unknown,
};
export const isLifecycleAction = (action : ReduxAnyAction) : action is LifecycleAction => {
    return lifecycleActionKey in action;
};

const locationToReduxActionType = (prefix : string, location : Location) => {
    return `${prefix}:${locationToString(location)}`;
}

/*
const dispatchLoading = <T>(
        config : Config,
        store : Store,
        requestId : string,
        storableSpec : StorableSpec<T>,
        location : Location
    ) => {
        const actionType = locationToReduxActionType(config.prefix, location);
        
        store.dispatch({
            [lifecycleActionKey]: null,
            type: `${actionType}:loading`,
            requestId,
            path: location,
            state: 'loading',
            
            update: <T>(item : Loadable<T>) => {
                if (!(status in item)) { throw new TypeError($msg`Expected loadable item, given ${item}`); }
                return Loadable.asLoading(item);
            },
        });
    };
*/

export default (configPartial : Partial<Config> = {}) => {
    const config = merge(configDefault, configPartial) as Config;
    
    return (store : Store) => (next : ReduxDispatch<ReduxAnyAction>) => (action : ReduxAnyAction) => {
        // Only handle actions that are of type `StorablePromise`
        if (!isStorable(action)) {
            return next(action);
        }
        
        const storablePromise = action;
        
        const storableSpec = action[storableKey];
        
        // Convert the given promise to a series of actions:
        // - loading
        // - ready OR failed
        
        const requestId = uuid();
        
        if (Array.isArray(storableSpec.location)) {
            // If the location is known synchronously, dispatch a loading action
            
            const actionType = locationToReduxActionType(config.prefix, storableSpec.location);
            
            store.dispatch({
                [lifecycleActionKey]: null,
                type: `${actionType}:loading`,
                requestId,
                path: storableSpec.location,
                state: 'loading',
                
                update: <T>(item : Loadable<T>) => {
                    // FIXME
                    if (typeof item === 'undefined') {
                        return Loadable.asLoading<T>(Loadable());
                    };
                    
                    if (storableSpec.operation === 'skip') {
                        return item;
                    }
                    
                    if (typeof item !== 'object' || item === null || !(status in item)) {
                        throw new TypeError($msg`Expected loadable item, given ${item}`);
                    }
                    return Loadable.asLoading(item);
                },
            });
        }
        
        Promise.resolve(storableSpec.location)
            .then(
                location => {
                    const actionType = locationToReduxActionType(config.prefix, location);
                    
                    storablePromise
                        .then(
                            result => {
                                store.dispatch({
                                    [lifecycleActionKey]: null,
                                    type: `${actionType}:ready`,
                                    path: location,
                                    state: 'ready',
                                    requestId,
                                    
                                    item: storableSpec.accessor(result),
                                    update: <T>(item : Loadable<T>) => {
                                        // FIXME
                                        if (typeof item === 'undefined') {
                                            const itemUpdated = storableSpec.accessor(result) as T;
                                            return Loadable.asReady<T>(Loadable(), itemUpdated);
                                        };
                                        
                                        if (storableSpec.operation === 'skip') {
                                            return item;
                                        }
                                        
                                        if (typeof item !== 'object' || item === null || !(status in item)) {
                                            throw new TypeError($msg`Expected loadable item, given ${item}`);
                                        }
                                        const itemUpdated = storableSpec.accessor(result) as T;
                                        return Loadable.asReady<T>(item, itemUpdated);
                                    },
                                });
                            },
                            reason => {
                                store.dispatch({
                                    [lifecycleActionKey]: null,
                                    type: `${actionType}:failed`,
                                    path: location,
                                    state: 'failed',
                                    requestId,
                                    
                                    reason,
                                    update: <T>(item : Loadable<T>) => {
                                        // FIXME
                                        if (typeof item === 'undefined') {
                                            const itemUpdated = storableSpec.accessor(result) as T;
                                            return Loadable.asFailed<T>(Loadable());
                                        };
                                        
                                        if (storableSpec.operation === 'skip') {
                                            return item;
                                        }
                                        
                                        if (typeof item !== 'object' || item === null || !(status in item)) {
                                            throw new TypeError($msg`Expected loadable item, given ${item}`);
                                        }
                                        Loadable.asFailed(item, reason);
                                    },
                                });
                            },
                        );
                },
                reason => {
                    throw new Error($msg`Unable to retrieve store location: ${reason}`);
                },
            );
        
        // Return the promise to the caller
        // Q: should we convert the promise to one which always resolves (never rejects) with a `status` here?
        return storablePromise;
    };
};
