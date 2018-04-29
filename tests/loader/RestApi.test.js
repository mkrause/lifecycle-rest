
import { expect } from 'chai';
import sinon from 'sinon';

import uri from 'uri-tag';
import createAgent from '../../src/agent.js';
import RestApi from '../../src/loader/RestApi.js';

import { status, Loadable, LoadablePromise } from '@mkrause/lifecycle-loader';
import { Entity, Collection } from '@mkrause/lifecycle-immutable';


describe('RestApi', () => {
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
            
            const item = Loadable(new User.Collection());
            
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
            
            sinon.assert.calledWith(subscriber.firstCall, sinon.match.instanceOf(User.Collection));
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
});
