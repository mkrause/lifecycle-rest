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

export type Context = {
    agent : Agent,
    config : Object,
    path : Array<mixed>,
    store : Array<mixed>,
    uri : string,
};
export type Resource = Context => mixed;

const RestApi = (agent : Agent, resource : Resource) => {
    const config = {}; // In the future we may want to support additional API configuration
    
    // Current context while traversing through the resource hierarchy
    const context = {
        agent,
        config,
        path: [], // The current path in the API resource tree
        store: [],
        uri: '', // Note: no trailing slash (so empty string in case of empty URI)
    };
    
    // Return the root item resource
    return resource(context);
};

// Shorthands
RestApi.Item = ItemResource;
RestApi.Collection = CollectionResource;

export default RestApi;
