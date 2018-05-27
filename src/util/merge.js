
import merge from 'object-merge-advanced';


const optionsDefaults = {
    // XXX this doesn't work as expected, will still concat arrays in most cases
    //concatInsteadOfMerging: false, // Do not concat arrays, replace them
    
    cb: (first, second, result) => {
        if (Array.isArray(second)) {
            // Hard merge arrays
            // TODO: allow a may to override this behavior
            return second;
        } else {
            return result;
        }
    },
};

export default (input1, input2, options = {}) =>
    merge(input1, input2, { ...optionsDefaults, ...options });
