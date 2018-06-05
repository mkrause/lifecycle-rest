// @flow
declare var describe : Function;
declare var it : Function;

import { expect } from 'chai';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import { status, Loadable } from '@mkrause/lifecycle-loader';

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
    
    const agentMock = createAgent({
        adapter: async request => {
            const { method, url, params, headers } = request;
            
            const users = [
                { user_id: 'user42', name: 'John' },
                { user_id: 'user43', name: 'Alice' },
            ];
            
            let matches;
            if (url === '/users' && method === 'get') {
                if (headers['Accept'] && headers['Accept'] === 'application/vnd.query+json') {
                    const usersQueried = users.filter(user => user.name === params.name);
                    
                    const response = {
                        items: usersQueried,
                        metadata: {
                            total: 999,
                        },
                    };
                    return Promise.resolve({ data: response });
                }
                
                return Promise.resolve({ data: users });
            } else if (url === '/users' && method === 'post') {
                const user = User.decode(JSON.parse(request.data));
                const userWithId = { ...user, user_id: 'user44' };
                return Promise.resolve({ data: User.encode(userWithId) });
            } else if ((matches = url.match(/^[/]users[/]([^/]+)$/)) && method === 'get') {
                const user = users.filter(user => user.user_id === matches[1])[0];
                return Promise.resolve({ data: user });
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
    
    it('should support custom methods', async () => {
        const api = CollectionResource(UsersCollection, {
            uri: '/users',
            methods: {
                query({ spec, agent }, query) {
                    return StorablePromise.from(
                        Loadable(null),
                        {
                            location: spec.store,
                            operation: 'merge',
                            accessor: queryResult => queryResult.users,
                        },
                        agent.get('/users', { headers: { 'Accept': 'application/vnd.query+json' }, params: query })
                            .then(response => {
                                const parse = response => response.data;
                                const decode = UsersCollection.decode;
                                
                                const responseParsed = parse(response);
                                
                                return {
                                    users: decode(responseParsed.items),
                                    metadata: {
                                        total: responseParsed.metadata.total,
                                    },
                                };
                            }),
                    );
                },
            },
        })(context);
        
        const resultPromise = api.query({ name: 'Alice' });
        
        expect(resultPromise).to.be.an.instanceOf(StorablePromise);
        expect(resultPromise.spec.operation).to.equal('merge');
        expect(resultPromise.spec.accessor).satisfy(accessor => {
            return accessor({ users: 'foo' }) === 'foo';
        });
        
        const result = await resultPromise;
        
        expect(result).to.deep.equal({
            users: { user43: { user_id: 'user43', name: 'Alice' } },
            metadata: {
                total: 999,
            },
        });
    });
});
