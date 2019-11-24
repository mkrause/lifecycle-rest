
import $msg from 'message-tag';
import { AxiosInstance } from 'axios';

import { Schema } from '../schema/Schema.js';


export type Index = string;

export type Options = {};
export type ResourcePathStep = string | { index : Index };
export type ResourcePath = Array<ResourcePathStep>;
export type URI = string;
export type StorePath = Array<ResourcePathStep>;
export type Agent = AxiosInstance;

export type Context = {
    options : Options, // Root-level options
    path : ResourcePath,
    uri : URI,
    store : StorePath,
    agent : Agent,
};

export type SchemaMethods<S extends Schema> = {
    // decode<S extends Schema>(resource : Resource<S>, input : unknown) {
    //     const { schema, schemaMethods } = resource[contextKey];
    //     return schemaMethods.report(schema.decode(input));
    // },
};

export type ResourceDefinition<S extends Schema> = Context & {
    schema : S,
    schemaMethods : any, //SchemaMethods<S>, // TODO
    storable : <T>(promise : Promise<T>) => Promise<T> & { storable : unknown },
};

export const resourceDef = Symbol('lifecycle.resourceDefinition');

export type Resource<S extends Schema> = { [resourceDef] : ResourceDefinition<S> };

export type ResourceCreator<S extends Schema> = {
    (context : Context) : Resource<S>,
    schema : S,
};


// Resource specifications

import merge, { Merge } from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import { concatUri } from '../util/uri.js';


export type ResourceSpec<S extends Schema> = {
    path : ResourcePath,
    uri : URI,
    store : StorePath,
    methods : { // ThisType<Resource> &
        [method : string] : (...args : any[]) => any,
    },
    resources : {
        [resource : string] : ResourceCreator<Schema>,
    },
};

const stringFromLabel = (label : ResourcePathStep) => {
    if (typeof label === 'string') {
        return label;
    } else if (typeof label === 'object' && label !== null && 'index' in label) {
        return String(label.index);
    } else {
        throw new TypeError($msg`Unexpected label, given ${label}`);
    }
};

// Instantiate the given partial spec to a complete spec, given context information
export const intantiateSpec = <S extends Schema, SpecT extends ResourceSpec<S>, Spec extends Partial<SpecT>>(
        context : Context,
        specPartial : Spec,
        defaults : ResourceSpec<S>,
    ) => {
        type Label = null | ResourcePathStep;
        
        // Descriptive label based on the nearest parent identifier (or `null` if root)
        const isRoot = context.path.length === 0;
        const label : Label = isRoot ? null : context.path[context.path.length - 1];
        
        // Add context-dependent defaults
        const defaultsWithContext = merge(defaults, {
            store: label === null ? defaults.store : [label],
            uri: label === null ? defaults.uri : stringFromLabel(label),
        }) as SpecT;
        
        // FIXME: the result of `merge` (using ts-toolbelt `Merge`) does not seem to be assignable to `SpecT` here
        const spec = merge(defaultsWithContext, specPartial) as unknown as SpecT;
        
        // Make relative
        // TODO: allow the spec to override this and use absolute references instead
        spec.path = [...context.path, ...spec.path];
        spec.store = [...context.store, ...spec.store];
        spec.uri = concatUri([context.uri, spec.uri]);
        
        
        /*
        // Construct methods
        spec.methods = ObjectUtil.mapValues(spec.methods, (method, methodName) => function(...args) {
            const result = method.apply(this, args);
            
            if (result instanceof Promise) {
                // @ts-ignore
                result.storable = { location: spec.store, operation: 'put' };
            }
            
            return result;
        });
        */
        
        // Instantiate subresources (with context)
        const specInstantiated = Object.assign(spec, {
            resources: ObjectUtil.mapValues(spec.resources,
                (resource : ResourceCreator<Schema>, resourceKey : string | number) => {
                    const resourceContext = {
                        options: context.options,
                        path: [...spec.path, String(resourceKey)],
                        uri: spec.uri,
                        store: spec.store,
                        agent: context.agent,
                    };
                    return resource(resourceContext);
                }
            ),
        });
        
        return specInstantiated;
    };
