
import { AxiosInstance } from 'axios';

/*
import { LoadableT } from '@mkrause/lifecycle';


// FIXME: do we really need LoadableT?
// FIXME: should we make traversal optional? (e.g. leaf node types)
export type Item = LoadableT & {
    // Traversal
    get : (index : mixed) => Item,
    set : (index : mixed, item : Item) => void,
};

export type ItemSchema = {
    instantiate : () => Item,
    decode : (instanceEncoded : mixed) => Item;
    encode : (instance : Item) => mixed;
};

// FIXME: does not adhere to Item type currently
export class SimpleItem implements ItemSchema {
    static instantiate() { return {}; }
    static decode(instanceEncoded : mixed) : Item { return instanceEncoded; }
    static encode(instance : Item) : mixed { return instance; }
}
*/


// Utility types

// Simplified version of `Merge` that doesn't take into account optional, and always overrides props of `A` with `B`
// See: https://github.com/pirix-gh/ts-toolbelt/blob/master/src/Object/MergeUp.ts
type At<O extends object, K extends PropertyKey> = K extends keyof O ? O[K] : never;
type MergeFlat<A extends object, B extends object> =
    A extends object ? B extends object ? ({ // Forces distribution
        [key in keyof (A & B)] : [At<B, key>] extends [never] ? At<A, key> : At<B, key>
    } & {}) : never : never;


// Resource
export type Methods = { [name : string] : (...args : unknown[]) => unknown };
//export type Resources = { [name : string] : Resource<any, any> };
export type Resources = {}; // FIXME
export type Entry = {};
export type Resource<M extends Methods = {}, R extends Resources = {}, E extends Entry = {}> = MergeFlat<M, R> & E;


// Context
export type Options = {};
export type ResourcePathStep = unknown;
export type ResourcePath = Array<ResourcePathStep>;
export type URI = string;
export type StorePath = Array<unknown>;
export type Agent = AxiosInstance;

export type Context = {
    options : Options,
    path : ResourcePath,
    uri : URI,
    store : StorePath,
    agent : Agent,
};
