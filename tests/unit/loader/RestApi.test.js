
import { expect } from 'chai';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import createAgent from '../../../lib-esm/agent.js';
import RestApi from '../../../lib-esm/loader/RestApi.js';
import ItemResource from '../../../lib-esm/loader/ItemResource.js';


describe('RestApi', () => {
    describe('item resource', () => {
        const agentMock = createAgent({
            adapter: request => {
                const { method, url, params } = request;
                
                if (url === '/') {
                    const users = [
                        { user_id: 'user42', name: 'John' },
                        { user_id: 'user43', name: 'Alice' },
                    ];
                    
                    let data = users;
                    
                    if (typeof params === 'object' && params && params.filters) {
                        if (params.filters.name) {
                            data = users.filter(user => user.name === params.filters.name);
                        }
                    }
                    
                    // Simulate an async request
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve({ data });
                        }, 0);
                    });
                } else {
                    throw new Error($msg`Unknown route ${url}`);
                }
            },
        });
        
        const api = RestApi(agentMock, ItemResource({}));
        
        it('should return a resource of the specified resource type', () => {
            //...
        });
    });
});
