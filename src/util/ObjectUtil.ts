
export const hasOwnProperty = (obj : {}, propKey : PropertyKey) =>
    Object.prototype.hasOwnProperty.call(obj, propKey);


export const isPlainObject = (obj : {}) => {
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
