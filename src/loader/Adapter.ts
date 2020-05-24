
import { Schema, DecodeError } from '../schema/Schema.js';

import type { Resource } from './Resource.js';
import { ResourceDefinition } from './Resource.js';

import { AxiosResponse } from 'axios';

import * as t from 'io-ts';
import { Errors as ValidationErrors, ValidationError } from 'io-ts';
import { PathReporter } from 'io-ts/lib/PathReporter.js';


const makeAdapter = <S extends Schema>(resource : ResourceDefinition<S>, schema : S) => ({
    with(schema : Schema) {
        return makeAdapter(resource, schema);
    },
    
    parse(response : AxiosResponse) {
        if (response.status === 204) { return null; }
        return response.data;
    },
    
    decode(input : unknown) {
        const { agent, schema, adapter } = resource;
        
        return adapter.report(schema.decode(input));
    },
    
    encode(instance : unknown) {
        const { agent, schema, adapter } = resource;
        
        return schema.encode(instance);
    },
    
    report(decodeResult : t.Validation<unknown>) {
        if (decodeResult._tag === 'Right') {
            return decodeResult.right;
        } else {
            const errors = decodeResult.left;
            const report = PathReporter.report(decodeResult);
            
            const message = `Failed to decode response:\n` + report.map(error =>
                `\n- ${error}`
            ).join('');
            
            throw new DecodeError(message, errors);
        }
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

// Get the return type of `Adapter`
// FIXME: currently this leads to a circular reference
//export type AdapterT = typeof Adapter extends <S extends Schema>(...args : never[]) => infer R ? R : never;
export type AdapterT = any;

export default makeAdapter;
