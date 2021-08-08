
import type { Schema } from '../schema/Schema';

import type { Agent, Options, Context, Resource } from './Resource';
import { resourceDef, ResourceDefinition } from './Resource';
import adapter from './Adapter';

import ItemResource from './ItemResource';
import CollectionResource from './CollectionResource';

import { makeStorable } from './StorablePromise';
import * as ResourceMethod from './ResourceMethod';


/*
Create a REST API loader from an API specification. The API specification is built up from a hierarchy of "resource"
specifications. Each resource specification should describe a REST resource of your API (an endpoint, essentially).

The actual HTTP requests are delegated to the given *agent*.
*/

type RestApiOptions = Partial<Options> & { agent : Options['agent'] };
const RestApi = Object.assign(
    <S extends Schema, R extends Resource<S>>(
        _options : RestApiOptions, resource : (context : Context) => R
    ) : R => {
        //const resource = typeof _resource !== 'function' ? ItemResource(SimpleItem, _resource) : _resource;
        
        const options : Options = {
            adapter,
            ..._options,
        };
        
        // Current context while traversing through the resource hierarchy
        const context = {
            agent: options.agent,
            options,
            path: [], // The current path in the API resource tree
            store: [],
            uri: '', // Note: no trailing slash (so empty string in case of empty URI)
        };
        
        // Return the root item resource
        return resource(context);
    },
    // Shorthands
    {
        Item: ItemResource,
        Collection: CollectionResource,
        
        getResourceConfig: <S extends Schema>(resource : Resource<S>) => resource[resourceDef],
        makeStorable: makeStorable,
        
        decorateMethod: ResourceMethod.decorateMethod, // Manual method decorator
        method: ResourceMethod.decorator, // `@decorator` syntax
    },
);

export default RestApi;
