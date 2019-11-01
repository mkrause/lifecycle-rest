
import * as t from 'io-ts';
import { Errors as ValidationErrors, ValidationError } from 'io-ts';


export interface Schema<A = any> extends t.Type<A, any, any> {};


export const Unknown = new t.Type('Unknown', (_ : unknown) : _ is unknown => true, t.success, t.identity);

export class DecodeError extends Error {
    readonly errors : ValidationErrors;
    
    constructor(reason : string, errors : ValidationErrors) {
        super(reason);
        this.errors = errors;
    }
}
