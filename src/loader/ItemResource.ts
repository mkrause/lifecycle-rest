
import env from '../util/env.js';

import $msg from 'message-tag';
import $uri from 'uri-tag';
import merge, { Merge } from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import { concatUri } from '../util/uri.js';

import { Schema, DecodeError } from '../schema/Schema.js';
import * as t from 'io-ts';

import { AxiosResponse } from 'axios';
import type { ResourcePath, URI, StorePath, Agent, Context, ResourceDefinition, Resource, ResourceCreator, ResourceSpec } from './Resource.js';
import { resourceDef, intantiateSpec } from './Resource.js';

import Adapter, { AdapterT } from './Adapter.js';

import { StorablePromise, makeStorable } from './StorablePromise.js';


export type ItemSchema = Schema;

export type ItemResourceSpec<S extends ItemSchema> = ResourceSpec<S>;


// Generic collection resource type (i.e. as general as we can define it without knowing the actual spec)
export type ItemResourceT<S extends ItemSchema> = Resource<S>;
    //& { [resourceDef] : { spec : {} } }; // Can extend, if needed


const defaultMethods = {
    async head<S extends ItemSchema>(this : ItemResourceT<S>, params = {}) : Promise<AxiosResponse> {
        const { agent, schema, adapter, ...spec } = this[resourceDef];
        const response = await agent.head(spec.uri, { params });
        return response;
    },
    
    async get<S extends ItemSchema>(this : ItemResourceT<S>, params = {}) : Promise<t.TypeOf<S>> {
        const { agent, schema, adapter, ...spec } = this[resourceDef];
        const response = await agent.get(spec.uri, { params });
        const instance = adapter.decode(adapter.parse(response));
        
        return instance;
    },
    
    async put<S extends ItemSchema>(this : ItemResourceT<S>, instance : unknown, params = {})
        : Promise<t.TypeOf<S>> {
            const { agent, schema, adapter, ...spec } = this[resourceDef];
            
            const instanceEncoded = adapter.encode(instance);
            
            const response = await agent.put(spec.uri, instanceEncoded, { params });
            
            return adapter.report(schema.decode(adapter.parse(response)));
        },
    
    async patch<S extends ItemSchema>(this : ItemResourceT<S>, instance : unknown, params = {})
        : Promise<t.TypeOf<S>> {
            const { agent, schema, adapter, ...spec } = this[resourceDef];
            
            const schemaPartial = adapter.partial();
            
            const instanceEncoded = schemaPartial.encode(instance);
            
            const response = await agent.patch(spec.uri, instanceEncoded, { params });
            return adapter.report(schema.decode(adapter.parse(response)));
        },
    
    async delete<S extends ItemSchema>(this : ItemResourceT<S>, instanceEncoded : unknown, params = {})
        : Promise<void> {
            const { agent, schema, adapter, ...spec } = this[resourceDef];
            
            const response = await agent.delete(spec.uri, { params });
            return response.data;
        },
    
    async post<S extends ItemSchema>(this : ItemResourceT<S>, body : unknown, params = {})
        : Promise<unknown> {
            const { agent, schema, adapter, ...spec } = this[resourceDef];
            
            const response = await agent.post(spec.uri, { params });
            return response.data;
        },
};

const itemDefaults = {
    path: [],
    uri: '',
    store: [],
    methods: {
        head: defaultMethods.head,
        
        get<S extends ItemSchema>(this : ItemResourceT<S>, params = {})
            : StorablePromise<t.TypeOf<S>> {
                return makeStorable(Function.prototype.call.call(defaultMethods.get, this, params), {
                    location: this[resourceDef].store,
                    operation: 'put',
                });
            },
        
        put<S extends ItemSchema>(this : ItemResourceT<S>, instance : unknown, params = {})
            : StorablePromise<t.TypeOf<S>> {
                return makeStorable(Function.prototype.call.call(defaultMethods.put, this, instance, params), {
                    location: this[resourceDef].store,
                    operation: 'put',
                });
            },
        
        patch<S extends ItemSchema>(this : ItemResourceT<S>, instance : unknown, params = {})
            : StorablePromise<t.TypeOf<S>> {
                return makeStorable(Function.prototype.call.call(defaultMethods.patch, this, instance, params), {
                    location: this[resourceDef].store,
                    operation: 'put',
                });
            },
        
        delete<S extends ItemSchema>(this : ItemResourceT<S>, instanceEncoded : unknown, params = {})
            : StorablePromise<void> {
                return makeStorable(
                    Function.prototype.call.call(defaultMethods.delete, this, instanceEncoded, params),
                    {
                        location: this[resourceDef].store,
                        operation: 'put',
                    },
                );
            },
        
        post<S extends ItemSchema>(this : ItemResourceT<S>, body : unknown, params = {})
            : StorablePromise<unknown> {
                return makeStorable(Function.prototype.call.call(defaultMethods.post, this, body, params), {
                    location: this[resourceDef].store,
                    operation: 'put',
                });
            },
    },
    resources: {},
};


export const ItemResource = <S extends ItemSchema, Spec extends Partial<ItemResourceSpec<S>>>(
        schema : S, itemSpec : Spec = {} as Spec
    ) => {
        // Utility types
        type MethodsFromSpec<M extends ItemResourceSpec<S>['methods']> =
            { [key in keyof M] : M[key] extends (...args : infer A) => infer R ? (...args : A) => R : never };
        type ResourcesFromSpec<R extends ItemResourceSpec<S>['resources']> =
            { [key in keyof R] : R[key] extends (context : Context) => infer R ? R : never };
        
        // The interface of the resource, split up into its base components
        type ResourceComponents = {
            methods : Merge<(typeof itemDefaults)['methods'], MethodsFromSpec<Spec['methods'] & {}>>,
            resources : ResourcesFromSpec<Spec['resources'] & {}>,
        };
        
        // The interface of the resource, after merging the different components and adding context information
        type ItemResource = Resource<S>
            & ResourceComponents['methods']
            & ResourceComponents['resources'];
        
        const makeResource = (context : Context) : ItemResource => {
            const spec : ItemResourceSpec<S> = intantiateSpec(context, itemSpec, itemDefaults);
            
            // Get methods and subresources
            const methods = spec.methods as ResourceComponents['methods'];
            const resources = spec.resources as ResourceComponents['resources'];
            
            // Make sure there's no `resourceDef` key included (should not be overridden)
            if (resourceDef in methods || resourceDef in resources) {
                throw new TypeError($msg`Cannot override resourceDef key`);
            }
            
            const resourceDefinition : ResourceDefinition<S> = {
                agent: context.agent,
                options: context.options,
                ...spec,
                schema,
                
                methods: itemDefaults.methods,
                adapter: null as unknown as AdapterT,
            };
            resourceDefinition.adapter = context.options.adapter(resourceDefinition, schema);
            
            const resource : ItemResource = {
                ...methods,
                ...resources,
                [resourceDef]: resourceDefinition,
            };
            
            return resource;
        };
        
        return Object.assign(makeResource, {
            schema, // Expose the schema on the constructor
        });
    };

export default ItemResource;
