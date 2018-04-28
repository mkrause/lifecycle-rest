
export const updateRequest = ({ state, requestId, status, reason }) => {
    return state.update('requests', current => {
        if (requestId === undefined) {
            return current;
        }
        
        if (status === 'ready') {
            return current.remove(requestId);
        } else {
            return current.set(requestId, { status, reason });
        }
    });
};
