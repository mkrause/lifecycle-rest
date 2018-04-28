
import _ from 'lodash';
import moment from 'moment';
import * as Imm from 'immutable';
import Collection from '../modeling/Collection.js';
import Entity from '../modeling/Entity.js';
import Schema from '../modeling/Schema.js';
import * as SchemaTypes from '../modeling/Schema.js';


// Parse a single property according to the given schema
const parseInstance = (schema, value) => {
    if (schema === undefined) {
        return undefined;
    } else if (schema === null) {
        return null;
    } else if (schema === String || schema === Schema.text) {
        return String(value);
    } else if (schema === Number || schema === Schema.number) {
        if (isNaN(value)) {
            throw new TypeError(`Not a valid number: ${JSON.stringify(value)}`);
        }
        
        return Number(value);
    } else if (schema === moment) {
        return moment(value);
    } else if (typeof schema === 'function' && schema.prototype instanceof Collection) {
        return collectionFromResponse(schema.entryType)(value);
    } else if (schema === Imm.Map) {
        return Imm.Map(value); // TODO: recurse
    } else if (schema === Imm.OrderedMap) {
        return Imm.OrderedMap(value); // TODO: recurse
    } else if (schema === Imm.List) {
        return Imm.List(value); // TODO: recurse
    } else if (typeof schema === 'object' && schema.$type === SchemaTypes.maybeExists) {
        try {
            return parseInstance(schema.schema, value);
        } catch (e) {
            return undefined;
        }
    } else if (_.isPlainObject(schema)) {
        if (!_.isPlainObject(value)) {
            throw new TypeError(`Expected an object, received '${JSON.stringify(value)}'`);
        }
        
        return _.mapValues(schema, (schemaProp, schemaPropName) => {
            if (!(schemaPropName in value)) {
                if (typeof schemaProp === 'object' && schemaProp.$type === SchemaTypes.maybeExists) {
                    return undefined;
                } else {
                    throw new TypeError(`Missing property '${schemaPropName}'`);
                }
            }
            
            return parseInstance(schemaProp, value[schemaPropName]);
        });
    } else {
        throw new TypeError(`Unknown schema type '${JSON.stringify(schema)}'`);
    }
};

// Utility: take a key (schema), and a value, and return an instance of the key
// Example:
// - key: `{ id : Schema.text }`
// - value: `42`
// - result: `{ id: "42" }`
export const makeIndex = (key, value) => {
    let index = null;
    
    if (key === String || key === Schema.text) {
        // Note: we expect an index to be a string. The API might return (e.g.) a numerical ID, but since
        // we treat all IDs as opaque (no numerical calculations), it's easier to ensure it is a string
        // right away. This also spares us from having to parse router params (which are always strings).
        index = String(value);
    } else if (_.isPlainObject(key)) {
        index = _.mapValues(key, (keyProp, keyPropName) => {
            if (!value.hasOwnProperty(keyPropName)) {
                throw new TypeError(`Missing property '${keyPropName}'`);
            }
            return makeIndex(keyProp, value[keyPropName]);
        });
        
        // Special case: ID with one property
        if (Object.keys(key).length === 1) {
            index = index[Object.keys(key)[0]];
        }
    } else {
        throw new TypeError('Unsupported ID format');
    }
    
    return index;
};

export const makeEntity = (entityType, entityValue) => {
    const entitySchema = entityType.schema;
    
    let entityValueParsed = undefined;
    if (typeof entityValue === 'object' && entityValue) {
        entityValueParsed = parseInstance(entitySchema, entityValue);
    }
    
    return new entityType(entityValueParsed, { status: 'ready' });
};

// Utility: take an entity type, and a plain value, and instantiate the entity type with that value.
export const makeEntry = (entityType, entityValue) => {
    let key = null;
    if ((entityType.prototype instanceof Entity) && entityType.hasOwnProperty('key')) {
        key = entityType.key;
    } else {
        key = { id: Schema.text };
    }
    
    const index = makeIndex(key, entityValue);
    const entity = makeEntity(entityType, entityValue);
    
    return [index, entity];
};

export const collectionFromResponse = EntityType => response => {
    let collection = null;
    if (response instanceof Collection) {
        collection = response;
    } else if (_.isArray(response)) {
        const entries = response.map(item => {
            return makeEntry(EntityType, item);
        });
        collection = new EntityType.Collection(entries, { status: 'ready' });
    } else {
        throw new TypeError("Unrecognized collection response format");
    }
    return collection;
};
