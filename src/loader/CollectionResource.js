// @flow

import env from '../util/env.js';
import merge from '../util/merge.js';
import uuid from 'uuid';
import $msg from 'message-tag';
import $uri from 'uri-tag';

import ItemResource from './ItemResource.js';

import { status, Loadable } from '@mkrause/lifecycle-loader';
import type { LoadableT } from '@mkrause/lifecycle-loader';
import { Entity, Collection, Schema } from '@mkrause/lifecycle-immutable';

import StorablePromise from './StorablePromise.js';


// FIXME: SchemaI should be a constructor function with static properties and instance properties.
// Need to figure out how to express this in flow
type InstanceI = LoadableT;
type SchemaI = {
    empty : () => InstanceI,
    
    decode : (instanceEncoded) => {};
};

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
        // create: (spec, entity) => {
        //     return agent.post(`${spec.uri}`).send(entity.toJSON());
        // },
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
    resources: {},
});


const loaders = {
    // Invalidate an item in the store and clear the corresponding data. Note: does *not* perform a
    // delete operation in the API, only clears the information that's currently in loaded the store.
    dispose: (Schema : SchemaI, spec) => (...options) => {
        const emptyCollection = Schema.empty();
        
        return StorablePromise.from(
            Loadable(null),
            { location: spec.store, operation: 'put' },
            Promise.resolve(emptyCollection)
        );
    },
    
    // Load a complete collection.
    list: (Schema : SchemaI, spec) => (...options) => {
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
    query: (Schema : SchemaI, spec) => (...options) => {
        const decode = response => {
            if (typeof Schema === 'function' && response instanceof Schema) {
                return response;
            }
            
            // Parse the response
            const instanceEncoded = spec.parse(response.data);
            
            // Parse the encoded instance as an instance of the schema
            const collectionResult = Schema.decode(instanceEncoded);
            
            return collectionResult;
        };
        
        return StorablePromise.from(
            Loadable(null),
            { location: spec.store, operation: 'merge' },
            spec.methods.query(spec, decode, ...options)
        );
    },
    
    create: (Schema : SchemaI, spec) => (...options) => {
        //...
    },
};

const CollectionResource = (Schema : SchemaI, collectionSpec) => ({ agent, rootSpec, parentSpec, path }) => {
    // Last path item (i.e. the key of the current resource)
    const label = parentSpec === null ? null : path[path.length - 1];
    
    const collectionDefaultsWithContext = merge(collectionDefaults(agent), {
        store: parentSpec === null ? [] : [...parentSpec.store, label],
        uri: parentSpec === null ? '' : `${parentSpec.uri}/${label}`,
    });
    const spec = merge(collectionDefaultsWithContext, collectionSpec);
    
    // Collection methods
    // const methods = {
    //     dispose: reduxActions.dispose(Schema, spec),
    //     list: reduxActions.list(Schema, spec),
    //     create: reduxActions.create(Schema, spec),
    //     get: reduxActions.get(Schema, spec),
    //     update: reduxActions.update(Schema, spec),
    //     delete: reduxActions.delete(Schema, spec),
    // };
    
    // Take an index into this collection, and return a new API resource representing that entry resource
    const getEntry = index => {
        const entryPath = [...path, index];
        
        const itemContext = {
            agent,
            rootSpec,
            parentSpec: spec,
            path: [...path, index],
        };
        
        return ItemResource({
            resources: spec.resources,
        });
    };
    
    // Object.assign(getEntry, methods);
    
    // Common interface to get a value from a response for this API resource type
    //getEntry._valueFromResponse = collectionFromResponse(Schema);
    //getEntry._spec = spec;
    
    return Object.assign(getEntry, {
        dispose: loaders.dispose(Schema, spec),
        list: loaders.list(Schema, spec),
        query: loaders.query(Schema, spec),
        create: loaders.create(Schema, spec),
        
        // get: loaders.get(Schema, spec),
        // put: loaders.put(Schema, spec),
        // patch: loaders.patch(Schema, spec),
    });
};

export default CollectionResource;
