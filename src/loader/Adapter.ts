
import $msg from 'message-tag';

import { Schema, DecodeError } from '../schema/Schema.js';

import type { Resource } from './Resource.js';
import { ResourceDefinition } from './Resource.js';

import { AxiosResponse } from 'axios';

import * as t from 'io-ts';
//import { isLeft } from 'fp-ts/lib/Either';
//import { Errors as ValidationErrors, ValidationError } from 'io-ts';
import { PathReporter } from 'io-ts/lib/PathReporter.js';


const makeAdapter = <S extends Schema<unknown>>(resource : ResourceDefinition<S>, schema : S = resource.schema) => ({
    with(schema : Schema) {
        return makeAdapter(resource, schema);
    },
    
    parse(response : AxiosResponse) {
        if (response.status === 204) { return null; }
        return response.data;
    },
    
    decode(input : unknown) {
        const { agent, adapter } = resource;
        
        return adapter.report(schema.decode(input));
    },
    
    encode(instance : unknown) {
        const { agent, adapter } = resource;
        
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
    
    partial() {
        if ('props' in schema) {
            return t.partial((schema as any).props);
        } else {
            return schema;
        }
    },
    
    getKey(instance : t.TypeOf<Schema>) {
        if (typeof instance === 'object' && instance !== null && 'id' in instance) {
            return (instance as { id : unknown }).id;
        }
        
        throw new TypeError($msg`Unable to get key for ${instance}`);
    },
    
    /* TODO
    keyOf() {
        // If the schema is `any`, try to find a default `id` property?
        if (schema.name === 'Unknown') { // TEMP
            const IdType = t.type({ id: t.any });
            return new Type(
                'keyof ' + IdType.name,
                IdType.is,
                (input : t.InputOf<typeof IdType>, context : t.Context) => {
                  const e = IdType.validate(input, context);
                  if (isLeft(e)) {
                    return e;
                  }
                  
                  return e.right.id;
                },
                (instance : unknown) => instance,
            );
        }
        
        return schema
    },
    */
});

// Get the return type of `Adapter`
// FIXME: currently this leads to a circular reference
//export type AdapterT = typeof Adapter extends <S extends Schema>(...args : never[]) => infer R ? R : never;
export type AdapterT = any;

export default makeAdapter;
