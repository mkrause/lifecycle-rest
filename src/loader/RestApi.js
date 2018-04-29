
import env from '../util/env.js';
import merge from '../util/merge.js';

import ItemResource from './ItemResource.js';
import CollectionResource from './CollectionResource.js';


const apiSpecDefaults = {
    uri: '', // Root path (without trailing slash, so just an empty string)
    store: [],
    resources: {},
};

const RestApi = (agent, apiSpec) => {
    const spec = merge(apiSpecDefaults, apiSpec);
    
    // Current context while traversing through the spec hierarchy
    const context = {
        agent,
        rootSpec: spec,
        parentSpec: null,
        path: [], // The current path in the API spec tree
    };
    
    return ItemResource(spec)(context);
};

RestApi.Item = ItemResource;
RestApi.Collection = CollectionResource;

export default RestApi;
