// @flow

import env from '../util/env.js';
import merge from '../util/merge.js';
import uuid from 'uuid';
import $msg from 'message-tag';
import $uri from 'uri-tag';
import { concatUri } from '../util/uri.js';

import { status, Loadable } from '@mkrause/lifecycle-loader';
import type { LoadableT } from '@mkrause/lifecycle-loader';
import { Entity, Collection, Schema } from '@mkrause/lifecycle-immutable';

import StorablePromise from './StorablePromise.js';
import { SimpleItem } from './Resource.js';
import type { ItemSchema } from './Resource.js';
import ItemResource, { SimpleResource } from './ItemResource.js';



const collectionDefaults = agent => ({
    store: [],
    uri: '',
    parse: response => {
        if (Array.isArray(response)) {
            return response;
        } else {
            throw new TypeError($msg`Unknown collection response format: ${response}`);
        }
    },
    methods: {
        query: async (spec, decode, query) => {
            const items = decode(await agent.get(spec.uri, { params: query }));
            
            // Note: user-defined implementations will likely add more info here, like counts for
            // total/filtered records.
            const queryResult = {
                items,
            };
            
            return queryResult;
        },
        list: (spec, { hint = null } = {}) => {
            return agent.get(spec.uri);
        },
        create: (spec, item) => {
            return agent.post(spec.uri, spec.entry.schema.encode(item));
        },
        // get: (spec, index) => {
        //     return agent.get(`${spec.uri}/${index}`);
        // },
        // update: (spec, index, entity) => {
        //     // TODO: prefer to use PATCH (if available)
        //     return agent.put(`${spec.uri}/${index}`).send(entity.toJSON());
        // },
        // delete: (spec, index) => {
        //     return agent.delete(`${spec.uri}/${index}`);
        // },
    },
    entry: ItemResource(SimpleItem),
    resources: {},
});


const loaders = {
    // Invalidate an item in the store and clear the corresponding data. Note: does *not* perform a
    // delete operation in the API, only clears the information that's currently in loaded the store.
    dispose: (Schema : ItemSchema, spec) => (...options) => {
        const emptyCollection = Schema.empty();
        
        return StorablePromise.from(
            Loadable(null),
            { location: spec.store, operation: 'put' },
            Promise.resolve(emptyCollection)
        );
    },
    
    // Load a complete collection.
    list: (Schema : ItemSchema, spec) => (...options) => {
        return StorablePromise.from(
            Loadable(null),
            { location: spec.store, operation: 'put' },
            spec.methods.list(spec, ...options)
                .then(response => {
                    if (typeof Schema === 'function' && response instanceof Schema) {
                        return response;
                    }
                    
                    // Parse the response
                    const instanceEncoded = spec.parse(response.data);
                    
                    // Parse the encoded instance as an instance of the schema
                    const collectionResult = Schema.decode(instanceEncoded);
                    
                    return collectionResult;
                })
        );
    },
    
    // Load a partial collection by means of a collection query (ordering, filtering, etc.). Should result
    // in a subset of the collection's entries being loaded in the store. In addition, any query-specific
    // information is returned  to the caller (like ordering, query statistics (count), etc.).
    // query: (Schema : ItemSchema, spec) => (...options) => {
    //     const decode = response => {
    //         if (typeof Schema === 'function' && response instanceof Schema) {
    //             return response;
    //         }
    //         
    //         // Parse the response
    //         const instanceEncoded = spec.parse(response.data);
    //         
    //         // Parse the encoded instance as an instance of the schema
    //         const collectionResult = Schema.decode(instanceEncoded);
    //         
    //         return collectionResult;
    //     };
    //     
    //     const updateStore = result => {
    //         if (typeof result === 'object' && result && result.items && status in result.items) {
    //             //...
    //         }
    //     };
    //     
    //     return StorablePromise.from(
    //         Loadable(null),
    //         { location: spec.store, operation: updateStore },
    //         spec.methods.query(spec, decode, ...options)
    //     );
    // },
    
    // Add a new entry to the collection. This is essentially an operation on a specific entry, not the
    // collection. However, in this case we do not yet have a key. You can think of `create()` as a
    // combination of a "generate key" operation, and a write to that key.
    create: (Schema : ItemSchema, spec) => (item, ...options) => {
        const EntrySchema = spec.entry.schema;
        
        return StorablePromise.from(
            Loadable(null),
            { location: spec.store, operation: 'put' },
            spec.methods.create(spec, item, ...options)
                .then(response => {
                    // Note: we need at minimum the key of the item that has been created. Usually the
                    // result of a create operation will the item as it would be returned by a get on
                    // that resource, so we can immediately load that into the store.
                    
                    if (typeof EntrySchema === 'function' && response instanceof EntrySchema) {
                        return response;
                    }
                    
                    // Parse the response
                    const parseItem = response => response; // TODO: make configurable
                    const instanceEncoded = parseItem(response.data);
                    
                    // Parse the encoded instance as an instance of the schema
                    const entryResult = EntrySchema.decode(instanceEncoded);
                    
                    return entryResult;
                })
        );
    },
};

const CollectionResource = (Schema : ItemSchema, collectionSpec) => context => {
    const { agent, config } = context;
    
    const isRoot = context.path.length === 0;
    const label = isRoot ? null : context.path[context.path.length - 1];
    
    
    // Parse the collection specification
    const collectionDefaultsWithContext = merge(collectionDefaults(agent), {
        store: isRoot ? [] : [label],
        uri: isRoot ? '' : label,
    });
    const spec = merge(collectionDefaultsWithContext, collectionSpec);
    
    // Make relative
    // TODO: allow the spec to override this and use absolute references instead
    spec.store = [...context.store, ...spec.store];
    spec.uri = concatUri([context.uri, spec.uri]);
    
    const methods = {
        dispose: loaders.dispose(Schema, spec),
        list: loaders.list(Schema, spec),
        //query: loaders.query(Schema, spec),
        create: loaders.create(Schema, spec),
        
        // get: loaders.get(Schema, spec),
        // put: loaders.put(Schema, spec),
        // patch: loaders.patch(Schema, spec),
    };
    
    const customMethods = spec.methods;
    
    // Take an index into this collection, and return a new API resource representing that entry resource
    const EntrySchema = Schema.getEntrySchema; // TODO
    const getEntry = index => {
        const entryContext = {
            agent: context.agent,
            config: context.config,
            path: [...context.path, index],
            store: spec.store,
            uri: spec.uri,
        };
        
        return spec.entry(entryContext);
    };
    
    // Expose some information about this resource
    const info = {
        _spec: spec,
    };
    
    return Object.assign(getEntry, customMethods, methods, info);
};

export default CollectionResource;
