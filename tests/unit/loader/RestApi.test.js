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
import RestApi from '../../../src/loader/RestApi.js';


describe('RestApi', () => {
    /*
    class User extends Entity {
        static Collection = class UserCollection extends Collection {
            constructor(entries, meta) {
                super(entries, meta, User);
            }
        };
        
        static key = {
            user_id: String,
        };
        
        static schema = {
            user_id: String,
            name: String,
        };
        
        constructor(instance, meta) {
            super(instance, meta, User.schema);
        }
    }
    */
    
    describe('item resource', () => {
        // TODO
    });
    
    describe('collection resource', () => {
        const agentMock = createAgent({
            adapter: request => {
                const { method, baseUrl, url, params } = request;
                
                if (url === '/users') {
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
        
        class UsersCollection {
            static empty() {
                return {};
            }
            
            static decode(instanceEncoded) {
                return instanceEncoded.reduce(
                    (acc, item) => {
                        return { ...acc, [item.user_id]: item };
                    },
                    {}
                );
            }
        }
        
        const api = RestApi(agentMock, {
            store: ['app'],
            resources: {
                users: RestApi.Collection(UsersCollection, {
                    methods: {
                        query: async (spec, decode, query) => {
                            const items = decode(await agentMock.get(spec.uri, { params: query }));
                            
                            const queryResult = {
                                items,
                            };
                            
                            return queryResult;
                        },
                    },
                }),
            },
        });
        
        it('should support dispose()', async () => {
            const disposePromise = api.users.dispose();
            
            expect(disposePromise).to.be.an.instanceOf(StorablePromise);
            expect(disposePromise.spec.location).to.deep.equal(['app', 'users']);
            expect(disposePromise.spec.operation).to.equal('put'); // Complete (non-partial) store update
            
            const users = await disposePromise;
            
            expect(users).to.deep.equal({});
        });
        
        it('should support list()', async () => {
            const listPromise = api.users.list();
            
            expect(listPromise).to.be.an.instanceOf(StorablePromise);
            expect(listPromise.spec.location).to.deep.equal(['app', 'users']);
            expect(listPromise.spec.operation).to.equal('put'); // Complete (non-partial) store update
            
            const users = await listPromise;
            
            expect(users).to.deep.equal({
                user42: { user_id: 'user42', name: 'John' },
                user43: { user_id: 'user43', name: 'Alice' },
            });
        });
        
        it('should support query()', async () => {
            const query = {
                filters: {
                    name: 'Alice',
                },
            };
            const queryPromise = api.users.query(query);
            
            expect(queryPromise).to.be.an.instanceOf(StorablePromise);
            expect(queryPromise.spec.location).to.deep.equal(['app', 'users']);
            expect(queryPromise.spec.operation).to.equal('merge'); // Partial store update
            
            const usersResult = await queryPromise;
            
            expect(usersResult).to.deep.equal({
                items: {
                    user43: { user_id: 'user43', name: 'Alice' },
                },
            });
        });
    });
    
    /*
    describe('collection resource', () => {
        it('should support list()', async () => {
            const agentMock = createAgent({
                adapter: request => {
                    const { method, baseUrl, url } = request;
                    
                    // Simulate an async request
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve({
                                data: [
                                    {
                                        user_id: '1',
                                        name: 'John',
                                    },
                                ],
                            });
                        }, 0);
                    });
                },
            });
            
            const api = RestApi(agentMock, {
                store: ['app'],
                resources: {
                    users: RestApi.Collection(User, {
                        methods: {},
                    }),
                },
            });
            
            const item = Loadable(null);
            
            const subscriber = sinon.stub()
                .callsFake(item => {
                    //console.log('subscribe', item[status]);
                    
                    if (item[status].ready) {
                        //console.log(item.toJS());
                    }
                });
            
            // console.log('xx', api.users.list(item));
            const result = await api.users.list(item)
                .subscribe(subscriber);
            
            //console.log('result', result);
            
            sinon.assert.calledTwice(subscriber);
            
            sinon.assert.calledWith(subscriber.firstCall, sinon.match({}));
            sinon.assert.calledWith(subscriber.firstCall, sinon.match(users => {
                return [
                    users[status].ready === false,
                    users[status].loading === true,
                    users[status].error === null,
                ].every(cond => cond === true);
            }));
            
            sinon.assert.calledWith(subscriber.secondCall, sinon.match.instanceOf(User.Collection));
            sinon.assert.calledWith(subscriber.secondCall, sinon.match(users => {
                return [
                    users[status].ready === true,
                    users[status].loading === false,
                    users[status].error === null,
                ].every(cond => cond === true);
            }));
            sinon.assert.calledWith(subscriber.secondCall, sinon.match(users => {
                return [
                    users.size === 1,
                    users.has('1'),
                    users.get('1').get('name') === 'John',
                ].every(cond => cond === true);
            }));
            
            expect(result).to.be.an.instanceof(User.Collection);
            expect(result[status]).to.have.property('ready', true);
            expect(result[status]).to.have.property('loading', false);
            expect(result[status]).to.have.property('error', null);
            
            expect(result.size).to.equal(1);
            expect(result.has('1')).to.be.true;
            expect(result.get('1').get('name')).to.equal('John');
        });
    });
    */
});
