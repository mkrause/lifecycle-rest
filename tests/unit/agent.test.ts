
import 'mocha';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';

import { URL } from 'node:url';
import http from 'http';
import type { RequestOptions, IncomingMessage, ClientRequest } from 'http';
import { PassThrough } from 'stream';

import type { AxiosPromise, AxiosRequestConfig, AxiosResponse } from 'axios';
import createAgent from '../../src/agent';


// Create an `http.IncomingMessage` instance, with the given HTTP body (as JSON)
const createIncomingMessageWithJson = (body: unknown): IncomingMessage => {
    // Uses `PassThrough` (a readable + writable stream) to create a readable stream (i.e. the `IncomingMessage`),
    // where the content read from the stream is what we write to the `PassThrough`.
    const response: PassThrough & IncomingMessage = Object.assign(
        new PassThrough(),
        {
            aborted: false,
            statusCode: 200,
            statusMessage: 'OK',
            headers: {
                'Content-Type': 'application/json',
            },
        },
    ) as any; // Unsafe cast, because we're only implementing `IncomingMessage` partially here
    response.write(JSON.stringify(body));
    response.end();
    
    return response;
};

const createClientRequest = (options: RequestOptions | string | URL): ClientRequest => {
    const request: PassThrough & ClientRequest = Object.assign(
        new PassThrough(),
        {
            aborted: false,
        },
    ) as any; // Unsafe cast, because we're only implementing `ClientRequest` partially here
    
    return request;
};

describe('agent', () => {
    let httpRequestMock: SinonStub<Parameters<typeof http.request>, ReturnType<typeof http.request>>;
    before(() => {
        // Mock function for `http.request()` (which axios uses by default). Note: this mutates `http`.
        // https://stackoverflow.com/questions/42399877/how-to-stub-https-request-response-pipe-with-sinon-js
        httpRequestMock = sinon.stub(http, 'request')
            .callsFake(
                // Note: unsafe cast `as any` needed, because type inference fails due to `http.request()` being an
                // overloaded function. See: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
                ((options: RequestOptions | string | URL, callback?: (res: IncomingMessage) => void): ClientRequest => {
                    // After a time out, simulate an HTTP response being received, and pass it to the callback
                    setTimeout(() => {
                        // Create a mock `http.IncomingMessage`
                        const response: IncomingMessage = createIncomingMessageWithJson({ hello: 'world' });
                        callback?.(response);
                    }, 0);
                    
                    // Return a mock `http.ClientRequest`
                    const request: ClientRequest = createClientRequest(options);
                    return request;
                }) as any,
            );
    });
    afterEach(() => {
        httpRequestMock.restore(); // Restore original `http.request` function
    });
    
    it('should be usable without any options', async () => {
        const agent = createAgent();
        
        // With default options, `baseURL` should be undefined
        expect(agent.defaults).to.not.have.property('baseURL');
        
        // Agent should use Node's `http` as its default adapter (for URLs that use the `http:` protocol)
        const response = await agent.get('http://example.com/foo');
        
        sinon.assert.calledOnce(httpRequestMock);
        sinon.assert.calledWith(httpRequestMock, sinon.match.has('hostname', 'example.com'));
        sinon.assert.calledWith(httpRequestMock, sinon.match.has('method', 'GET'));
        sinon.assert.calledWith(httpRequestMock, sinon.match.has('path', '/foo'));
        sinon.assert.calledWith(httpRequestMock, sinon.match.has('headers',
            sinon.match.has('Content-Type', 'application/json')
        ));
        
        expect(response).to.have.property('data').to.deep.equal({ hello: 'world' });
    });
    
    it('should support setting custom headers', async () => {
        const requestMock = sinon.stub().callsFake(
            (request: AxiosRequestConfig): AxiosPromise<string> => {
                const { method, baseURL, url, headers } = request;
                
                const response: AxiosResponse<string> = headers['Authentication'] === 'Bearer xyz'
                    ? {
                        status: 200,
                        statusText: 'OK',
                        headers: {},
                        config: {},
                        data: 'Authenticated!',
                    }
                    : {
                        status: 401,
                        statusText: 'OK',
                        headers: {},
                        config: {},
                        data: 'Access denied!',
                    };
                
                // Simulate an async request
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve(response);
                    }, 0);
                });
            },
        );
        
        const agentMock = createAgent({
            adapter: requestMock,
            headers: {
                'Authentication': 'Bearer xyz',
            },
        });
        
        // Note: URL must use the `http:` protocol, so that we trigger `http.request()`, not `https.request()`
        const response = await agentMock.get('http://example.com');
        
        sinon.assert.calledOnce(requestMock);
        sinon.assert.calledWith(requestMock, sinon.match.has('headers', sinon.match({
            'Authentication': 'Bearer xyz',
        })));
        expect(response).to.have.property('data').to.equal('Authenticated!');
    });
});
