// @flow
declare var describe : Function;
declare var it : Function;

import { expect } from 'chai';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import { status, Loadable } from '@mkrause/lifecycle-loader';
import { Entity, Collection } from '@mkrause/lifecycle-immutable';

import createAgent from '../../../src/agent.js';
import StorablePromise from '../../../src/loader/StorablePromise.js';
import { SimpleItem } from '../../../src/loader/Resource.js';
import CollectionResource from '../../../src/loader/CollectionResource.js';


describe('CollectionResource', () => {
    class User {
        static instantiate() {
            return {
                name: null,
            };
        }
        
        static decode(instanceEncoded) {
            return instanceEncoded;
        }
        
        static encode(instance) {
            return instance;
        }
    }
    
    class UsersCollection {
        static initialize() {
            return {};
        }
        
        static decode(instanceEncoded) {
            if (Array.isArray(instanceEncoded)) {
                return instanceEncoded.reduce(
                    (acc, item) => {
                        return { ...acc, [item.user_id]: item };
                    },
                    {}
                );
            } else if (typeof instanceEncoded === 'object' && instanceEncoded !== null) {
                return instanceEncoded;
            } else {
                throw new TypeError($msg`Unknown users collection type ${instanceEncoded}`);
            }
        }
        
        static encode(instance) {
            return instance;
        }
    }
    
    // Simulate an async response
    const makeResponse = response => new Promise(resolve => {
        setTimeout(() => { resolve(response); }, 0);
    });
    
    const agentMock = createAgent({
        adapter: async request => {
            const { method, baseUrl, url, params } = request;
            
            const users = [
                { user_id: 'user42', name: 'John' },
                { user_id: 'user43', name: 'Alice' },
            ];
            
            let matches;
            if (url === '/users' && method === 'get') {
                return await makeResponse({ data: users });
            } else if (url === '/users' && method === 'post') {
                const user = User.decode(JSON.parse(request.data));
                const userWithId = { ...user, user_id: 'user44' };
                return await makeResponse({ data: User.encode(userWithId) });
            } else if ((matches = url.match(/^[/]users[/]([^/]+)$/)) && method === 'get') {
                const user = users.filter(user => user.user_id === matches[1])[0];
                return await makeResponse({ data: user });
            } else {
                throw new Error($msg`Unknown route ${method} ${url}`);
            }
        },
    });
    
    const context = {
        agent: agentMock,
        config: {},
        path: [],
        store: [],
        uri: '',
    };
    
    it('should support method list()', async () => {
        const api = CollectionResource(UsersCollection, {
            uri: '/users',
        })(context);
        
        const users = await api.list();
        
        expect(users).to.deep.equal({
            user42: { user_id: 'user42', name: 'John' },
            user43: { user_id: 'user43', name: 'Alice' },
        });
    });
    
    it('should support indexing into', async () => {
        const api = CollectionResource(UsersCollection, {
            uri: '/users',
        })(context);
        
        const user = await api('user42').get();
        
        expect(user).to.deep.equal({ user_id: 'user42', name: 'John' });
    });
    
    it('should support method create()', async () => {
        const api = CollectionResource(UsersCollection, {
            uri: '/users',
        })(context);
        
        const user = await api.create({ name: 'Bob' });
        
        expect(user).to.deep.equal({ user_id: 'user44', name: 'Bob' });
    });
});
