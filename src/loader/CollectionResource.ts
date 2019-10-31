
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

import ItemResource, { ItemResourceT, ItemSchema, ItemResourceSpec, ResourceContext as ItemResourceContext } from './ItemResource.js';

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

type CollectionSchema = ItemSchema;
type CollectionResourceSpec<Schema extends CollectionSchema> = ItemResourceSpec<Schema>;

type CollectionResourceT<Schema extends CollectionSchema> =
    Resource<{}, {}, { <EntrySchema extends ItemSchema>(index : string) : ItemResourceT<EntrySchema> }>
    & { [contextKey] : ItemResourceContext<Schema> };

const collectionMethods = {
    async list<Schema extends CollectionSchema>(this : CollectionResourceT<Schema>, params = {}) {
        const { agent, spec, schema, schemaMethods } = this[contextKey];
        const response = await agent.get(spec.uri, { params });
        return schemaMethods.decode(this, schemaMethods.parse(response));
    },
    
    async post<Schema extends CollectionSchema>(this : CollectionResourceT<Schema>,
        instance : unknown, params = {}
    ) {
        const { agent, spec, schema, schemaMethods } = this[contextKey];
        
        const entryResource = this('[new]'); // FIXME
        const { schema: entrySchema, schemaMethods: entrySchemaMethods } = entryResource[contextKey];
        
        const instanceEncoded = entrySchemaMethods.encode(entryResource, instance);
        
        const response = await agent.post(spec.uri, instanceEncoded, { params });
        return entrySchemaMethods.report(schema.decode(entrySchemaMethods.parse(response)));
    },
};

export const CollectionResource = <
        Schema extends CollectionSchema,
        Spec extends Partial<CollectionResourceSpec<Schema>>
    >(schema : Schema, collectionSpec : Spec = {} as Spec) => {
        // TODO: need to add the additional methods (like `list`) to this interface
        type CollectionResourceT<Schema extends ItemSchema> = ItemResourceT<Schema>;
        
        const collectionSpecProcessed = merge(
            {
                methods: collectionMethods,
            },
            collectionSpec,
        );
        
        const itemResource = ItemResource(schema, collectionSpecProcessed);
        
        return itemResource as unknown as CollectionResourceT<Schema>;
    };

export default CollectionResource;
