
import uuid from 'uuid';
import merge from '../util/merge.js';

//import { status, LoadablePromise } from '@mkrause/lifecycle-loader';
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

export const isLifecycleAction = Symbol('lifecycle.action');

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
            [isLifecycleAction]: null,
            type: `${actionType}:loading`,
            path: storableSpec.location,
            //key: getKey(), // TODO
            state: 'loading',
            request: requestId,
        });
        
        storablePromise
            .then(
                result => {
                    store.dispatch({
                        [isLifecycleAction]: null,
                        type: `${actionType}:ready`,
                        path: storableSpec.location,
                        //key: getKey(), // TODO
                        state: 'ready',
                        request: requestId,
                        item: storableSpec.accessor(result),
                    });
                },
                reason => {
                    store.dispatch({
                        [isLifecycleAction]: null,
                        type: `${actionType}:failed`,
                        path: storableSpec.location,
                        //key: getKey(), // TODO
                        state: 'failed',
                        request: requestId,
                        reason,
                    });
                },
            );
        
        // Return the promise to the caller
        // Q: should we convert the promise to one which always resolves (never rejects) with a `status` here?
        return storablePromise;
    };
};
