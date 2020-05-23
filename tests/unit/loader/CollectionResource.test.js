
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiMatchPattern from 'chai-match-pattern';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import * as t from 'io-ts';

import { status, Loadable } from '@mkrause/lifecycle-loader';

import createAgent from '../../../lib-esm/agent.js';
// import StorablePromise from '../../../lib-esm/loader/StorablePromise.js';
// import { SimpleItem } from '../../../lib-esm/loader/Resource.js';
import { Unknown } from '../../../lib-esm/schema/Schema.js';
import agentMock from '../../resources/agent_mock.js';

import adapter from '../../../lib-esm/loader/Adapter.js';
import { resourceDef } from '../../../lib-esm/loader/Resource.js';
import ItemResource, { DecodeError } from '../../../lib-esm/loader/ItemResource.js';
import CollectionResource from '../../../lib-esm/loader/CollectionResource.js';


require('util').inspect.defaultOptions.depth = Infinity;

chai.use(chaiAsPromised);
chai.use(chaiMatchPattern);

describe('CollectionResource', () => {
    const contextWithAgent = {
        agent: agentMock,
        options: { adapter },
        path: [],
        store: [],
        uri: '',
    };
    
    describe('...', () => {
        const apiStandard = ItemResource(Unknown, {
            uri: '/api',
            resources: {
                users: CollectionResource(Unknown, {
                    entry: ItemResource(Unknown),
                }),
            },
        })(contextWithAgent);
        
        describe('method `create`', () => {
            it('should be supported as default method', async () => {
                const result = await apiStandard.users.create({ name: 'Zackary' });
                
                expect(result).to.deep.equal({ user_id: 'user42', name: 'Zackary' });
            });
        });
    });
});
