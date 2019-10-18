
import $msg from 'message-tag';

import env from '../util/env.js';
import merge from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import $uri from 'uri-tag';
import { concatUri } from '../util/uri.js';

import { status, Loadable, LoadableT } from '@mkrause/lifecycle-loader';

import { Methods, Resources, Resource, ResourcePath, StorePath, URI, Context } from './Resource.js';
import StorablePromise from './StorablePromise.js';


/*
const itemDefaults = {
    store: [],
    uri: '',
    resources: {},
    methods: {
        
    },
};

const parse = response => {
    if (response.status === 204) {
        return null;
    }
    
    return response.data;
};

const format = item => item;

const ItemResource = (Schema, itemSpec = {}) => {
    const makeResource = context => {
        const { agent, config } = context;
        
        const isRoot = context.path.length === 0;
        const label = isRoot ? null : context.path[context.path.length - 1];
        
        // Parse the item specification
        const itemDefaultsWithContext = merge(itemDefaults, {
            store: isRoot ? [] : [label],
            uri: isRoot ? '' : label,
        });
        const spec = merge(itemDefaultsWithContext, itemSpec);
        
        // Make relative
        // TODO: allow the spec to override this and use absolute references instead
        spec.store = [...context.store, ...spec.store];
        spec.uri = concatUri([context.uri, spec.uri]);
        
        const customMethods = Object.entries(spec.methods)
            .filter(([methodName, method]) => methodName[0] !== '_')
            .map(([methodName, method]) => {
                const methodDecorated = (...args) => {
                    const methodResult = method({ spec, agent }, ...args);
                    
                    if (methodResult instanceof StorablePromise) {
                        return methodResult;
                    } else if (methodResult instanceof Promise) {
                        return StorablePromise.from(
                            Loadable(null),
                            { location: spec.store, operation: 'put' },
                            methodResult
                                .then(response => {
                                    const responseParsed = parse(response);
                                    return Schema.decode(responseParsed);
                                }),
                        );
                    } else {
                        throw new TypeError($msg`Unknown result ${methodResult}`);
                    }
                };
                
                return [methodName, methodDecorated];
            })
            .reduce((acc, [methodName, method]) => ({ ...acc, [methodName]: method }), {});
        
        const methods = {
            get(params = {}) {
                return StorablePromise.from(
                    Loadable(null),
                    { location: spec.store, operation: 'put' },
                    agent.get(spec.uri, { params })
                        .then(response => {
                            return Schema.decode(parse(response));
                        }),
                );
            },
            
            put(item, params = {}) {
                return StorablePromise.from(
                    Loadable(null),
                    { location: spec.store, operation: 'put' },
                    agent.put(spec.uri, format(Schema.encode(item)), { params })
                        .then(response => {
                            return Schema.decode(parse(response));
                        }),
                );
            },
            ...customMethods,
        };
        
        // Subresources
        const resources = ObjectUtil.mapValues(spec.resources, (resource, resourceKey) => {
            const resourceContext = {
                agent: context.agent,
                config: context.config,
                path: [...context.path, resourceKey],
                store: spec.store,
                uri: spec.uri,
            };
            return resource(resourceContext);
        });
        
        const resource = {
            ...methods,
            ...resources,
            _spec: spec, // Expose the spec
        };
        
        return resource;
    };
    
    return Object.assign(makeResource, {
        // Expose the schema
        schema: Schema,
    });
};

export default ItemResource;
*/


export type ItemSchema = {
    decode() : any,
    encode() : any,
};
export type ItemResourceSpec<Schema extends ItemSchema> = {
    path ?: ResourcePath,
    store ?: StorePath,
    uri ?: URI,
    methods ?: {
        get ?: (context : { spec : ItemResourceSpec<Schema> }, params : {}) => Promise<unknown>,
        put ?: (context : { spec : ItemResourceSpec<Schema> }, item : Schema) => Promise<unknown>,
        patch ?: (context : { spec : ItemResourceSpec<Schema> }, item : Schema) => Promise<unknown>,
        delete ?: (context : { spec : ItemResourceSpec<Schema> }) => Promise<unknown>,
        [method : string] : undefined | ((context : { spec : ItemResourceSpec<Schema> }, ...args : any[]) => unknown),
    },
    resources ?: {
        [resource : string] : (context : Context) => Resource,
    },
};


