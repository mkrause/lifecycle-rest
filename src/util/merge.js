
import merge from 'object-merge-advanced';


const optionsDefaults = {
    concatInsteadOfMerging: false, // Do not concat arrays, replace them
};

export default (input1, input2, options = {}) =>
    merge(input1, input2, merge(optionsDefaults, options));
