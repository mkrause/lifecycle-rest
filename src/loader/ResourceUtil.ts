
import { Schema, DecodeError } from '../schema/Schema.js';

import type { Resource } from './Resource.js';
import { ResourceDefinition } from './Resource.js';

import { AxiosResponse } from 'axios';

// TEMP
import { PathReporter } from 'io-ts/lib/PathReporter.js';
import * as t from 'io-ts';
import { Errors as ValidationErrors, ValidationError } from 'io-ts';


/*
// Item
const schemaMethods = {
    parse(response : AxiosResponse) {
        if (response.status === 204) { return null; }
        return response.data;
    },
    
    format(item : any) { return item },
    
    report(decodeResult : t.Validation<any>) {
        if (decodeResult._tag === 'Right') {
            return decodeResult.right;
        } else {
            const errors = decodeResult.left;
            const report = PathReporter.report(decodeResult);
            
            let message = `Failed to decode response:\n` + report.map(error =>
                `\n- ${error}`
            );
            
            throw new DecodeError(message, errors);
        }
    },
    
    partial(schema : t.Type<any, any, any>) {
        if ('props' in schema) {
            return t.partial((schema as any).props);
        } else {
            return schema;
        }
    },
    
    decode<Schema extends ItemSchema>(resource : ItemResourceT<Schema>, input : unknown) {
        const { agent, schema, schemaMethods } = resource[resourceDef];
        
        return schemaMethods.report(schema.decode(input));
    },
    
    encode<Schema extends ItemSchema>(resource : ItemResourceT<Schema>, instance : unknown) {
        const { agent, schema, schemaMethods } = resource[resourceDef];
        
        return schema.encode(instance);
    },
};

// Collection
const schemaMethods = {
    parse(response : AxiosResponse) {
        if (response.status === 204) { return null; }
        return response.data;
    },
    
    format(item : any) { return item },
    
    report(decodeResult : t.Validation<any>) {
        if (decodeResult._tag === 'Right') {
            return decodeResult.right;
        } else {
            const errors = decodeResult.left;
            const report = PathReporter.report(decodeResult);
            
            const message = `Failed to decode response:\n` + report.map(error =>
                `\n- ${error}`
            );
            
            throw new DecodeError(message, errors);
        }
    },
    
    partial(schema : t.Type<any, any, any>) {
        if ('props' in schema) {
            return t.partial((schema as any).props);
        } else {
            return schema;
        }
    },
    
    decode<Schema extends CollSchema>(resource : CollResourceT<Schema>, input : unknown) {
        const { schema, schemaMethods } = resource[resourceDef];
        
        return schemaMethods.report(schema.decode(input));
    },
    
    encode<Schema extends CollSchema>(resource : CollResourceT<Schema>, instance : unknown) {
        const { schema, schemaMethods } = resource[resourceDef];
        
        return schema.encode(instance);
    },
};
*/

const ResourceUtil = <S extends Schema>(resource : ResourceDefinition<S>, schema : S) => ({
    with(schema : Schema) {
        return ResourceUtil(resource, schema);
    },
    
    parse(response : AxiosResponse) {
        if (response.status === 204) { return null; }
        return response.data;
    },
    
    report(decodeResult : t.Validation<any>) {
        if (decodeResult._tag === 'Right') {
            return decodeResult.right;
        } else {
            const errors = decodeResult.left;
            const report = PathReporter.report(decodeResult);
            
            let message = `Failed to decode response:\n` + report.map(error =>
                `\n- ${error}`
            );
            
            throw new DecodeError(message, errors);
        }
    },
    
    decode(input : unknown) {
        const { agent, schema, util } = resource;
        
        return util.report(schema.decode(input));
    },
    
    encode(instance : unknown) {
        const { agent, schema, util } = resource;
        
        return schema.encode(instance);
    },
    
    // TODO
    
    format(item : any) { return item },
    partial(schema : t.Type<any, any, any>) {
        if ('props' in schema) {
            return t.partial((schema as any).props);
        } else {
            return schema;
        }
    },
});

export type ResourceUtilT = any; // TEMP (need to get the return type of `ResourceUtil` given some `S`)

export default ResourceUtil;
