
import env from '../util/env.js';

import $msg from 'message-tag';
import $uri from 'uri-tag';
import merge, { Merge } from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import { concatUri } from '../util/uri.js';

import { Schema, DecodeError } from '../schema/Schema.js';

import { AxiosResponse } from 'axios';
import { Index, ResourcePath, URI, StorePath, Agent, Context, Resource, resourceDef, ResourceCreator, ResourceSpec, intantiateSpec } from './Resource.js';

// TEMP
import { PathReporter } from 'io-ts/lib/PathReporter.js';
import * as t from 'io-ts';
import { Errors as ValidationErrors, ValidationError } from 'io-ts';


export type ItemSchema = Schema;

export type ItemResourceSpec<S extends ItemSchema> = ResourceSpec<S>;


// Generic collection resource type (i.e. as general as we can define it without knowing the actual spec)
export type ItemResourceT<S extends ItemSchema> = Resource<S>;
    //& { [resourceDef] : { spec : {} } }; // Can extend, if needed


const schemaMethods = {
    parse(response : AxiosResponse) {
        if (response.status === 204) { return null; }
        return response.data;
    },
    
    format(item : any) { return item },
    
    report(decodeResult : t.Validation<any>) {
        if (decodeResult._tag === 'Right') {
            return decodeResult.right;
        } else {
            const errors = decodeResult.left;
            const report = PathReporter.report(decodeResult);
            
            let message = `Failed to decode response:\n` + report.map(error =>
                `\n- ${error}`
            );
            
            throw new DecodeError(message, errors);
        }
    },
    
    partial(schema : t.Type<any, any, any>) {
        if ('props' in schema) {
            return t.partial((schema as any).props);
        } else {
            return schema;
        }
    },
    
    decode<Schema extends ItemSchema>(resource : ItemResourceT<Schema>, input : unknown) {
        const { agent, schema, schemaMethods } = resource[resourceDef];
        
        return schemaMethods.report(schema.decode(input));
    },
    
    encode<Schema extends ItemSchema>(resource : ItemResourceT<Schema>, instance : unknown) {
        const { agent, schema, schemaMethods } = resource[resourceDef];
        
        return schema.encode(instance);
    },
};

const itemDefaults = {
    path: [],
    uri: '',
    store: [],
    methods: {
        async head<S extends ItemSchema>(this : ItemResourceT<S>, params = {}) {
            const { agent, schema, schemaMethods, ...spec } = this[resourceDef];
            const response = await agent.head(spec.uri, { params });
            return response;
        },
        
        async get<S extends ItemSchema>(this : ItemResourceT<S>, params = {}) {
            const { agent, schema, schemaMethods, ...spec } = this[resourceDef];
            const response = await agent.get(spec.uri, { params });
            return schemaMethods.decode(this, schemaMethods.parse(response));
        },
        
        async put<S extends ItemSchema>(this : ItemResourceT<S>, instance : unknown, params = {}) {
            const { agent, schema, schemaMethods, ...spec } = this[resourceDef];
            
            const instanceEncoded = schemaMethods.encode(this, instance);
            
            const response = await agent.put(spec.uri, instanceEncoded, { params });
            return schemaMethods.report(schema.decode(schemaMethods.parse(response)));
        },
        
        async patch<S extends ItemSchema>(this : ItemResourceT<S>, instance : unknown, params = {}) {
            const { agent, schema, schemaMethods, ...spec } = this[resourceDef];
            
            const schemaPartial = schemaMethods.partial(schema);
            
            const instanceEncoded = schema.encode(instance);
            
            const response = await agent.patch(spec.uri, instanceEncoded, { params });
            return schemaMethods.report(schema.decode(schemaMethods.parse(response)));
        },
        
        async delete<S extends ItemSchema>(this : ItemResourceT<S>, instanceEncoded : unknown, params = {}) {
            const { agent, schema, schemaMethods, ...spec } = this[resourceDef];
            
            const response = await agent.delete(spec.uri, { params });
            return response.data;
        },
        
        async post<S extends ItemSchema>(this : ItemResourceT<S>, body : unknown, params = {}) {
            const { agent, schema, schemaMethods, ...spec } = this[resourceDef];
            
            const response = await agent.post(spec.uri, { params });
            return response.data;
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
            
            const resource : ItemResource = {
                ...methods,
                ...resources,
                [resourceDef]: {
                    agent: context.agent,
                    options: context.options,
                    ...spec,
                    schema,
                    schemaMethods,
                    storable: (promise : Promise<any>) => {
                        // TODO: make a `@storable` decorator that applies this function
                        // Reason: using a wrapper function probably won't work inside an async function, because
                        // we lose the promise in the `await` chain. But wrapping the entire async function in a
                        // decorator should work.
                        
                        return Object.assign(promise, {
                            storable: { location: spec.store, operation: 'put' },
                        });
                    },
                },
            };
            
            return resource;
        };
        
        return Object.assign(makeResource, {
            schema, // Expose the schema on the constructor
        });
    };

export default ItemResource;
