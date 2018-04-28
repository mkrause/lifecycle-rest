
import _ from 'lodash';
import uuid from 'uuid';
import Imm from 'immutable';

import Schema from '../modeling/Schema.js';
import Entity from '../modeling/Entity.js';
import Collection from '../modeling/Collection.js';

import agent from './Agent.js';
import { collectionFromResponse, makeIndex, makeEntity, makeEntry } from './collection_util.js';


const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

// Create an API collection resource
export const collection = (EntityType, collectionSpec) => ({ agent, apiSpec, path }) => {
    const spec = _.defaultsDeep({}, collectionSpec, {
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
    });
    
    const methods = {
        list: (...args) => dispatch => {
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
        create: (entity, ...args) => dispatch => {
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
        get: (index, ...args) => dispatch => {
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
                                
                                const context = { agent, apiSpec, path: [...path, index] };
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
        update: (index, entity, ...args) => dispatch => {
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
        delete: (index, ...args) => dispatch => {
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
                });;
        },
        // Clear an item from the store
        // Note: this does not actually delete the item
        dispose: () => dispatch => {
            // TODO: need to invalidate the Collection (update status)
            
            const cursor = spec.store;
            dispatch({ type: 'api.dispose', path: cursor });
            
            return Promise.resolve();
        },
    };
    
    // Return a function, which takes the current index, and returns a set of subresources
    const construct = index => {
        // XXX may want to do this using getters, to do this lazily
        return _.mapValues(spec.resources, resource => {
            return resource({ agent, apiSpec, path: [...path, index] });
        });
    };
    
    Object.assign(construct, methods);
    
    // Common interface to get a value from a response for this API resource type
    construct._valueFromResponse = collectionFromResponse(EntityType);
    construct._spec = spec;
    
    return construct;
};


// Create a new REST API
export const restApi = (agent, apiSpec) => {
    const spec = _.defaultsDeep({}, apiSpec, {
        store: [],
        resources: {},
    });
    
    const context = { agent, spec, path: [] };
    
    return _.mapValues(spec.resources, (resource, resourceKey) => {
        return resource(context);
    });
};
