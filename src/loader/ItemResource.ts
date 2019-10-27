
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

// Type of 
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
export type PartialItemResourceSpec<Schema extends ItemSchema> = Partial<ItemResourceSpec<Schema>>;




const parse = (response : AxiosResponse) => {
    if (response.status === 204) { return null; }
    return response.data;
};
const format = (item : any) => item;

export class DecodeError extends Error {
    readonly errors : ValidationErrors;
    
    constructor(reason : string, errors : ValidationErrors) {
        super(reason);
        this.errors = errors;
    }
}

const report = (decodeResult : t.Validation<any>) => { // TEMP
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
};

/*
const partial = (schema : t.Type) => {
    if (schema.props) {
        return t.partial(schema.props);
    } else {
        return schema;
    }
};
*/

type ResourceContext<Schema extends ItemSchema> = {
    agent : Agent,
    spec : Required<ItemResourceSpec<Schema>>,
    schema : Schema,
    storable: <T>(promise : Promise<T>) => Promise<T> & { storable : unknown },
};
type ResourceWithContext<Schema extends ItemSchema> = Resource & { [contextKey] : ResourceContext<Schema> };

const itemDefaults = {
    store: [],
    uri: '',
    resources: {},
    methods: {
        /*
        async head(params = {}) {
            const response = await agent.head(spec.uri, { params });
            return response;
        },
        
        async options(params = {}) {
            const response = await agent.options(spec.options, { params });
            return response;
        },
        */
        
        async _get<Schema extends ItemSchema>(this : ResourceWithContext<Schema>, params = {}) {
            const { agent, spec, schema } = this[contextKey];
            
            const response = await agent.get(spec.uri, { params });
            return report(schema.decode(parse(response)));
        },
        get(...args : any[]) { return (this as any)._get(...args); },
        
        /*
        async _put(instance, params = {}) {
            const { agent, spec, schema } = this[contextKey];
            
            const instanceEncoded = schema.encode(instance);
            
            const response = await agent.put(spec.uri, instanceEncoded, { params });
            return report(schema.decode(parse(response)));
        },
        put(...args) { return this._put(...args); },
        
        async _patch(instance, params = {}) {
            const { agent, spec, schema } = this[contextKey];
            
            const schemaPartial = partial(schema);
            
            const instanceEncoded = schema.encode(instance);
            
            const response = await agent.patch(spec.uri, instanceEncoded, { params });
            return report(schema.decode(parse(response)));
        },
        patch(...args) { return this._patch(...args); },
        
        async _delete(instanceEncoded, params = {}) {
            const { agent, spec, schema } = this[contextKey];
            
            const response = await agent.delete(spec.uri, { params });
            return response.data;
        },
        delete(...args) { return this._delete(...args); },
        
        async _post(body, params = {}) {
            const { agent, spec, schema } = this[contextKey];
            
            const response = await agent.post(spec.uri, { params });
            return response.data;
        },
        post(...args) { return this._post(...args); },
        */
    },
};


type DefaultMethods = {
    get : (params ?: {}) => Promise<unknown>,
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
        
        type SpecParsed = ItemResourceSpec<Schema> & {
            methods : Merge<DefaultMethods, MethodsFromSpec<Spec['methods'] & {}>>,
            resources : ResourcesFromSpec<Spec['resources'] & {}>,
        };
        
        type ResultResource =
            Resource<
                MethodsFromSpec<NonNullable<Spec['methods']>> & DefaultMethods,
                ResourcesFromSpec<NonNullable<Spec['resources']>>
            > & { [contextKey] : ResourceContext<Schema> };
        
        //return null as any as ResultResource;
        
        const makeResource = (context : Context) : ResultResource => {
            const { agent, options } = context;
            
            const isRoot = context.path.length === 0;
            const label = isRoot ? null : context.path[context.path.length - 1];
            
            // Parse the item specification
            const itemDefaultsWithContext = merge(itemDefaults, {
                store: isRoot ? [] : [label],
                uri: isRoot ? '' : label,
            });
            const spec : Required<Spec> = merge(itemDefaultsWithContext, itemSpec) as any; // FIXME
            
            // Make relative
            // TODO: allow the spec to override this and use absolute references instead
            spec.store = [...context.store, ...spec.store];
            spec.uri = concatUri([context.uri, spec.uri]);
            
            
            // Get methods
            const methods = spec.methods;
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
            const resources = ObjectUtil.mapValues(spec.resources, (resource, resourceKey) => {
                const resourceContext = {
                    agent: context.agent,
                    options: context.options,
                    path: [...context.path, resourceKey],
                    store: spec.store,
                    uri: spec.uri,
                };
                return resource(resourceContext);
            });
            
            const resource : ResultResource = {
                ...methods,
                ...resources,
                [contextKey]: {
                    agent,
                    spec,
                    schema,
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
            };
            
            return resource;
        };
        
        return Object.assign(makeResource, {
            schema, // Expose the schema on the constructor
        });
    };

export default ItemResource;


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

// const x1 : never = test.foo();
const x2 : never = test[contextKey].agent;
