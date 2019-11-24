
import { expect } from 'chai';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import createAgent from '../../../lib-esm/agent.js';
import { Unknown } from '../../../lib-esm/schema/Schema.js';

import { resourceDef } from '../../../lib-esm/loader/Resource.js';
import ItemResource from '../../../lib-esm/loader/ItemResource.js';
import CollectionResource from '../../../lib-esm/loader/CollectionResource.js';

import RestApi from '../../../lib-esm/loader/RestApi.js';


describe('RestApi', () => {
    const agent = createAgent({
        adapter: async request => { throw new Error(`Not supported`); },
    });
    
    it('should require an agent', () => {
        expect(() => { RestApi(); }).to.throw(TypeError);
    });
    
    it('should require a resource creator', () => {
        expect(() => { RestApi(agent); }).to.throw(TypeError);
    });
    
    it('should require a resource creator', () => {
        expect(() => { RestApi(agent); }).to.throw(TypeError);
    });
    
    it('should return a resource by applying a root context', () => {
        const api = RestApi(agent, ItemResource(Unknown));
        
        expect(api).property(resourceDef).property('path').to.deep.equal([]);
        expect(api).property(resourceDef).property('store').to.deep.equal([]);
        expect(api).property(resourceDef).property('uri').to.deep.equal('');
    });
});
