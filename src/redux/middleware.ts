
import $msg from 'message-tag';
import { v4 as uuid } from 'uuid';
import merge from '../util/merge.js';

import type { Status } from '@mkrause/lifecycle-loader';
import { isLoadable, Loadable, status } from '@mkrause/lifecycle-loader';
import * as Location from '../loader/Location.js';
import type { StorableSpec, StorablePromise } from '../loader/StorablePromise.js';
import makeStorable, { isStorable, storableKey } from '../loader/StorablePromise.js';

import type { Store, AnyAction as ReduxAnyAction, Dispatch as ReduxDispatch } from 'redux';


export type Config = {
    prefix : string,
};
const configDefault : Config = {
    prefix: 'lifecycle', // TODO: allow a function instead for full control over the redux action type formatting
};

type StatusType = keyof Status;
type StoreItem = unknown;

export const lifecycleActionKey = Symbol('lifecycle.action');
export type LifecycleAction<S extends StatusType> = ReduxAnyAction & {
    [lifecycleActionKey] : null,
    type : string,
    state : S,
    path : Location.Location,
    requestId : string,
    
    item : S extends 'ready' ? StoreItem : undefined,
    reason : S extends 'failed' ? Error : undefined,
    
    // update : <T>(item : Loadable<T>) => Loadable<T>,
    update : <T>(item : T) => T,
    // update : (item : unknown) => unknown,
};
export const isLifecycleAction = <S extends StatusType>(action : ReduxAnyAction) : action is LifecycleAction<S> => {
    return lifecycleActionKey in action;
};

const locationToReduxActionType = (prefix : string, location : Location.Location) => {
    return `${prefix}:${Location.locationAsString(location)}`;
};

/*
const dispatchLoading = <T>(
        config : Config,
        store : Store,
        requestId : string,
        storableSpec : StorableSpec<T>,
        location : Location.Location
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


// Consolidate a current item (possibly `Loadable`) with an updated item (possible `Loadable`)
const updateItem = <T, U>(itemCurrent : T, status : Status, itemUpdated ?: undefined | U) => {
    if (status.loading === true) {
        if (isLoadable(itemUpdated)) {
            return Loadable.asLoading(itemUpdated);
        } else if (isLoadable(itemCurrent)) {
            if (typeof itemUpdated !== 'undefined') {
                return Loadable.update(itemCurrent, itemUpdated, { loading: true });
            } else {
                return Loadable.asLoading(itemCurrent);
            }
        } else {
            return itemCurrent; // No status to update, just leave as is
        }
    } else if (status.error instanceof Error) {
        if (isLoadable(itemUpdated)) {
            return Loadable.asFailed(itemUpdated, status.error);
        } else if (isLoadable(itemCurrent)) {
            if (typeof itemUpdated !== 'undefined') {
                return Loadable.update(itemCurrent, itemUpdated, { error: status.error });
            } else {
                return Loadable.asFailed(itemCurrent, status.error);
            }
        } else {
            return itemCurrent; // No status to update, just leave as is
        }
    } else if (status.ready) {
        if (typeof itemUpdated === 'undefined') {
            throw new TypeError($msg`Unable to update, expected item but given \`undefined\``);
        }
        
        if (isLoadable(itemUpdated)) {
            return Loadable.asReady(itemUpdated);
        } else if (isLoadable(itemCurrent)) {
            return Loadable.update(itemCurrent, itemUpdated, { ready: true });
        } else {
            return itemCurrent; // No status to update, just leave as is
        }
    }
    
    throw new TypeError($msg`Unable to update, incorrect status given: ${status}`);
};


const placeholderLoading = Loadable.asLoading(Loadable.Record());

export default (configPartial : Partial<Config> = {}) => {
    const config = merge(configDefault, configPartial) as Config;
    
    return (store : Store) => (next : ReduxDispatch<ReduxAnyAction>) => <A extends ReduxAnyAction, R>(action : A) => {
        // Only handle actions that are of type `StorablePromise`
        if (!isStorable(action)) {
            return next(action);
        }
        
        const storablePromise = action as StorablePromise<R>;
        
        const storableSpec = action[storableKey];
        
        if (storableSpec.operation === 'skip') {
            return storablePromise;
        }
        
        // Convert the given promise to a series of actions:
        // - loading
        // - ready OR failed
        
        const requestId = uuid();
        
        if (Location.isLocation(storableSpec.location)) {
            // If the location is known synchronously, dispatch a loading action
            
            const actionType = locationToReduxActionType(config.prefix, storableSpec.location);
            
            store.dispatch({
                [lifecycleActionKey]: null,
                type: `${actionType}:loading`,
                state: 'loading',
                requestId,
                path: storableSpec.location,
                
                update: <T>(itemCurrent : Loadable<T>) => {
                    if (typeof itemCurrent === 'undefined') { // TEMP: need a better way to detect nonexistence of item
                        return placeholderLoading;
                    }
                    
                    return updateItem(itemCurrent, { ready: false, loading: true, error: null });
                },
            });
        }
        
        Promise.resolve(storableSpec.location)
            .then(
                (location : Location.Location) => {
                    const actionType = locationToReduxActionType(config.prefix, location);
                    
                    storablePromise
                        .then(
                            result => {
                                store.dispatch({
                                    [lifecycleActionKey]: null,
                                    type: `${actionType}:ready`,
                                    state: 'ready',
                                    path: location,
                                    requestId,
                                    
                                    item: storableSpec.accessor(result),
                                    update: <T>(itemCurrent : T) => {
                                        const itemUpdated = storableSpec.accessor(result);
                                        
                                        return updateItem(
                                            itemCurrent,
                                            { ready: true, loading: false, error: null },
                                            itemUpdated,
                                        );
                                        
                                        /*
                                        // FIXME
                                        if (typeof item === 'undefined') {
                                            const itemUpdated = storableSpec.accessor(result) as T;
                                            return Loadable.asReady(Loadable.Record<T>(), itemUpdated);
                                        }
                                        
                                        if (typeof item !== 'object' || item === null || !(status in item)) {
                                            throw new TypeError($msg`Expected loadable item, given ${item}`);
                                        }
                                        const itemUpdated = storableSpec.accessor(result) as T;
                                        return Loadable.asReady(item, itemUpdated);
                                        */
                                    },
                                });
                            },
                            (reason : Error) => {
                                store.dispatch({
                                    [lifecycleActionKey]: null,
                                    type: `${actionType}:failed`,
                                    state: 'failed',
                                    path: location,
                                    requestId,
                                    
                                    reason,
                                    update: <T>(itemCurrent : T) => {
                                        return updateItem(
                                            itemCurrent,
                                            { ready: false, loading: false, error: reason },
                                        );
                                        
                                        /*
                                        // FIXME
                                        if (typeof item === 'undefined') {
                                            return Loadable.asFailed(Loadable.Record<T>(), reason);
                                        }
                                        
                                        if (typeof item !== 'object' || item === null || !(status in item)) {
                                            throw new TypeError($msg`Expected loadable item, given ${item}`);
                                        }
                                        Loadable.asFailed(item, reason);
                                        */
                                    },
                                });
                            },
                        );
                },
                (reason : Error) => {
                    throw new Error($msg`Unable to retrieve store location: ${reason}`);
                },
            );
        
        // Return the promise to the caller
        // Q: should we convert the promise to one which always resolves (never rejects) with a `status` here?
        return storablePromise;
    };
};
