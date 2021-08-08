
import * as ObjectUtil from '../util/ObjectUtil';

import type { Schema } from '../schema/Schema';

import type { Resource } from './Resource';
import { resourceDef, ResourceDefinition } from './Resource';

import type { StorableSpec } from './StorablePromise';
import { isStorable, makeStorable } from './StorablePromise';


// Resource method utilities

type ResourceMethodOptions<R> = {
    storable ?: boolean | Partial<StorableSpec<R>>,
};
type ResourceMethod<S extends Schema, A extends Array<unknown>, R> = (
    this : Resource<S>,
    resourceDef: ResourceDefinition<S>,
    ...args : A
) => R;

export const decorateMethod =
    <S extends Schema, A extends Array<unknown>, R>(
        method: ResourceMethod<S, A, R>,
        { storable = true }: Partial<ResourceMethodOptions<R>> = {},
    ) =>
    function(this : Resource<S>, ...args : A): R {
          const resourceDefinition = this[resourceDef];
          let result = Function.prototype.apply.call(method, this, [resourceDefinition, ...args]);
          
          if (storable && result instanceof Promise && !isStorable(result)) {
                const storableSpecDefaults : Partial<StorableSpec<R>> = {
                    accessor: <R>(result : R) : R => result,
                    location: resourceDefinition.store,
                    operation: 'put',
                };
                
                const storableSpec : Partial<StorableSpec<R>> = typeof storable === 'object' && storable !== null
                    ? { ...storableSpecDefaults, ...storable }
                    : storableSpecDefaults;
                
                result = makeStorable(result, storableSpec);
          }
          
          return result;
    };

// Decorator, for (legacy-style) `@decorator` syntax on object literal methods
export const decorator = <R>(options : ResourceMethodOptions<R> = {}) =>
    <S extends Schema, A extends Array<unknown>>(
        _target : unknown,
        _key : PropertyKey,
        descriptor : TypedPropertyDescriptor<ResourceMethod<S, A, R>>,
    ) : TypedPropertyDescriptor<(this : Resource<S>, ...args : A) => R> => {
        // A valid descriptor must have *either* `value` *or* `get` + `set`, currently we only support `value`. The
        // properties `get`/`set` must be completely absent (not just `undefined`), otherwise we get a runtime error.
        if (ObjectUtil.hasProp(descriptor, 'get') || ObjectUtil.hasProp(descriptor, 'set')) {
            throw new TypeError(`Given descriptor with getter/setter, expected value-based descriptor`);
        }
        let descriptorWithValue : Omit<TypedPropertyDescriptor<ResourceMethod<S, A, R>>, 'get' | 'set'> = descriptor;
        
        if (typeof descriptorWithValue.value !== 'function') {
            throw new TypeError(`Invalid value for @RestApi.method decorator, expected a function`);
        }
        const method = descriptorWithValue.value;
        
        return {
            ...descriptorWithValue,
            value: decorateMethod(method, options),
        };
    };
