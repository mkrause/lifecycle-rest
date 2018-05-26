// @flow

import uuid from 'uuid';

import { status, LoadablePromise } from '@mkrause/lifecycle-loader';

import StorablePromise from '../loader/StorablePromise.js';


/*
// Redux reducer. Takes API-related actions and updates the store accordingly.
export const update = (state, action) => match(action, {
    [match.default]: state,
    // Load data into the API (either new, or updates of existing data)
    'api.load': ({ requestId, status, path, value }) => {
        const stateWithRequest = state.update('requests', requests => {
            if (requestId === undefined) {
                return requests;
            }
            
            if (status === 'ready') {
                return requests.remove(requestId);
            } else {
                return requests.set(requestId, { status });
            }
        });
        
        return stateWithRequest.setIn(path, value);
    },
    
    // Clear data from the API
    'api.dispose': ({ path }) => {
        const current = state.getIn(path);
        if (current === undefined) {
            return state;
        } else if (current instanceof Collection) {
            // Empty the collection
            return state.setIn(path, current.clear());
        } else {
            return state.removeIn(path);
        }
    },
});
*/

const locationToString = location => {
    return location.join('.');
};

export default config => store => next => action => {
    if (!(action instanceof StorablePromise)) {
        return next(action);
    }
    
    const actionType = `lifecycle:${locationToString(action.spec.location)}`;
    
    //console.log('StorablePromise: ', action.spec);
    
    const requestId = uuid();
    
    store.dispatch({
        type: actionType,
        state: 'loading',
        request: requestId,
    });
    
    action
        .then(
            result => {
                store.dispatch({
                    type: actionType,
                    state: 'ready',
                    request: requestId,
                });
            },
            reason => {
                store.dispatch({
                    type: actionType,
                    state: 'failed',
                    request: requestId,
                });
            },
        );
    
    // Return the promise to the caller
    return action;
};
