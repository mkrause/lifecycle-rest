
import * as t from 'io-ts';


export const Identity = new t.Type('Identity', (_ : unknown) : _ is unknown => true, t.success, t.identity);
