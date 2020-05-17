// @flow

import $msg from 'message-tag';

import env from '../util/env.js';
import merge from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import $uri from 'uri-tag';
import { concatUri } from '../util/uri.js';

import { status, Loadable } from '@mkrause/lifecycle-loader';
import type { LoadableT } from '@mkrause/lifecycle-loader';

import StorablePromise from './StorablePromise.js';


const itemDefaults = {
    store: [],
    uri: '',
    resources: {},
    methods: {
        
    },
};

const parse = response => {
    if (response.status === 204) {
        return null;
    }
    
    return response.data;
};

const format = item => item;

const ItemResource = (Schema, itemSpec = {}) => {
    const makeResource = context => {
        const { agent, config } = context;
        
        const isRoot = context.path.length === 0;
        const label = isRoot ? null : context.path[context.path.length - 1];
        
        // Parse the item specification
        const itemDefaultsWithContext = merge(itemDefaults, {
            store: isRoot ? [] : [label],
            uri: isRoot ? '' : label,
        });
        const spec = merge(itemDefaultsWithContext, itemSpec);
        
        // Make relative
        // TODO: allow the spec to override this and use absolute references instead
        spec.store = [...context.store, ...spec.store];
        spec.uri = concatUri([context.uri, spec.uri]);
        
        const customMethods = Object.entries(spec.methods)
            .filter(([methodName, method]) => methodName[0] !== '_')
            .map(([methodName, method]) => {
                const methodDecorated = (...args) => {
                    const methodResult = method({ spec, agent }, ...args);
                    
                    if (methodResult instanceof StorablePromise) {
                        return methodResult;
                    } else if (methodResult instanceof Promise) {
                        return StorablePromise.from(
                            Loadable(),
                            { location: spec.store, operation: 'put' },
                            methodResult
                                .then(response => {
                                    const responseParsed = parse(response);
                                    return Schema.decode(responseParsed);
                                }),
                        );
                    } else {
                        throw new TypeError($msg`Unknown result ${methodResult}`);
                    }
                };
                
                return [methodName, methodDecorated];
            })
            .reduce((acc, [methodName, method]) => ({ ...acc, [methodName]: method }), {});
        
        const methods = {
            get(params = {}) {
                return StorablePromise.from(
                    Loadable(),
                    { location: spec.store, operation: 'put' },
                    agent.get(spec.uri, { params })
                        .then(response => {
                            return Schema.decode(parse(response));
                        }),
                );
            },
            
            put(item, params = {}) {
                return StorablePromise.from(
                    Loadable(),
                    { location: spec.store, operation: 'put' },
                    agent.put(spec.uri, format(Schema.encode(item)), { params })
                        .then(response => {
                            return Schema.decode(parse(response));
                        }),
                );
            },
            ...customMethods,
        };
        
        // Subresources
        const resources = ObjectUtil.mapValues(spec.resources, (resource, resourceKey) => {
            const resourceContext = {
                agent: context.agent,
                config: context.config,
                path: [...context.path, resourceKey],
                store: spec.store,
                uri: spec.uri,
            };
            return resource(resourceContext);
        });
        
        const resource = {
            ...methods,
            ...resources,
            _spec: spec, // Expose the spec
        };
        
        return resource;
    };
    
    return Object.assign(makeResource, {
        // Expose the schema
        schema: Schema,
    });
};

export default ItemResource;
