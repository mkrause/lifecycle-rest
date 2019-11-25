
import uuid from 'uuid';
import merge from '../util/merge.js';

import { status, LoadablePromise } from '@mkrause/lifecycle-loader';

//import StorablePromise from '../loader/StorablePromise.js';


const locationToString = (location : string[]) => {
    return location.join('.');
};

type Config = {
    prefix ?: string,
};
const configDefault : Config = {
    prefix: 'lifecycle',
};

const isLifecycleAction = Symbol('lifecycle.action');

export default (_config : Config = {}) => {
    const config = merge(configDefault, _config);
    
    return store => next => action => {
        // Only handle actions that are of type StorablePromise
        if (!(action instanceof StorablePromise)) {
            return next(action);
        }
        
        const storableSpec = action.spec;
        
        const actionType = `${config.prefix}:${locationToString(storableSpec.location)}`;
        
        const requestId = uuid();
        
        
        // Convert the given promise to a series of actions:
        // - loading
        // - ready OR failed
        
        store.dispatch({
            [isLifecycleAction]: true,
            type: `${actionType}:loading`,
            path: storableSpec.location,
            state: 'loading',
            request: requestId,
            item: action.item, // TODO: apply accessor?
        });
        
        action
            .then(
                result => {
                    store.dispatch({
                        [isLifecycleAction]: true,
                        type: `${actionType}:ready`,
                        path: storableSpec.location,
                        state: 'ready',
                        request: requestId,
                        item: storableSpec.accessor(result),
                    });
                },
                reason => {
                    store.dispatch({
                        [isLifecycleAction]: true,
                        type: `${actionType}:failed`,
                        path: storableSpec.location,
                        state: 'failed',
                        request: requestId,
                        item: reason.item, // TODO: apply accessor?
                    });
                },
            );
        
        // Return the promise to the caller
        return action;
    };
};
