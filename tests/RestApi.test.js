
import { expect } from 'chai';

import uri from 'uri-tag';
import createAgent from '../src/agent.js';
import RestApi from '../src/loader/RestApi.js';


describe('RestApi', () => {
    it('should ...', async () => {
        const agentMock = createAgent({
            adapter: request => {
                const { method, baseUrl, url } = request;
                
                return Promise.resolve({
                    data: {},
                });
            },
        });
        
        const User = {};
        
        const api = RestApi(agentMock, {
            store: ['app'],
            resources: {
                users: RestApi.Collection(User, {
                    methods: {},
                }),
            },
        });
        
        console.log('xx', api.users(42));
        
        await agentMock.get('http://example.com')
            .then(response => {
                //console.log(response);
            })
            .catch(reason => {
                //console.error(reason);
            });
        
        expect(42).to.equal(42);
    });
});
