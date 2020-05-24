
export { resourceDef } from './loader/Resource.js';

export { default as createAgent } from './agent.js';

export { default as RestApi } from './loader/RestApi.js';

import reduxMiddleware from './redux/middleware.js';
import reduxReduce from './redux/reducer.js';
export const redux = { middleware: reduxMiddleware, reducer: reduxReduce };

export { default as default } from './loader/RestApi.js';


// Re-export from lifecycle-loader, for convenience
export { status } from '@mkrause/lifecycle-loader';
