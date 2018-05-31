// @flow

import uuid from 'uuid';
import merge from '../util/merge.js';

import { status, LoadablePromise } from '@mkrause/lifecycle-loader';

import StorablePromise from '../loader/StorablePromise.js';


const locationToString = location => {
    return location.join('.');
};

const configDefault = {
    prefix: 'lifecycle',
};

export default (configIn = {}) => {
    const config = merge(configDefault, configIn);
    
    return store => next => action => {
        // Only handle actions that are of type StorablePromise
        if (!(action instanceof StorablePromise)) {
            return next(action);
        }
        
        const storableSpec = action.spec;
        
        const actionType = `${config.prefix}:${locationToString(storableSpec.location)}`;
        
        const requestId = uuid();
        
        store.dispatch({
            type: `${actionType}:loading`,
            path: storableSpec.location,
            state: 'loading',
            request: requestId,
            item: action.item, // TODO: accessor?
        });
        
        action
            .then(
                result => {
                    store.dispatch({
                        type: `${actionType}:ready`,
                        path: storableSpec.location,
                        state: 'ready',
                        request: requestId,
                        item: storableSpec.accessor(result),
                    });
                },
                reason => {
                    store.dispatch({
                        type: `${actionType}:failed`,
                        path: storableSpec.location,
                        state: 'failed',
                        request: requestId,
                        item: reason.item, // TODO: accessor?
                    });
                },
            );
        
        // Return the promise to the caller
        return action;
    };
};
