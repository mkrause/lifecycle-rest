
import { getStatusText } from 'http-status-codes';
import settle from 'axios/lib/core/settle.js';

import createAgent from '../../lib-esm/agent.js';


/*
Simple mock REST API endpoint
*/

export const users = {
    alice: { name: 'Alice' },
    bob: { name: 'Bob' },
    john: { name: 'John' },
};

const handleRequest = async request => {
    const { method, url, params } = request;
    
    if (url === '/api' && method === 'get') {
        const item = {
            version: 42,
        };
        
        // Simulate a bug in the response
        if (params.bug === 'true') {
            item.version = '42';
        }
        
        return { status: 200, data: item };
    } else if (url === '/api/greet' && method === 'get') {
        return { status: 200, data: `Hello ${params.name}` };
    } else if (url === '/api/profile') {
        const profile = users.alice;
        
        if (method === 'get') {
            return { status: 200, data: profile };
        } else {
            return { status: 400, data: $msg`Unsupported method ${method} on ${url}` };
        }
    } else if (url === '/api/users') {
        if (method === 'get') {
            return { status: 200, data: users };
        } else if (method === 'post') {
            const userRequest = JSON.parse(request.data);
            
            const user = {
                ...userRequest,
                user_id: 'user42', // Simulate create response with newly added ID
            };
            
            return { status: 200, data: user };
        } else {
            return { status: 400, data: $msg`Unsupported method ${method} on ${url}` };
        }
    } else if (url === '/api/users/alice') {
        const user = users.alice;
        
        if (method === 'post') {
            // Return 409 (Conflict) if the resource exists, 404 (Not Found) if it does not.
            // See: https://www.restapitutorial.com/lessons/httpmethods.html
            return { status: 409 };
        } else if (method === 'get') {
            return { status: 200, data: user };
        } else if (method === 'put') {
            const userRequest = JSON.parse(request.data);
            return { status: 200, data: userRequest };
        } else if (method === 'patch') {
            const userRequest = JSON.parse(request.data);
            const userUpdated = { ...user, ...userRequest };
            
            return { status: 200, data: userUpdated };
        } else if (method === 'delete') {
            return { status: 204 };
        } else {
            return { status: 400, data: $msg`Unsupported method ${method} on ${url}` };
        }
    } else if (url === '/api/users/_query' && method === 'get') {
        const user = {
            name: 'Alice',
            profile: 'Lorem ipsum...',
        };
        
        const response = {
            metadata: { profile_length: 1000 },
            item: user,
        };
        
        return { status: 200, data: response };
    } else {
        return { status: 400, data: $msg`Unknown route ${method} ${url}` };
    }
};

export default createAgent({
    adapter: request => {
        return new Promise(async (resolve, reject) => {
            const response = await handleRequest(request);
            
            // Run `settle` so that we respect axios configuration (`validateStatus` and such)
            settle(resolve, reject, {
                config: request,
                request,
                statusText: typeof response.status === 'number' ? getStatusText(response.status) : undefined,
                ...response,
            });
        });
    },
});
