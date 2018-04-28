
import env from '../util/env.js';
import merge from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import uuid from 'uuid';
import $uri from 'uri-tag';


const collectionDefaults = {
    store: [],
    uri: '',
    methods: {
        list: (spec, { hint = null, params = {}} = {}) => {
            return agent.get(spec.uri);
        },
        create: (spec, entity) => {
            return agent.post(`${spec.uri}`).send(entity.toJSON());
        },
        get: (spec, index) => {
            return agent.get(`${spec.uri}/${index}`);
        },
        update: (spec, index, entity) => {
            // TODO: prefer to use PATCH (if available)
            return agent.put(`${spec.uri}/${index}`).send(entity.toJSON());
        },
        delete: (spec, index) => {
            return agent.delete(`${spec.uri}/${index}`);
        },
    },
    resources: {},
};

// Redux action creators for collection resources. Compatible with redux-thunk.
const reduxActions = {
    // Clear an item from the store
    // Note: this does not actually delete the item
    dispose: (EntityType, spec) => (...args) => dispatch => {
        // TODO: need to invalidate the Collection (update status)
        
        const cursor = spec.store;
        dispatch({ type: 'api.dispose', path: cursor });
        
        return Promise.resolve();
    },
    list: (EntityType, spec) => (...args) => dispatch => {
        const requestId = uuid();
        
        const cursor = spec.store;
        const emptyCollection = new EntityType.Collection([], { status: 'pending' });
        
        dispatch({ type: 'api.load', requestId, path: cursor, status: 'pending', value: emptyCollection });
        
        return spec.methods.list(spec, ...args)
            .then(response => {
                let collection;
                
                if (response.body instanceof Collection) {
                    collection = response.body;
                } else {
                    // Expected collection response format: `{ metadata : Object, items : Array<Item> }`
                    if (!response.body.hasOwnProperty('items') || !response.body.hasOwnProperty('metadata')) {
                        throw new TypeError('Invalid response format:', response.body);
                    }
                    
                    const { metadata, items } = response.body;
                    collection = collectionFromResponse(EntityType)(items);
                }
                
                dispatch({
                    type: 'api.load',
                    requestId,
                    path: cursor,
                    status: 'ready',
                    value: collection,
                    param: {
                        merge: true,
                    },
                });
                
                return collection;
            })
            .catch(reason => {
                const cursor = spec.store;
                dispatch({
                    type: 'api.load', requestId, path: cursor, status: 'error', reason,
                    value: new EntityType.Collection([], { status: 'error', reason }),
                });
                
                if (mode === 'development') {
                    console.error(reason);
                }
                return Promise.reject({ path: cursor, reason });
            });
    },
    create: (EntityType, spec) => (entity, ...args) => dispatch => {
        const requestId = uuid();
        const cursor = spec.store;
        
        return spec.methods.create(spec, entity, ...args)
            .then(response => {
                const responseValue = response.body;
                const [index, entity] = makeEntry(EntityType, responseValue);
                
                dispatch({ type: 'api.load', requestId, path: [...cursor, index], status: 'ready', value: entity });
                
                return { index, entity };
            })
            .catch(reason => {
                if (mode === 'development') {
                    console.error(reason);
                }
                return Promise.reject({ reason });
            });
    },
    get: (EntityType, spec) => (index, ...args) => dispatch => {
        const requestId = uuid();
        const cursor = spec.store;
        
        dispatch({
            type: 'api.load', requestId, path: [...cursor, index], status: 'pending',
            value: new EntityType().withStatus('pending'),
        });
        
        return spec.methods.get(spec, index, ...args)
            .then(response => {
                const responseValue = response.body;
                
                if (typeof responseValue !== 'object' || !responseValue) {
                    throw new TypeError(`Invalid response, expected object: ${JSON.stringify(responseValue)}`);
                }
                
                const entity = makeEntity(EntityType, responseValue);
                dispatch({
                    type: 'api.load',
                    requestId,
                    path: [...cursor, index],
                    status: 'ready',
                    value: entity,
                });
                
                // Links
                
                // TEMP: disabled
                // const links = responseValue['_links'] || {};
                // const embedded = responseValue['_embedded'] || {};
                const links = {};
                const embedded = {};
                
                for (let link in links) {
                    if (spec.resources.hasOwnProperty(link)) {
                        // Do we have an embedded response? If so, load it
                        if (embedded.hasOwnProperty(link)) {
                            const embeddedResponse = embedded[link];
                            
                            const context = { agent, path: [...path, index] };
                            const subresource = spec.resources[link](index)(context);
                            
                            const value = subresource._valueFromResponse(embeddedResponse);
                            
                            const cursor = subresource._spec.store;
                            dispatch({ type: 'api.load', requestId, path: [...cursor, index], status: 'ready', value });
                        }
                    }
                }
                
                return entity;
            })
            .catch(reason => {
                const cursor = spec.store;
                dispatch({
                    type: 'api.load', requestId, path: [...cursor, index], status: 'error', reason,
                    value: new EntityType().withStatus('error'),
                });
                
                if (mode === 'development') {
                    console.error(reason);
                }
                return Promise.reject({ path: [...cursor, index], reason });
            });
    },
    update: (EntityType, spec) => (index, entity, ...args) => dispatch => {
        const requestId = uuid();
        const cursor = spec.store;
        return spec.methods.update(spec, index, entity, ...args)
            .then(response => {
                const responseValue = response.body;
                
                const entity = new EntityType(responseValue).withStatus('ready');
                dispatch({ type: 'api.load', requestId, path: [...cursor, index], status: 'ready', value: entity });
                
                return entity;
            })
            .catch(reason => {
                dispatch({
                    type: 'api.load', requestId, path: [...cursor, index], status: 'error', reason,
                    value: new EntityType().withStatus('error'),
                });
                
                if (mode === 'development') {
                    console.error(reason);
                }
                return Promise.reject({ path: [...cursor, index], reason });
            });
    },
    delete: (EntityType, spec) => (index, ...args) => dispatch => {
        const requestId = uuid();
        const cursor = spec.store;
        return spec.methods.delete(spec, index, ...args)
            .then(response => {
                const responseValue = response.body;
                dispatch({ type: 'api.dispose', path: [...cursor, index] });
                
                return undefined; // No return value
            })
            .catch(reason => {
                if (mode === 'development') {
                    console.error(reason);
                }
                return Promise.reject({ path: [...cursor, index], reason });
            });
    },
};

