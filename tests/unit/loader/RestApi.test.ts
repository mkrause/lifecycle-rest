
import { expect } from 'chai';

import createAgent from '../../../src/agent';
import { Unknown } from '../../../src/schema/Schema';

import { resourceDef } from '../../../src/loader/Resource';
import ItemResource from '../../../src/loader/ItemResource';
import CollectionResource from '../../../src/loader/CollectionResource';

import RestApi from '../../../src/loader/RestApi';


describe('RestApi', () => {
    const agent = createAgent({
        adapter: async () => { throw new Error(`Not supported`); },
    });
    
    it('should require configuration as argument', () => {
        // @ts-expect-error
        expect(() => { RestApi(); }).to.throw(TypeError);
    });
    
    it('should require a resource creator as argument', () => {
        // @ts-expect-error
        expect(() => { RestApi({ agent }); }).to.throw(TypeError);
    });
    
    it('should return a resource by applying a root context', () => {
        const api = RestApi({ agent }, ItemResource(Unknown));
        
        expect(api).property(resourceDef).property('path').to.deep.equal([]);
        expect(api).property(resourceDef).property('store').to.deep.equal([]);
        expect(api).property(resourceDef).property('uri').to.deep.equal('');
    });
});
