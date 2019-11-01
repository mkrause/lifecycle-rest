
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

import { Schema, DecodeError } from '../schema/Schema.js';

import { AxiosResponse } from 'axios';
import { Index, ResourcePath, URI, StorePath, Agent, Context, Resource, resourceDef } from './Resource.js';

import ItemResource, { ItemResourceT, ItemSchema, ItemResourceSpec } from './ItemResource.js';

/*
export type CollectionSchema = unknown;
export type CollectionResourceSpec<Schema extends CollectionSchema> = {
    path ?: ResourcePath,
    store ?: StorePath,
    uri ?: URI,
    methods ?: {
        get ?: (context : { spec : CollectionResourceSpec<Schema> }, params : {}) => Promise<unknown>,
        put ?: (context : { spec : CollectionResourceSpec<Schema> }, item : Schema) => Promise<unknown>,
        delete ?: (context : { spec : CollectionResourceSpec<Schema> }) => Promise<unknown>,
        [method : string] : undefined | ((context : { spec : CollectionResourceSpec<Schema> }, ...args : any[]) => unknown),
    },
    resources ?: {
        [resource : string] : (context : Context) => Resource,
    },
    entry : (context : Context) => Resource,
};


type MethodsFromSpec<S extends CollectionSchema, M extends Required<CollectionResourceSpec<S>>['methods']> =
    { [key in keyof M] : M[key] extends (context : any, ...args : infer A) => infer R ? (...args : A) => R : never };
type ResourcesFromSpec<S extends CollectionSchema, R extends Required<CollectionResourceSpec<S>>['resources']> =
    { [key in keyof R] : R[key] extends (context : Context) => infer Res ? Res : never };
type EntryFromSpec<S extends CollectionSchema, E extends Required<CollectionResourceSpec<S>>['entry']> =
    E extends (context : Context) => infer R ? R : never;

type DefaultMethods = {
    get : (params ?: {}) => Promise<unknown>,
};

export const CollectionResource =
    <Schema extends CollectionSchema, Spec extends CollectionResourceSpec<Schema>>(schema : Schema, spec : Spec) =>
    (context : Context) : Resource<
        MethodsFromSpec<Schema, Spec['methods'] & {}> & DefaultMethods,
        ResourcesFromSpec<Schema, Spec['resources'] & {}>,
        { (index : ResourcePathStep) : EntryFromSpec<Schema, Spec['entry']> }
    > => {
        const { path, store, uri } = context;
        return null as any;
    };

export default CollectionResource;
*/

export type CollectionSchema = ItemSchema;
export type CollectionResourceSpec<S extends CollectionSchema> = ItemResourceSpec<S>;

export type CollectionResourceT<S extends CollectionSchema> = ItemResourceT<S>
    & ((index : Index) => Resource<Schema>);

const collectionMethods = {
    async list<S extends CollectionSchema>(this : CollectionResourceT<S>, params = {}) {
        const { agent, schema, schemaMethods, ...spec } = this[resourceDef];
        const response = await agent.get(spec.uri, { params });
        return schemaMethods.decode(this, schemaMethods.parse(response));
    },
    
    async post<S extends CollectionSchema>(this : CollectionResourceT<S>,
        instance : unknown, params = {}
    ) {
        const { agent, schema, schemaMethods, ...spec } = this[resourceDef];
        
        const entryResource = this('[new]'); // FIXME
        const { schema: entrySchema, schemaMethods: entrySchemaMethods } = entryResource[resourceDef];
        
        const instanceEncoded = entrySchemaMethods.encode(entryResource, instance);
        
        const response = await agent.post(spec.uri, instanceEncoded, { params });
        return entrySchemaMethods.report(schema.decode(entrySchemaMethods.parse(response)));
    },
};

export const CollectionResource = <
        S extends CollectionSchema,
        Spec extends Partial<CollectionResourceSpec<S>>
    >(schema : S, collectionSpec : Spec = {} as Spec) => {
        // TODO: need to add the additional methods (like `list`) to this interface
        type CollectionResourceT<S extends ItemSchema> = ItemResourceT<S>;
        
        const collectionSpecProcessed = merge(
            {
                methods: collectionMethods,
            },
            collectionSpec,
        );
        
        const itemResource = ItemResource(schema, collectionSpecProcessed);
        
        return itemResource as unknown as CollectionResourceT<S>;
    };

export default CollectionResource;
