// @flow

import env from '../util/env.js';
import merge from '../util/merge.js';

import ItemResource from './ItemResource.js';
import CollectionResource from './CollectionResource.js';


/*
Create a REST API loader service from an API specification. The specification is built up from
a tree of "resource" specifications. Each resource specification should describe a REST resource
your API (an endpoint, essentially).

The actual HTTP requests are delegated to an *agent* that you need to provide.
*/

interface Agent {
    head : Function,
    get : Function,
    post : Function,
    put : Function,
    patch : Function,
    delete : Function,
};

const apiSpecDefaults = {
    uri: '', // Root path (without trailing slash, so just an empty string)
    store: [],
    resources: {},
};

const RestApi = (agent : Agent, apiSpec : typeof apiSpecDefaults) => {
    const spec = merge(apiSpecDefaults, apiSpec);
    
    // Current context while traversing through the spec hierarchy
    const context = {
        agent,
        rootSpec: spec,
        parentSpec: null,
        path: [], // The current path in the API spec tree
    };
    
    // Return the root item resource
    return ItemResource(spec)(context);
};

RestApi.Item = ItemResource;
RestApi.Collection = CollectionResource;

export default RestApi;
