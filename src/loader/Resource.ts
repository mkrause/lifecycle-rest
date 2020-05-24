
import $msg from 'message-tag';
import type { AxiosInstance } from 'axios';

import { Schema } from '../schema/Schema.js';

import type { AdapterT } from './Adapter.js';
import * as Location from './Location.js';


export type Agent = AxiosInstance;
export type ResourcePathStep = Location.Step;
export type ResourcePath = Location.Location;
export type URI = string;
export type StorePath = Location.Location;

export type Options = {
    agent : Agent,
    adapter : AdapterT,
};

export type Context = {
    options : Options, // Root-level options
    path : ResourcePath,
    uri : URI,
    store : StorePath,
    agent : Agent,
};

export type ResourceDefinition<S extends Schema> = Context & {
    schema : S,
    methods : any, // FIXME
    adapter : AdapterT,
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
        [method : string] : (...args : never[]) => unknown,
    },
    resources : {
        [resource : string] : ResourceCreator<Schema>,
    },
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
            // Note: do not use implicit default if the label is an index (otherwise we add it twice)
            store: label === null || Location.isIndexStep(label) ? defaults.store : [label],
            uri: label === null || Location.isIndexStep(label) ? defaults.uri : Location.stepAsString(label),
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
