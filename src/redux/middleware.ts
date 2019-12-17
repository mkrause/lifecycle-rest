
import $msg from 'message-tag';
import uuid from 'uuid';
import merge from '../util/merge.js';

import { Loadable, status } from '@mkrause/lifecycle-loader';
import makeStorable, { isStorable, StorablePromise, Step as LocationStep } from '../loader/StorablePromise.js';

import { Store, AnyAction as ReduxAnyAction, Dispatch as ReduxDispatch } from 'redux';


const locationToString = (location : LocationStep[]) => {
    return location.join('.');
};

type Config = {
    prefix ?: string,
};
const configDefault : Config = {
    prefix: 'lifecycle',
};

export const lifecycleActionKey = Symbol('lifecycle.action');
export type LifecycleAction = {
    [lifecycleActionKey] : null,
    type : string,
    path : LocationStep[],
    state : 'loading' | 'failed' | 'ready',
    requestId : string,
    
    item ?: unknown,
    
    //update ?: <T>(item : Loadable<T>) => Loadable<T>,
    update ?: (item : unknown) => unknown,
};
export const isLifecycleAction = (action : ReduxAnyAction) : action is LifecycleAction => {
    return lifecycleActionKey in action;
};

export default (_config : Config = {}) => {
    const config = merge(configDefault, _config);
    
    return (store : Store) => (next : ReduxDispatch<ReduxAnyAction>) => (action : ReduxAnyAction) => {
        // Only handle actions that are of type StorablePromise
        if (!isStorable(action)) {
            return next(action);
        }
        
        const storablePromise = action;
        
        const storableSpec = action.spec;
        
        const actionType = `${config.prefix}:${locationToString(storableSpec.location)}`;
        
        const requestId = uuid();
        
        
        // Convert the given promise to a series of actions:
        // - loading
        // - ready OR failed
        
        store.dispatch({
            [lifecycleActionKey]: null,
            type: `${actionType}:loading`,
            path: storableSpec.location,
            //key: getKey(), // TODO
            state: 'loading',
            requestId,
            
            update: <T>(item : Loadable<T>) => {
                if (!(status in item)) { throw new TypeError($msg`Expected loadable item, given ${item}`); }
                return Loadable.asLoading(item);
            },
        });
        
        storablePromise
            .then(
                result => {
                    store.dispatch({
                        [lifecycleActionKey]: null,
                        type: `${actionType}:ready`,
                        path: storableSpec.location,
                        //key: getKey(), // TODO
                        state: 'ready',
                        requestId,
                        
                        update: <T>(item : Loadable<T>) => {
                            if (!(status in item)) {
                                throw new TypeError($msg`Expected loadable item, given ${item}`);
                            }
                            const itemUpdated = storableSpec.accessor(result);
                            return Loadable.asReady(item, itemUpdated);
                        },
                    });
                },
                reason => {
                    store.dispatch({
                        [lifecycleActionKey]: null,
                        type: `${actionType}:failed`,
                        path: storableSpec.location,
                        //key: getKey(), // TODO
                        state: 'failed',
                        requestId,
                        
                        update: <T>(item : Loadable<T>) => {
                            if (!(status in item)) {
                                throw new TypeError($msg`Expected loadable item, given ${item}`);
                            }
                            Loadable.asFailed(item, reason);
                        },
                    });
                },
            );
        
        // Return the promise to the caller
        // Q: should we convert the promise to one which always resolves (never rejects) with a `status` here?
        return storablePromise;
    };
};
