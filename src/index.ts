
export { DecodeError } from './schema/Schema';
export { resourceDef } from './loader/Resource';

export { default as createAgent } from './agent';

export { default as RestApi } from './loader/RestApi';

import reduxMiddleware from './redux/middleware';
import reduxReduce from './redux/reducer';
export const redux = { middleware: reduxMiddleware, reducer: reduxReduce };

export { default as default } from './loader/RestApi';


// Re-export from lifecycle-loader, for convenience
export { status } from '@mkrause/lifecycle-loader';
