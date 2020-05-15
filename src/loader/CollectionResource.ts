
import $msg from 'message-tag';

import env from '../util/env.js';
import merge, { Merge } from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import $uri from 'uri-tag';
import { concatUri } from '../util/uri.js';

import { Schema, DecodeError } from '../schema/Schema.js';
import * as t from 'io-ts';

import { AxiosResponse } from 'axios';
import type { Index, ResourcePath, URI, StorePath, Agent, Context, ResourceDefinition, Resource, ResourceCreator, ResourceSpec } from './Resource.js';
import { resourceDef, intantiateSpec } from './Resource.js';

import ResourceUtil, { ResourceUtilT } from './ResourceUtil.js';


export type CollSchema = Schema;

export type CollResourceSpec<S extends CollSchema> = ResourceSpec<S>
    & {
        entry : ResourceCreator<Schema>,
    };

// Generic collection resource type (i.e. as general as we can define it without knowing the actual spec)
export type CollResourceT<S extends CollSchema> = Resource<S>
    & ((index : Index) => Resource<Schema>);


const collectionDefaults = {
    path: [],
    uri: '',
    store: [],
    methods: {
        async list<S extends CollSchema>(this : CollResourceT<S>, params = {}) : Promise<t.TypeOf<S>> {
            const { agent, schema, util, ...spec } = this[resourceDef];
            const response = await agent.get(spec.uri, { params });
            return util.decode(this, util.parse(response));
        },
        
        async post<S extends CollSchema>(this : CollResourceT<S>,
            instance : unknown, params = {}
        ) {
            const { agent, schema, util, ...spec } = this[resourceDef];
            
            const entryResource = this('[new]'); // FIXME
            const { schema: entrySchema, util: entryUtil } = entryResource[resourceDef];
            
            const instanceEncoded = entryUtil.encode(instance);
            
            const response = await agent.post(spec.uri, instanceEncoded, { params });
            const entryResult : t.TypeOf<typeof entrySchema> = entryUtil.report(
                schema.decode(entryUtil.parse(response))
            );
            
            return entryResult;
        },
    },
    resources: {},
    entry: (index : Index) => { throw new TypeError($msg`Cannot construct entry`); },
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
            E extends (context : Context) => infer R ? (index : Index) => R : never;
        
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
        
        // return null as unknown as (context : Context) => CollResource;
        
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
            const makeEntry = ((index : Index) => {
                const entryContext = {
                    options: context.options,
                    agent: context.agent,
                    path: [...spec.path, { index }],
                    store: [...spec.store, index],
                    //uri: concatUri([spec.uri, String(index)]),
                    uri: spec.uri, // FIXME (currently index already added during `instantiateSpec`)
                };
                return (entry as any)(entryContext);
            }) as ResourceComponents['entry'];
            
            const resourceDefinition : ResourceDefinition<S> = {
                agent: context.agent,
                options: context.options,
                ...spec,
                schema,
                
                util: null as unknown as ResourceUtilT,
                
                /*
                storable: (promise : Promise<any>) => {
                    // TODO: make a `@storable` decorator that applies this function
                    // Reason: using a wrapper function probably won't work inside an async function, because
                    // we lose the promise in the `await` chain. But wrapping the entire async function in a
                    // decorator should work.
                    
                    return Object.assign(promise, {
                        storable: { location: spec.store, operation: 'put' },
                    });
                },
                */
            };
            resourceDefinition.util = ResourceUtil(resourceDefinition, schema);
            
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


/*
const testContext = {
    options : {},
    path : [],
    uri : '',
    store : [],
    agent : null as any,
};
const api0 = CollectionResource(t.string, {
    methods: {
        foo() { return 42 as const; },
    },
    resources: {
        coll: null as unknown as {
            schema : typeof t.string,
            (context : Context) : { [resourceDef] : any, foo : () => 10 },
        },
    },
    entry: null as unknown as {
        schema : typeof t.string,
        (context : Context) : { [resourceDef] : any, foo : () => 11 },
    },
})(testContext);
/*
const api = CollectionResource(t.string, {
    methods: {
        foo() { return 42 as const; }
    },
    resources: {
        coll: CollectionResource(t.string, {
            methods: {
                foo() { return 44 as const; }
            },
            resources: {},
        }),
    },
    entry: CollectionResource(t.string, {
        methods: {
            foo() { return 45 as const; }
        },
        resources: {},
    }),
})(testContext);
* /

// const test0 : (typeof api0) = null;
const test0 : never = api0('foo');
*/
