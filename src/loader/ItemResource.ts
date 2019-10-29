
import $msg from 'message-tag';

import env from '../util/env.js';
import merge, { Merge } from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import $uri from 'uri-tag';
import { concatUri } from '../util/uri.js';

import * as t from 'io-ts';
import { PathReporter } from 'io-ts/lib/PathReporter.js';
import { Errors as ValidationErrors, ValidationError } from 'io-ts';
import { either } from 'fp-ts';

import { status, Loadable, LoadableT } from '@mkrause/lifecycle-loader';

import { AxiosResponse } from 'axios';
import { Methods, Resources, Resource, ResourcePath, Agent, StorePath, URI, contextKey, Context } from './Resource.js';
//import StorablePromise from './StorablePromise.js';


// Type of a schema
export type ItemSchema = t.Type<any>;

// Type of the spec used to define an ItemResource (after merging with defaults and context)
export type ItemResourceSpec<Schema extends ItemSchema> = {
    path : ResourcePath,
    store : StorePath,
    uri : URI,
    methods : { // ThisType<42> &
        // get ?: (context : { spec : ItemResourceSpec<Schema> }, params : {}) => Promise<unknown>,
        //get : (params : {}) => Promise<Schema>,
        // put ?: (context : { spec : ItemResourceSpec<Schema> }, item : Schema) => Promise<unknown>,
        // patch ?: (context : { spec : ItemResourceSpec<Schema> }, item : Schema) => Promise<unknown>,
        // delete ?: (context : { spec : ItemResourceSpec<Schema> }) => Promise<unknown>,
        [method : string] : (...args : unknown[]) => unknown,
    },
    resources : {
        [resource : string] : (context : Context) => Resource,
    },
};




export class DecodeError extends Error {
    readonly errors : ValidationErrors;
    
    constructor(reason : string, errors : ValidationErrors) {
        super(reason);
        this.errors = errors;
    }
}


type ResourceContext<Schema extends ItemSchema> = {
    agent : Agent,
    spec : Required<ItemResourceSpec<Schema>>,
    schema : Schema,
    schemaMethods : typeof schemaMethods,
    storable: <T>(promise : Promise<T>) => Promise<T> & { storable : unknown },
};
type ResourceWithContext<Schema extends ItemSchema> = Resource & { [contextKey] : ResourceContext<Schema> };

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
    
    decode<Schema extends ItemSchema>(resource : ResourceWithContext<Schema>, input : unknown) {
        const { agent, spec, schema, schemaMethods } = resource[contextKey];
        
        return schemaMethods.report(schema.decode(input));
    },
    
    encode<Schema extends ItemSchema>(resource : ResourceWithContext<Schema>, instance : unknown) {
        const { agent, spec, schema, schemaMethods } = resource[contextKey];
        
        return schema.encode(instance);
    },
};

const itemDefaults = {
    store: [],
    uri: '',
    resources: {},
    methods: {
        async head<Schema extends ItemSchema>(this : ResourceWithContext<Schema>, params = {}) {
            const { agent, spec, schema, schemaMethods } = this[contextKey];
            const response = await agent.head(spec.uri, { params });
            return response;
        },
        
        async get<Schema extends ItemSchema>(this : ResourceWithContext<Schema>, params = {}) {
            const { agent, spec, schema, schemaMethods } = this[contextKey];
            const response = await agent.get(spec.uri, { params });
            return schemaMethods.decode(this, schemaMethods.parse(response));
        },
        
        async put<Schema extends ItemSchema>(this : ResourceWithContext<Schema>, instance : unknown, params = {}) {
            const { agent, spec, schema, schemaMethods } = this[contextKey];
            
            const instanceEncoded = schemaMethods.encode(this, instance);
            
            const response = await agent.put(spec.uri, instanceEncoded, { params });
            return schemaMethods.report(schema.decode(schemaMethods.parse(response)));
        },
        
        async patch<Schema extends ItemSchema>(this : ResourceWithContext<Schema>, instance : unknown, params = {}) {
            const { agent, spec, schema } = this[contextKey];
            
            const schemaPartial = schemaMethods.partial(schema);
            
            const instanceEncoded = schema.encode(instance);
            
            const response = await agent.patch(spec.uri, instanceEncoded, { params });
            return schemaMethods.report(schema.decode(schemaMethods.parse(response)));
        },
        
        async delete<Schema extends ItemSchema>(this : ResourceWithContext<Schema>,
            instanceEncoded : unknown, params = {}
        ) {
            const { agent, spec, schema } = this[contextKey];
            
            const response = await agent.delete(spec.uri, { params });
            return response.data;
        },
        
        async post<Schema extends ItemSchema>(this : ResourceWithContext<Schema>, body : unknown, params = {}) {
            const { agent, spec, schema } = this[contextKey];
            
            const response = await agent.post(spec.uri, { params });
            return response.data;
        },
    },
};


