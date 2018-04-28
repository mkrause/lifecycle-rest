
export const mapValues = (obj, fn) => Object.entries(obj).reduce(
    (acc, [key, value]) => {
        acc[key] = fn(value, key);
        return acc;
    },
    {}
);
