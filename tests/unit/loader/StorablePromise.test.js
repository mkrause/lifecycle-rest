
import { expect } from 'chai';

import { status, Loadable, LoadError } from '@mkrause/lifecycle-loader';

import StorablePromise from '../../../src/loader/StorablePromise.js';


describe('StorablePromise', () => {
    const spec = { location: ['a', 'b', 'c'], operation: 'put' };
    
    describe('constructor', () => {
        it('should construct a StorablePromise', () => {
            const promise = new StorablePromise(
                (resolve, reject) => { resolve(42); },
                Loadable(null),
                spec
            );
            
            expect(promise).to.be.an.instanceOf(StorablePromise);
            
            // Should expose its spec
            expect(promise).to.have.property('spec');
            expect(promise.spec).to.have.property('location').to.deep.equal(spec.location);
            expect(promise.spec).to.have.property('operation').to.deep.equal(spec.operation);
            expect(promise.spec).to.have.property('accessor').to.satisfy(accessor => {
                return accessor('foo') === 'foo'; // Should be the identity function
            });
        });
    });
    
    describe('thenable', () => {
        it('should implement then() (for resolved)', async () => {
            const promise = new StorablePromise(
                (resolve, reject) => { resolve(42); },
                Loadable(null),
                spec
            );
            
            return promise
                .then(
                    result => {
                        expect(result.valueOf()).to.equal(42);
                    },
                    reason => {
                        throw new Error('Expected promise not to be rejected');
                    },
                );
        });
        
        it('should implement then() (for rejected)', async () => {
            const promise = new StorablePromise(
                (resolve, reject) => { reject(new Error('Failed')); },
                Loadable(null),
                spec
            );
            
            return promise
                .then(
                    result => {
                        throw new Error('Expected promise to be rejected');
                    },
                    reason => {
                        expect(reason).to.be.an.instanceOf(LoadError);
                        
                        const item = reason.item;
                        expect(status in item).to.be.true;
                        expect(item[status]).to.have.property('error').to.be.an.instanceOf(Error);
                        expect(item[status]).to.have.property('error').to.have.property('message', 'Failed');
                    },
                );
        });
    });
    
    describe('await', () => {
        // Note: any thenable should work with await. But we'll test it anyway.
        
        it('should work with await (for resolved)', async () => {
            const result = await new StorablePromise(
                (resolve, reject) => { resolve(42); },
                Loadable(null),
                spec
            );
            
            expect(result).to.be.an.instanceOf(Number);
            expect(result.valueOf()).to.equal(42);
            expect(status in result).to.be.true;
            expect(result[status]).to.have.property('ready', true);
            expect(result[status]).to.have.property('loading', false);
            expect(result[status]).to.have.property('error', null);
        });
        
        it('should work with await (for rejected)', async () => {
            try {
                await new StorablePromise(
                    (resolve, reject) => { reject(new Error('Failed')); },
                    Loadable(null),
                    spec
                );
                
                throw new Error('Expected promise to throw');
            } catch (reason) {
                expect(reason).to.be.an.instanceOf(LoadError);
                
                const item = reason.item;
                expect(status in item).to.be.true;
                expect(item[status]).to.have.property('error').to.be.an.instanceOf(Error);
                expect(item[status]).to.have.property('error').to.have.property('message', 'Failed');
            }
        });
    });
    
    describe('chaining', () => {
        it('should chain as plain promise', async () => {
            // Promises support *chaining*, where a (non-thenable) return value from then() is
            // converted to a new promise. We expect this chain to result in a plain Promise instance.
            
            const promise = new StorablePromise(
                (resolve, reject) => { resolve(42); },
                Loadable(null),
                spec
            );
            
            const chainedPromise = promise.then(() => { return 'chained result'; });
            
            expect(chainedPromise).to.be.an.instanceOf(Promise);
            
            const result = await chainedPromise;
            
            expect(result).to.equal('chained result');
        });
    });
    
    describe('from promise', () => {
        it('should be constructable from plain promise', async () => {
            const promise = StorablePromise.from(
                Loadable(null),
                spec,
                Promise.resolve(42)
            );
            
            expect(promise).to.be.an.instanceOf(StorablePromise);
            
            expect(promise).to.have.property('spec');
            expect(promise.spec).to.have.property('location').to.deep.equal(spec.location);
            expect(promise.spec).to.have.property('operation').to.deep.equal(spec.operation);
            expect(promise.spec).to.have.property('accessor').to.satisfy(accessor => {
                return accessor('foo') === 'foo'; // Should be the identity function
            });
            
            const result = await promise;
            
            expect(result).to.be.an.instanceOf(Number);
            expect(result.valueOf()).to.equal(42);
            expect(status in result).to.be.true;
            expect(result[status]).to.have.property('ready', true);
            expect(result[status]).to.have.property('loading', false);
            expect(result[status]).to.have.property('error', null);
        });
    });
    
    describe('asPromise()', () => {
        it('should be convertable to plain promise', async () => {
            const promise = new StorablePromise(
                (resolve, reject) => { resolve(42); },
                Loadable(null),
                spec
            );
            
            const promisePlain = promise.asPromise();
            expect(promisePlain).to.be.an.instanceOf(Promise);
            
            const result = await promisePlain;
            
            expect(result).to.be.an.instanceOf(Number);
            expect(result.valueOf()).to.equal(42);
            expect(status in result).to.be.true;
            expect(result[status]).to.have.property('ready', true);
            expect(result[status]).to.have.property('loading', false);
            expect(result[status]).to.have.property('error', null);
        });
    });
});