export const ItemResource =
    <Schema extends ItemSchema, Spec extends Partial<ItemResourceSpec<Schema>>>(
        schema : Schema, itemSpec : Spec = {} as Spec
    ) => {
        type MethodsFromSpec<M extends ItemResourceSpec<Schema>['methods']> =
            //{ [key in keyof M] : M[key] extends (context : any, ...args : infer A) => infer R ? (...args : A) => R : never };
            { [key in keyof M] : M[key] extends (...args : infer A) => infer R ? (...args : A) => R : never };
        type ResourcesFromSpec<R extends ItemResourceSpec<Schema>['resources']> =
            { [key in keyof R] : R[key] extends (context : Context) => infer R ? R : never };
        
        
        // The interface of the resource, split up into its base components
        type ResourceBase = {
            methods : Merge<(typeof itemDefaults)['methods'], MethodsFromSpec<Spec['methods'] & {}>>,
            resources : ResourcesFromSpec<Spec['resources'] & {}>,
        };
        
        // The interface of the resource, after merging the different components and adding context information
        type ResourceResult =
            Resource<ResourceBase['methods'], ResourceBase['resources']>
            & { [contextKey] : ResourceContext<Schema> };
        
        const makeResource = (context : Context) : ResourceResult => {
            const { agent, options } = context;
            
            const isRoot = context.path.length === 0;
            const label = isRoot ? null : context.path[context.path.length - 1];
            
            // Parse the item specification
            const itemDefaultsWithContext = merge(itemDefaults, {
                store: isRoot ? [] : [label],
                uri: isRoot ? '' : label,
            });
            const spec : ItemResourceSpec<Schema> = merge(itemDefaultsWithContext, itemSpec) as any; // FIXME
            
            // Make relative
            // TODO: allow the spec to override this and use absolute references instead
            spec.store = [...context.store, ...spec.store];
            spec.uri = concatUri([context.uri, spec.uri]);
            
            
            // Get methods
            const methods = spec.methods as ResourceBase['methods'];
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
                (resource : (ctx : Context) => Resource, resourceKey : string | number) => {
                    const resourceContext = {
                        agent: context.agent,
                        options: context.options,
                        path: [...context.path, resourceKey],
                        store: spec.store,
                        uri: spec.uri,
                    };
                    return resource(resourceContext);
                }
            ) as ResourceBase['resources'];
            
            const resource = {
                ...methods,
                ...resources,
                [contextKey]: {
                    agent,
                    spec,
                    schema,
                    schemaMethods,
                    storable: <T>(promise : Promise<T>) => {
                        // TODO: make a `@storable` decorator that applies this function
                        // Reason: using a wrapper function probably won't work inside an async function, because
                        // we lose the promise in the `await` chain. But wrapping the entire async function in a
                        // decorator should work.
                        
                        return Object.assign(promise, {
                            storable: { location: spec.store, operation: 'put' },
                        });
                    },
                },
            } as unknown as ResourceResult;
            
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
})(testContext);

const x0 : Agent = test[contextKey].agent;
const x1 : 42 = test.foo();
const x2 : Promise<unknown> = test.get();
*/
