
import env from '../util/env.js';
import merge from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';

import CollectionResource from './CollectionResource.js';


const apiSpecDefaults = {
    uri: '', // Root path (without trailing slash, so just an empty string)
    store: [],
    resources: {},
};

const RestApi = (agent, apiSpec) => {
    const spec = merge(apiSpecDefaults, apiSpec);
    
    // Current context while traversing through the spec hierarchy
    const context = {
        agent,
        rootSpec: spec,
        parentSpec: spec,
        path: [], // The current path in the API spec tree
    };
    
    // Return an object of all resources specified in the apiSpec
    return ObjectUtil.mapValues(spec.resources, (resource, resourceKey) => {
        const resourceContext = { ...context, path: [...context.path, resourceKey] };
        return resource(resourceContext);
    });
};

RestApi.Collection = CollectionResource;

export default RestApi;
