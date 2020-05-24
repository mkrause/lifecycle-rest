
import chai, { expect } from 'chai';
import sinon from 'sinon';

import $uri from 'uri-tag';
import $msg from 'message-tag';

import { status, Loadable } from '@mkrause/lifecycle-loader';

import createAgent from '../../../lib-esm/agent.js';
import { Unknown } from '../../../lib-esm/schema/Schema.js';

import adapter from '../../../lib-esm/loader/Adapter.js';
import { resourceDef } from '../../../lib-esm/loader/Resource.js';


// Tests for the common `Resource` subset that all resource implementations share
export default makeResource => {
    const contextTrivial = {
        agent: createAgent({
            adapter: async request => { throw new Error(`Not supported`); },
        }),
        options: { adapter },
        path: [],
        uri: '',
        store: [],
    };
    
    it('should have sensible defaults', () => {
        const resourceCreator = makeResource(Unknown);
        const resource = resourceCreator(contextTrivial);
        
        // The resource creator should expose its schema
        expect(resourceCreator).property('schema').to.equal(Unknown);
        
        // The resource should have a private symbol `resourceDef` exposing its internal definition
        expect(resource).property(resourceDef).property('path').to.deep.equal([]);
        expect(resource).property(resourceDef).property('store').to.deep.equal([]);
        expect(resource).property(resourceDef).property('uri').to.deep.equal('');
    });
    
    it('should allow configuration of the `path`', () => {
        const resource1 = makeResource(Unknown, { path: [] })(contextTrivial);
        const resource2 = makeResource(Unknown, { path: ['x'] })(contextTrivial);
        
        // With non-empty context `path`
        const resource3 = makeResource(Unknown, { path: ['y', 'z'] })({ ...contextTrivial, path: ['x'] });
        
        expect(resource1).property(resourceDef).property('path').to.deep.equal([]);
        expect(resource2).property(resourceDef).property('path').to.deep.equal(['x']);
        expect(resource3).property(resourceDef).property('path').to.deep.equal(['x', 'y', 'z']);
    });
    
    it('should allow configuration of the `uri`', () => {
        const resource1 = makeResource(Unknown, { uri: '' })(contextTrivial);
        const resource2 = makeResource(Unknown, { uri: 'x' })(contextTrivial);
        
        // With non-empty context `uri`
        const resource3 = makeResource(Unknown, { uri: 'y/z' })({ ...contextTrivial, uri: '/x' });
        
        // Should properly handle relative paths, slashes, etc. when concatenating
        const resource4 = makeResource(Unknown, { uri: '/y/z//' })({ ...contextTrivial, uri: '/x/' });
        
        expect(resource1).property(resourceDef).property('uri').to.deep.equal('');
        expect(resource2).property(resourceDef).property('uri').to.deep.equal('x');
        expect(resource3).property(resourceDef).property('uri').to.deep.equal('/x/y/z');
        expect(resource4).property(resourceDef).property('uri').to.deep.equal('/x/y/z');
    });
    
    it('should allow configuration of the `store`', () => {
        const resource1 = makeResource(Unknown, { store: [] })(contextTrivial);
        const resource2 = makeResource(Unknown, { store: ['x'] })(contextTrivial);
        
        // With non-empty context `store`
        const resource3 = makeResource(Unknown, { store: ['y', 'z'] })({ ...contextTrivial, store: ['x'] });
        
        expect(resource1).property(resourceDef).property('store').to.deep.equal([]);
        expect(resource2).property(resourceDef).property('store').to.deep.equal(['x']);
        expect(resource3).property(resourceDef).property('store').to.deep.equal(['x', 'y', 'z']);
    });
    
    it('should allow definition of methods', () => {
        const methodMock = sinon.stub().callsFake(name => `Hello ${name}`);
        
        const resource = makeResource(Unknown, {
            methods: {
                greet: methodMock,
            },
        })(contextTrivial);
        
        expect(resource).to.have.property('greet').to.be.a('function');
        
        const result = resource.greet('Alice');
        
        expect(result).to.equal('Hello Alice');
        sinon.assert.calledOnce(methodMock);
        sinon.assert.calledWith(methodMock, 'Alice');
        sinon.assert.calledOn(methodMock, resource); // `this` should be the resource
    });
    
    it('should allow definition of subresources', () => {
        const resource = makeResource(Unknown, {
            resources: {
                foo: makeResource(Unknown),
            },
        })(contextTrivial);
        
        // Note: can be either an object or a function, depends on the resource type
        expect(resource).to.have.property('foo').to.satisfy(foo =>
            typeof foo === 'object' || typeof foo === 'function'
        );
    });
    
    it('should use sensible defaults for subresources', () => {
        const context = {
            ...contextTrivial,
            path: ['x'],
            uri: '/x',
            store: ['x'],
        };
        
        const resource = makeResource(Unknown, {
            path: ['y'],
            uri: 'y',
            store: ['y'],
            resources: {
                z: makeResource(Unknown),
            },
        })(context);
        
        // Subresources should use their key as the default label (in this case, `z`)
        expect(resource.z).property(resourceDef).property('path').to.deep.equal(['x', 'y', 'z']);
        expect(resource.z).property(resourceDef).property('uri').to.equal('/x/y/z');
        expect(resource.z).property(resourceDef).property('store').to.deep.equal(['x', 'y', 'z']);
    });
};