type MethodsFromSpec<S extends ItemSchema, M extends Required<ItemResourceSpec<S>>['methods']> =
    { [key in keyof M] : M[key] extends (context : any, ...args : infer A) => infer R ? (...args : A) => R : never };
type ResourcesFromSpec<S extends ItemSchema, R extends Required<ItemResourceSpec<S>>['resources']> =
    { [key in keyof R] : R[key] extends (context : Context) => infer R ? R : never };

type DefaultMethods = {
    get : (params ?: {}) => Promise<unknown>,
};


const itemDefaults = {
    store: [],
    uri: '',
    resources: {},
    methods: {
        
    },
};

const parse = response => {
    if (response.status === 204) {
        return null;
    }
    
    return response.data;
};

const format = item => item;

const report = (decodeResult : Either) => { // TEMP
    if (decodeResult._tag === 'Right') {
        return decodeResult.right;
    } else {
        throw new Error('TODO'); //decodeResult.left;
    }
};

export const ItemResource =
    <Schema extends ItemSchema, Spec extends ItemResourceSpec<Schema>>(
        schema : Schema, itemSpec : Spec = {} as Spec
    ) => {
        const makeResource = (context : Context) : Resource<
            MethodsFromSpec<Schema, Spec['methods'] & {}> & DefaultMethods,
            ResourcesFromSpec<Schema, Spec['resources'] & {}>
        > => {
            const { agent, options } = context;
            
            const isRoot = context.path.length === 0;
            const label = isRoot ? null : context.path[context.path.length - 1];
            
            // Parse the item specification
            const itemDefaultsWithContext = merge(itemDefaults, {
                store: isRoot ? [] : [label],
                uri: isRoot ? '' : label,
            });
            const spec = merge(itemDefaultsWithContext, itemSpec);
            
            // Make relative
            // TODO: allow the spec to override this and use absolute references instead
            spec.store = [...context.store, ...spec.store];
            spec.uri = concatUri([context.uri, spec.uri]);
            
            const customMethods = Object.entries(spec.methods)
                .filter(([methodName, method]) => methodName[0] !== '_')
                .map(([methodName, method]) => {
                    const methodDecorated = (...args) => {
                        const methodResult = method.call(spec, { context, agent, spec, schema }, ...args);
                        
                        if (methodResult instanceof StorablePromise) {
                            return methodResult;
                        } else if (methodResult instanceof Promise) {
                            return StorablePromise.from(
                                Loadable(null, { loading: true }),
                                // { location: spec.store, operation: 'put' }, // TEMP
                                methodResult
                                    .then(response => {
                                        const responseParsed = parse(response);
                                        return Loadable(report(schema.decode(responseParsed)), { ready: true });
                                    }),
                            );
                        } else {
                            return methodResult;
                        }
                    };
                    
                    return [methodName, methodDecorated];
                })
                .reduce((acc, [methodName, method]) => ({ ...acc, [methodName]: method }), {});
            
            const methods = {
                async get(params = {}) {
                    const response = await agent.get(spec.uri, { params });
                    return report(schema.decode(parse(response)));
                    
                    /*
                    return StorablePromise.from(
                        Loadable(null, { loading: true }),
                        // { location: spec.store, operation: 'put' }, // TEMP
                        agent.get(spec.uri, { params })
                            .then(response => {
                                return Loadable(report(schema.decode(parse(response))), { ready: true });
                            }),
                    );
                    */
                },
                
                put(item, params = {}) {
                    return StorablePromise.from(
                        Loadable(null, { loading: true }),
                        // { location: spec.store, operation: 'put' }, // TEMP
                        agent.put(spec.uri, format(schema.encode(item)), { params })
                            .then(response => {
                                return Loadable(report(schema.decode(parse(response))), { ready: true });
                            }),
                    );
                },
                ...customMethods,
            };
            
            // Subresources
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
            
            const resource = {
                ...methods,
                ...resources,
                _spec: spec, // Expose the spec
            };
            
            return resource;
        };
        
        return Object.assign(makeResource, {
            schema, // Expose the schema
        });
    };

export default ItemResource;
