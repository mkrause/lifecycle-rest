
import env from '../util/env.js';

import type { Schema } from '../schema/Schema.js';

import type { Agent, Context, Resource } from './Resource.js';
import { resourceDef } from './Resource.js';

import ItemResource from './ItemResource.js';
import CollectionResource from './CollectionResource.js';

import { makeStorable } from './StorablePromise.js';


/*
Create a REST API loader from an API specification. The API specification is built up from a hierarchy of "resource"
specifications. Each resource specification should describe a REST resource your API (an endpoint, essentially).

The actual HTTP requests are delegated to the given *agent*.
*/

type Config = { agent : Agent };
const RestApi = <S extends Schema, R extends Resource<S>>(
        config : Config, resource : (context : Context) => R
    ) : R => {
        //const resource = typeof _resource !== 'function' ? ItemResource(SimpleItem, _resource) : _resource;
        
        const options = {}; // Currently none. In the future we may want to support additional API options
        
        // Current context while traversing through the resource hierarchy
        const context = {
            agent: config.agent,
            options,
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

RestApi.getResourceConfig = <S extends Schema>(resource : Resource<S>) => resource[resourceDef];
RestApi.makeStorable = makeStorable;

export default RestApi;
