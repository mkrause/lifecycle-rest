
import { Schema, DecodeError } from '../schema/Schema.js';

import type { Resource } from './Resource.js';
import { ResourceDefinition } from './Resource.js';

import { AxiosResponse } from 'axios';

import * as t from 'io-ts';
import { Errors as ValidationErrors, ValidationError } from 'io-ts';
import { PathReporter } from 'io-ts/lib/PathReporter.js';


const ResourceUtil = <S extends Schema>(resource : ResourceDefinition<S>, schema : S) => ({
    with(schema : Schema) {
        return ResourceUtil(resource, schema);
    },
    
    parse(response : AxiosResponse) {
        if (response.status === 204) { return null; }
        return response.data;
    },
    
    report(decodeResult : t.Validation<unknown>) {
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
    
    
    format(item : unknown) { return item },
    
    partial(schema : t.Type<unknown, unknown, unknown>) {
        if ('props' in schema) {
            return t.partial((schema as any).props);
        } else {
            return schema;
        }
    },
});

// Get the return type of `ResourceUtil`
// FIXME: currently this leads to a circular reference
//export type ResourceUtilT = typeof ResourceUtil extends <S extends Schema>(...args : never[]) => infer R ? R : never;
export type ResourceUtilT = any;

export default ResourceUtil;
