
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
