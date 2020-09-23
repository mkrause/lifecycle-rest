
import $msg from 'message-tag';

import env from '../util/env.js';
import merge, { Merge } from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import $uri from 'uri-tag';
import { concatUri } from '../util/uri.js';

import { Schema, DecodeError } from '../schema/Schema.js';
import * as t from 'io-ts';

import { AxiosResponse } from 'axios';
import * as Location from './Location.js';
import type { ResourcePath, URI, StorePath, Agent, Context, ResourceDefinition, Resource, ResourceCreator, ResourceSpec } from './Resource.js';
import { resourceDef, intantiateSpec } from './Resource.js';

import Adapter, { AdapterT } from './Adapter.js';

import { StorablePromise, makeStorable } from './StorablePromise.js';


export type CollSchema = Schema;

export type CollResourceSpec<S extends CollSchema> = ResourceSpec<S>
    & {
        getKey : (value : t.TypeOf<S>) => unknown,
        entry : ResourceCreator<Schema>,
    };

// Generic collection resource type (i.e. as general as we can define it without knowing the actual spec)
export type CollResourceT<S extends CollSchema> = Resource<S>
    & {
        (index : Location.Index) : Resource<Schema>,
        entrySchema : Schema,
    };


const defaultMethods = {
    async head<S extends CollSchema>(this : CollResourceT<S>, params = {}) : Promise<AxiosResponse> {
        const { agent, schema, adapter, ...spec } = this[resourceDef];
        const response = await agent.head(spec.uri, { params });
        return response;
    },
    
    async get<S extends CollSchema>(this : CollResourceT<S>, params = {}) : Promise<t.TypeOf<S>> {
        const { agent, schema, adapter, ...spec } = this[resourceDef];
        const response = await agent.get(spec.uri, { params });
        return adapter.decode(adapter.parse(response));
    },
    
    // Alias for `get`
    async list<S extends CollSchema>(this : CollResourceT<S>, params = {}) : Promise<t.TypeOf<S>> {
        return await collectionDefaults.methods.get.call(this, params);
    },
    
    /* TODO
    async put<S extends CollSchema>(this : CollResourceT<S>, instance : unknown, params = {})
        : Promise<t.TypeOf<S>> {
            //
        },
    
    async patch<S extends CollSchema>(this : CollResourceT<S>, instance : unknown, params = {})
        : Promise<t.TypeOf<S>> {
            const { agent, schema, adapter, ...spec } = this[resourceDef];
            
            const schemaPartial = adapter.partial();
            
            const instanceEncoded = schema.encode(instance);
            
            const response = await agent.patch(spec.uri, instanceEncoded, { params });
            return adapter.report(schema.decode(adapter.parse(response)));
        },
    
    async delete<S extends CollSchema>(this : CollResourceT<S>, instanceEncoded : unknown, params = {})
        : Promise<void> {
            const { agent, schema, adapter, ...spec } = this[resourceDef];
            
            const response = await agent.delete(spec.uri, { params });
            return response.data;
        },
    */
    
    // Generic POST (does not assume anything about the data model)
    async post<S extends CollSchema>(this : CollResourceT<S>, instance : unknown, params = {})
        : Promise<AxiosResponse> {
            const { agent, schema, adapter, ...spec } = this[resourceDef];
            const response = await agent.post(spec.uri, { params });
            return response;
        },
    
    async create<S extends CollSchema>(this : CollResourceT<S>, instance : unknown, params = {})
        : Promise<t.TypeOf<S>> {
            const { agent, schema, adapter, entry, ...spec } = this[resourceDef];
            
            //const entrySchema = this.entrySchema; // FIXME
            const entrySchema = entry.schema;
            
            const entryAdapter = adapter.with(entrySchema);
            
            const instanceEncoded = entryAdapter.encode(instance);
            
            const response = await agent.post(spec.uri, instanceEncoded, { params });
            const entryResult : t.TypeOf<typeof entrySchema> = entryAdapter.report(
                schema.decode(entryAdapter.parse(response))
            );
            
            return entryResult;
        },
};

