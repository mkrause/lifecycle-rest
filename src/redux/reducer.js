
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

export default (state, action) => state; // TODO
