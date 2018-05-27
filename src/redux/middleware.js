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
        
        const actionType = `${config.prefix}:${locationToString(action.spec.location)}`;
        
        const requestId = uuid();
        
        store.dispatch({
            type: actionType,
            state: 'loading',
            request: requestId,
            item: action.item,
        });
        
        action
            .then(
                result => {
                    store.dispatch({
                        type: actionType,
                        state: 'ready',
                        request: requestId,
                        item: result,
                    });
                },
                reason => {
                    store.dispatch({
                        type: actionType,
                        state: 'failed',
                        request: requestId,
                        item: reason.item,
                    });
                },
            );
        
        // Return the promise to the caller
        return action;
    };
};
