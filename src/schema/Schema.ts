
import * as t from 'io-ts';


export const identity = new t.Type('identity', _ => true, t.success, t.identity);
