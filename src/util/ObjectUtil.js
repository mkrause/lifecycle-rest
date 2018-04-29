
export const isPlainObject = obj => {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    
    const proto = Object.getPrototypeOf(obj);
    return proto === null || proto === Object.prototype;
};

export const mapValues = (obj, fn) => Object.entries(obj).reduce(
    (acc, [key, value]) => {
        acc[key] = fn(value, key);
        return acc;
    },
    {}
);