const collectionDefaults = {
    path: [],
    uri: '',
    store: [],
    methods: {
        head: defaultMethods.head,
        
        // Alias for `get`
        list<S extends CollSchema>(this : CollResourceT<S>, params = {}) : StorablePromise<t.TypeOf<S>> {
            return makeStorable(Function.prototype.call.call(defaultMethods.get, this, params), {
                location: this[resourceDef].store,
                operation: 'put',
            });
        },
        
        get<S extends CollSchema>(this : CollResourceT<S>, params = {}) : StorablePromise<t.TypeOf<S>> {
            return makeStorable(Function.prototype.call.call(defaultMethods.get, this, params), {
                location: this[resourceDef].store,
                operation: 'put',
            });
        },
        
        post: defaultMethods.post,
        
        create<S extends CollSchema>(this : CollResourceT<S>, instance : unknown, params = {})
            : StorablePromise<t.TypeOf<S>> {
                const { schema, adapter, store } = this[resourceDef];
                
                return makeStorable(Function.prototype.call.call(defaultMethods.create, this, instance, params), {
                    location: (result : unknown) => {
                        if (typeof result === 'undefined') {
                            return [...store, undefined];
                        }
                        
                        try {
                            // const schemaKey = adapter.keyOf(schema);
                            // const index = adapter.with(schemaKey).decode(result);
                            
                            // @ts-ignore
                            const index = this[resourceDef].getKey(result);
                            
                            if (typeof index === 'undefined') {
                                throw new TypeError(`Key does not exist on ${result}`);
                            }
                            
                            return [...store, index];
                        } catch (e) {
                            throw new TypeError($msg`Cannot get key of result: ${result}, reason: ${e}`);
                        }
                    },
                    operation: 'put',
                });
            },
    },
    resources: {},
    
    getKey: () => { throw new TypeError(`Unknown key type`); },
    entry: (index : Location.Index) => { throw new TypeError($msg`Cannot construct entry`); },
};

export const CollectionResource = <S extends CollSchema, Spec extends Partial<CollResourceSpec<S>>>(
        schema : S, collSpec : Spec = {} as Spec
    ) => {
        // Utility types
        type MethodsFromSpec<M extends CollResourceSpec<S>['methods']> =
            { [key in keyof M] : M[key] extends (...args : infer A) => infer R ? (...args : A) => R : never };
        type ResourcesFromSpec<R extends CollResourceSpec<S>['resources']> =
            { [key in keyof R] : R[key] extends (context : Context) => infer R ? R : never };
        type EntryFromSpec<E extends CollResourceSpec<S>['entry']> =
            E extends (context : Context) => infer R ? (index : Location.Index) => R : never;
        
        // The interface of the resource, split up into its base components
        type ResourceComponents = {
            methods : Merge<(typeof collectionDefaults)['methods'], MethodsFromSpec<Spec['methods'] & {}>>,
            resources : ResourcesFromSpec<Spec['resources'] & {}>,
            entry : Spec['entry'] extends Function ? EntryFromSpec<Spec['entry']> : {},
        };
        
        // The interface of the resource, after merging the different components and adding context information
        type CollResource = Resource<S>
            & ResourceComponents['methods']
            & ResourceComponents['resources']
            & ResourceComponents['entry'];
        
        const makeResource = (context : Context) : CollResource => {
            type SpecInstantiated = Omit<CollResourceSpec<S>, 'methods' | 'resources' | 'entry'> & {
                methods : ResourceComponents['methods'],
                resources : ResourceComponents['resources'],
                entry : Spec['entry'],
            };
            
            const spec = intantiateSpec(context, collSpec, collectionDefaults) as SpecInstantiated;
            
            // Get methods and subresources
            const methods = spec.methods as ResourceComponents['methods'];
            const resources = spec.resources as ResourceComponents['resources'];
            
            // Make sure there's no `resourceDef` key included (should not be overridden)
            if (resourceDef in methods || resourceDef in resources) {
                throw new TypeError($msg`Cannot override resourceDef key`);
            }
            
            const entry = spec.entry;
            const makeEntry = ((index : Location.Index) => {
                const entryContext = {
                    options: context.options,
                    agent: context.agent,
                    path: [...spec.path, { index }],
                    store: [...spec.store, { index }],
                    uri: concatUri([spec.uri, Location.indexAsString(index)]),
                };
                return (entry as any)(entryContext);
            }) as ResourceComponents['entry'];
            
            const resourceDefinition : ResourceDefinition<S> = {
                agent: context.agent,
                options: context.options,
                ...spec,
                schema,
                
                methods: collectionDefaults.methods,
                adapter: null as unknown as AdapterT,
            };
            resourceDefinition.adapter = context.options.adapter(resourceDefinition, schema);
            
            // @ts-ignore
            resourceDefinition.getKey = spec.getKey;
            
            const resource : CollResource = Object.assign(makeEntry,
                methods,
                resources,
                {
                    [resourceDef]: resourceDefinition,
                },
            );
            
            return resource;
        };
        
        return Object.assign(makeResource, {
            schema, // Expose the schema on the constructor
        });
    };

export default CollectionResource;
