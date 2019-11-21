
type ValuesOf<O extends object> = O[keyof O];


// Version of `hasOwnProperty` that doesn't rely on the prototype (to prevent possible overrides)
export const hasProp = (obj : object, propKey : PropertyKey) =>
    Object.prototype.hasOwnProperty.call(obj, propKey);


// Check if the given value is an object (non-null)
export const isObject = (obj : unknown) : obj is object => {
    return typeof obj === 'object' && obj !== null;
};


// Check if the given object is a plain object (prototype either `null` or `Object.prototype`)
export const isPlainObject = (obj : unknown) : obj is object => {
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
