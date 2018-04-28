
// Function to create a new API agent. An API agent is a basic HTTP interface to communicate
// with an API endpoint.
// Example:
//     Api.createAgent({
//         uri: "http://example.com/api",
//     });
export { default as createAgent } from './Agent.js';

export { restApi, collection } from './RestApi.js';

export { update } from './redux.js';

export { withStatus, loader } from './component_util.js';
