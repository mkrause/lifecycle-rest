
import env from '../util/env.js';

import $msg from 'message-tag';
import merge, { Merge } from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import $uri from 'uri-tag';
import { concatUri } from '../util/uri.js';

import { Schema, DecodeError } from '../schema/Schema.js';

import { AxiosResponse } from 'axios';
import { ResourcePath, URI, StorePath, Agent, Context, Resource, resourceDef } from './Resource.js';

// TEMP
import { PathReporter } from 'io-ts/lib/PathReporter.js';
import * as t from 'io-ts';
import { Errors as ValidationErrors, ValidationError } from 'io-ts';


export type ItemSchema = Schema;

// Type of the spec used to define an ItemResource (after merging with defaults and context)
export type ItemResourceSpec<S extends ItemSchema> = {
    path : ResourcePath,
    uri : URI,
    store : StorePath,
    methods : { // ThisType<Resource> &
        [method : string] : (...args : unknown[]) => unknown,
    },
    resources : {
        [resource : string] : (context : Context) => Resource<Schema>,
    },
    entry : (context : Context) => Resource<Schema>,
};


// Extension of `Resource` specialized to `ItemResource`
export type ItemResourceT<S extends ItemSchema> = Resource<S>
    & {
        [resourceDef] : {
            spec : {}, // XXX can put `ItemResource`-specific info in here
        },
    }
    & { (index : string) : Resource<Schema> };


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
        const { agent, spec, schema, schemaMethods } = resource[resourceDef];
        
        return schemaMethods.report(schema.decode(input));
    },
    
    encode<Schema extends ItemSchema>(resource : ItemResourceT<Schema>, instance : unknown) {
        const { agent, spec, schema, schemaMethods } = resource[resourceDef];
        
        return schema.encode(instance);
    },
};

const itemDefaults = {
    path: [],
    store: [],
    uri: '',
    resources: {},
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
};


export const ItemResource =
    <S extends ItemSchema, Spec extends Partial<ItemResourceSpec<S>>>(
        schema : S, itemSpec : Spec = {} as Spec
    ) => {
        // Make sure there's no `resourceDef` key included (should not be overridden)
        const itemSpecMethods = itemSpec['methods'] || {};
        const itemSpecResources = itemSpec['resources'] || {};
        if (resourceDef in itemSpecMethods || resourceDef in itemSpecResources) {
            throw new TypeError($msg`Cannot override resourceDef key`);
        }
        
        // Utility types
        type MethodsFromSpec<M extends ItemResourceSpec<S>['methods']> =
            //{ [key in keyof M] : M[key] extends (context : any, ...args : infer A) => infer R ? (...args : A) => R : never };
            { [key in keyof M] : M[key] extends (...args : infer A) => infer R ? (...args : A) => R : never };
        type ResourcesFromSpec<R extends ItemResourceSpec<S>['resources']> =
            { [key in keyof R] : R[key] extends (context : Context) => infer R ? R : never };
        type EntryFromSpec<E extends ItemResourceSpec<S>['entry']> =
            E extends (context : Context) => infer R ? { (index : string) : R } : never;
        
        // The interface of the resource, split up into its base components
        type ResourceComponents = {
            methods : Merge<(typeof itemDefaults)['methods'], MethodsFromSpec<Spec['methods'] & {}>>,
            resources : ResourcesFromSpec<Spec['resources'] & {}>,
            entry : Spec['entry'] extends object ? EntryFromSpec<Spec['entry']> : {},
        };
        
        // The interface of the resource, after merging the different components and adding context information
        type ItemResource = 
            Merge<
                ItemResourceT<S>,
                Merge<
                    ResourceComponents['methods'],
                    ResourceComponents['resources']
                >
            >
            & ResourceComponents['entry'];
        
        const makeResource = (context : Context) : ItemResource => {
            const { agent, options } = context;
            
            const isRoot = context.path.length === 0;
            const label = isRoot ? null : context.path[context.path.length - 1];
            
            // Parse the item specification
            const itemDefaultsWithContext = merge(itemDefaults, {
                store: isRoot ? [] : [label],
                uri: isRoot ? '' : label,
            });
            const spec : ItemResourceSpec<S> = merge(itemDefaultsWithContext, itemSpec) as any; // FIXME
            
            // Make relative
            // TODO: allow the spec to override this and use absolute references instead
            spec.path = [...context.path, ...spec.path];
            spec.store = [...context.store, ...spec.store];
            spec.uri = concatUri([context.uri, spec.uri]);
            
            
            // Get methods
            const methods = spec.methods as ResourceComponents['methods'];
            /*
            const methods = ObjectUtil.mapValues(spec.methods, (method, methodName) => function(...args) {
                const result = method.apply(this, args);
                
                if (result instanceof Promise) {
                    // @ts-ignore
                    result.storable = { location: spec.store, operation: 'put' };
                }
                
                return result;
            });
            */
            
            // Get subresources
            const resources = ObjectUtil.mapValues(itemSpec.resources || {},
                (resource : (ctx : Context) => Resource<Schema>, resourceKey : string | number) => {
                    const resourceContext = {
                        options: context.options,
                        path: [...context.path, String(resourceKey)],
                        uri: spec.uri,
                        store: spec.store,
                        agent: context.agent,
                    };
                    return resource(resourceContext);
                }
            ) as ResourceComponents['resources'];
            
            let resource = {
                ...methods,
                ...resources,
                [resourceDef]: {
                    agent,
                    spec,
                    schema,
                    schemaMethods,
                    storable: (promise : Promise<unknown>) => {
                        // TODO: make a `@storable` decorator that applies this function
                        // Reason: using a wrapper function probably won't work inside an async function, because
                        // we lose the promise in the `await` chain. But wrapping the entire async function in a
                        // decorator should work.
                        
                        return Object.assign(promise, {
                            storable: { location: spec.store, operation: 'put' },
                        });
                    },
                },
            } as unknown as ItemResource;
            
            const entry = itemSpec.entry;
            if (typeof entry === 'function') {
                resource = Object.assign(
                    (index : string) => {
                        const entryContext = {
                            options,
                            agent,
                            path: [...spec.path, { index }],
                            store: [...spec.store, index],
                            uri: concatUri([spec.uri, index]),
                        };
                        return entry(entryContext);
                    },
                    resource
                );
            }
            
            
            return resource;
        };
        
        return Object.assign(makeResource, {
            schema, // Expose the schema on the constructor
        });
    };

export default ItemResource;


/*
const testContext = {
    options : {},
    path : [],
    uri : '',
    store : [],
    agent : null as any as Agent,
};
const test = ItemResource(t.string, {
    methods: {
        foo() { return 42 as const; }
    },
    resources: {
        res: ItemResource(t.string, {
            methods: {
                foo() { return 43 as const; }
            },
            resources: {
                
            },
        }),
    },
    entry: ItemResource(t.string, {
        methods: {
            foo() { return 44 as const; }
        },
        resources: {
            
        },
    }),
})(testContext);

const x1 : never = test('user42').foo();
*/
