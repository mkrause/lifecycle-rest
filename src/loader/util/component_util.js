
import _ from 'lodash';


// Utility functions for React components

export const withStatus = props => {
    const items = Object.values(_.pickBy(props, prop => prop.hasOwnProperty('meta')));
    
    const getStatus = item => {
        return item.meta.status;
    };
    
    const some = status => _.some(items, item => getStatus(item) === status);
    const every = status => _.every(items, item => getStatus(item) === status);
    
    let status = null;
    if (some('error')) {
        // Note: the presence of any error should be prioritized (take precedence over other statuses)
        const reasons = items
            .filter(item => getStatus(item) === 'error')
            .map(item => item.reason);
        status = { status: 'error', reasons };
    } else if (some('pending')) {
        status = { status: 'pending' };
    } else if (some('invalid')) {
        status = { status: 'invalid' };
    } else if (every('ready')) {
        status = { status: 'ready' };
    } else {
        // The above should cover all cases
        throw new Error("Unrecognized status");
    }
    
    return { ...props, apiStatus: status };
};

export const loader = (apiItems = []) => ({ refresh = false } = {}) => {
    const promises = _.flatMap(apiItems, ({ item, load }) => {
        // Note: `item` must be a function, otherwise we close over it (meaning it
        // will never be updated, creating an infinite loop)
        if (refresh || item().meta.status === 'invalid') {
            return [ load() ];
        } else {
            return [];
        }
    });
    
    return Promise.all(promises);
};
