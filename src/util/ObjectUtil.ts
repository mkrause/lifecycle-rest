
type ValuesOf<O extends object> = O[keyof O];


// Note: in TypeScript it is not normally supported to use `in` or `hasOwnProperty` as a type guard on generic objects.
// https://github.com/microsoft/TypeScript/issues/21732
export const hasProp = <O extends object, K extends PropertyKey>(obj : O, propKey : K)
    : obj is O & { [key in K] : unknown } =>
        propKey in obj;

// Same as `hasProp`, but specifically checks for an own property (for TS there is no difference).
export const hasOwnProp = <O extends object, K extends PropertyKey>(obj : O, propKey : K)
    : obj is O & { [key in K] : unknown } =>
        Object.prototype.hasOwnProperty.call(obj, propKey);


// Check if the given value is an object (non-null)
export const isObject = (obj : unknown) : obj is object => {
    return typeof obj === 'object' && obj !== null;
};


// Check if the given object is a plain object (prototype either `null` or `Object.prototype`).
// Note: do *not* give this a type predicate (e.g. `obj is object`). Because TS cannot differentiate between `object`
// and plain objects anyway, so it will deduce that this function always return true. Which means that legitimate
// `else` clauses will get type checked as type `never`.
export const isPlainObject = (obj : object) => {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    
    const proto = Object.getPrototypeOf(obj);
    return proto === null || proto === Object.prototype;
};


// Map over the values of the given object
export const mapValues = <O extends object, Result>
    (obj : O, fn : (value : ValuesOf<O>, key : keyof O) => Result) : { [key in keyof O] : Result } => {
        const result = {} as { [key in keyof O] : Result };
        for (const key in obj) {
            result[key] = fn(obj[key], key);
        }
        return result;
    };
