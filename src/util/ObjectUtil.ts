
export const hasOwnProperty = <K extends PropertyKey>(obj : object, key : K) : obj is { [key in K] : unknown } =>
    Object.prototype.hasOwnProperty.call(obj, key);


export const isObject = (obj : unknown) : obj is { [key in PropertyKey] : unknown } =>
    typeof obj === 'object' && obj !== null;


export const isPlainObject = (obj : unknown) => {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    
    const proto = Object.getPrototypeOf(obj);
    return proto === null || proto === Object.prototype;
};


export const mapValues = <O extends {}, Result>(obj : O, fn : (value : O[keyof O], key : keyof O) => Result)
    : { [key in keyof O] : Result } => {
        const result : { [key : string] : Result } = {};
        for (const key in obj) {
            result[key] = fn(obj[key], key);
        }
        return result as any;
    };
