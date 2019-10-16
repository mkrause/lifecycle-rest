
import { expect } from 'chai';
import sinon from 'sinon';

import $uri from 'uri-tag';
import http from 'http';
import { PassThrough } from 'stream';

import createAgent from '../../src/agent.js';


describe('agent', () => {
    it('should be usable without any options', async () => {
        const requestMock = sinon.stub(http, 'request')
            .callsFake((options, callback) => {
                // Create a mock http.IncomingMessage (to be passed to the callback)
                const response = new PassThrough();
                response.statusCode = 200;
                response.statusMessage = 'OK';
                response.headers = {
                    'Content-Type': 'application/json',
                };
                response.aborted = false;
                response.write(JSON.stringify({ hello: 'world' }));
                response.end();
                
                setTimeout(() => {
                    callback(response);
                }, 0);
                
                // Return a mock http.ClientRequest
                const request = new PassThrough();
                request.aborted = false;
                
                return request;
            });
        
        const agent = createAgent();
        
        // With default options, baseURL should be undefined
        expect(agent.defaults).to.not.have.property('baseURL');
        
        // Agent should use Node's `http` as its default adapter
        const response = await agent.get('http://example.com/foo');
        
        sinon.assert.calledOnce(requestMock);
        sinon.assert.calledWith(requestMock, sinon.match.has('hostname', 'example.com'));
        sinon.assert.calledWith(requestMock, sinon.match.has('method', 'GET'));
        sinon.assert.calledWith(requestMock, sinon.match.has('path', '/foo'));
        sinon.assert.calledWith(requestMock, sinon.match.has('headers',
            sinon.match.has('Content-Type', 'application/json')
        ));
        
        expect(response).to.have.property('data').to.deep.equal({ hello: 'world' });
    });
    
    it('should support setting custom headers', async () => {
        const requestMock = sinon.stub().callsFake(request => {
            const { method, baseURL, url, headers } = request;
            
            const response = headers['Authentication'] === 'Bearer xyz'
                ? {
                    status: 200,
                    data: 'Authenticated!',
                }
                : {
                    status: 401,
                    data: 'Access denied!',
                };
            
            // Simulate an async request
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(response);
                }, 0);
            });
        });
        
        const agentMock = createAgent({
            adapter: requestMock,
            headers: {
                'Authentication': 'Bearer xyz',
            },
        });
        
        const response = await agentMock.get('http://example.com');
        
        sinon.assert.calledOnce(requestMock);
        sinon.assert.calledWith(requestMock, sinon.match.has('headers', sinon.match({
            'Authentication': 'Bearer xyz',
        })));
        expect(response).to.have.property('data').to.equal('Authenticated!');
    });
});