const CollectionResource = (EntityType, collectionSpec) => ({ agent, rootSpec, parentSpec, path }) => {
    const label = path[path.length - 1]; // Last path item (i.e. the key of the current resource)
    
    const collectionDefaultsWithContext = merge(collectionDefaults, {
        store: [...parentSpec.store, label],
        uri: `${parentSpec.uri}/${label}`,
    });
    const spec = merge(collectionDefaultsWithContext, collectionSpec);
    
    // Collection methods
    const methods = {
        dispose: reduxActions.dispose(EntityType, spec),
        list: reduxActions.list(EntityType, spec),
        create: reduxActions.create(EntityType, spec),
        get: reduxActions.get(EntityType, spec),
        update: reduxActions.update(EntityType, spec),
        delete: reduxActions.delete(EntityType, spec),
    };
    
    // Take an index into this collection, and return a new API resource representing that entry resource
    const getEntry = index => {
        const entryPath = [...path, index];
        
        const methods = ObjectUtil.mapValues(spec.resources, (resource, resourceKey) => {
            const resourceContext = {
                agent,
                rootSpec,
                parentSpec: spec,
                path: [...entryPath, resourceKey],
            };
            return resource(resourceContext);
        });
        
        methods._path = entryPath;
        
        return methods;
    };
    
    Object.assign(getEntry, methods);
    
    // Common interface to get a value from a response for this API resource type
    //getEntry._valueFromResponse = collectionFromResponse(EntityType);
    //getEntry._spec = spec;
    
    //console.log('col', spec, getEntry);
    
    return getEntry;
};

export default CollectionResource;
