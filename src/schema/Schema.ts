
import * as t from 'io-ts';


export const Identity = new t.Type('Identity', _ => true, t.success, t.identity);
