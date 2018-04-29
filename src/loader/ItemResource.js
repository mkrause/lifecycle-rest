
import env from '../util/env.js';
import merge from '../util/merge.js';
import * as ObjectUtil from '../util/ObjectUtil.js';
import $uri from 'uri-tag';


const itemDefaults = {
    store: [],
    uri: '',
    resources: {},
};

const ItemResource = itemSpec => ({ agent, rootSpec, parentSpec, path }) => {
    // Last path item (i.e. the key of the current resource)
    const label = parentSpec === null ? null : path[path.length - 1];
    
    const itemDefaultsWithContext = merge(itemDefaults, {
        store: parentSpec === null ? [] : [...parentSpec.store, label],
        uri: parentSpec === null ? '' : `${parentSpec.uri}/${label}`,
    });
    const spec = merge(itemDefaultsWithContext, itemSpec);
    
    return ObjectUtil.mapValues(spec.resources, (resource, resourceKey) => {
        const resourceContext = {
            agent,
            rootSpec,
            parentSpec: spec,
            path: [...path, resourceKey],
        };
        return resource(resourceContext);
    });
};

export default ItemResource;
