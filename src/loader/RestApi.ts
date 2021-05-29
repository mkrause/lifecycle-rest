
import env from '../util/env.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import merge, { Merge } from '../util/merge.js';

import type { Schema } from '../schema/Schema.js';

import type { Agent, Options, Context, Resource } from './Resource.js';
import { resourceDef } from './Resource.js';
import adapter from './Adapter.js';

import ItemResource from './ItemResource.js';
import CollectionResource from './CollectionResource.js';

import type { StorableSpec } from './StorablePromise.js';
import { isStorable, makeStorable } from './StorablePromise.js';


/*
Create a REST API loader from an API specification. The API specification is built up from a hierarchy of "resource"
specifications. Each resource specification should describe a REST resource of your API (an endpoint, essentially).

The actual HTTP requests are delegated to the given *agent*.
*/

type RestApiOptions = Partial<Options> & { agent : Options['agent'] };
const RestApi = <S extends Schema, R extends Resource<S>>(
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
    };

// Shorthands
RestApi.Item = ItemResource;
RestApi.Collection = CollectionResource;

RestApi.getResourceConfig = <S extends Schema>(resource : Resource<S>) => resource[resourceDef];
RestApi.makeStorable = makeStorable;

// @method decorator
type MethodOptions = {
    storable ?: boolean | Partial<StorableSpec<unknown>>
};
RestApi.method = ({ storable = true } : MethodOptions = {}) =>
    (_target : unknown, _key : PropertyKey, descriptor : PropertyDescriptor) : PropertyDescriptor => {
        if (typeof descriptor.value !== 'function') {
            return descriptor;
        }
        
        const fn = descriptor.value;
        
        return {
            ...descriptor,
            value<S extends Schema>(this : Resource<S>, ...args : Array<unknown>) {
                const res = RestApi.getResourceConfig(this);
                let result = Function.prototype.apply.call(fn, this, [res, ...args]);
                
                if (storable && result instanceof Promise && !isStorable(result)) {
                    const storableSpecDefaults = {
                        location: res.store,
                        operation: 'put',
                    } as StorableSpec<unknown>;
                    
                    const storableSpec = typeof storable === 'object' && storable !== null
                        ? { ...storableSpecDefaults, ...storable }
                        : storableSpecDefaults;
                    
                    result = makeStorable(result, storableSpec);
                }
                
                return result;
            },
        };
    };

export default RestApi;
