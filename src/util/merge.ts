
// @ts-ignore
import merge from 'object-merge-advanced';

import { Object as ObjectT } from 'ts-toolbelt';


const optionsDefaults = {
    // XXX this doesn't work as expected, will still concat arrays in most cases
    //concatInsteadOfMerging: false, // Do not concat arrays, replace them
    
    cb: (first : any, second : any, result : any) => {
        if (Array.isArray(second)) {
            // Hard merge arrays
            // TODO: allow a may to override this behavior
            return second;
        } else {
            return result;
        }
    },
};

// Note: `ObjectT.MergeUp` prioritizes the first argument over the second (we flip it around)
type Merge<O1 extends object, O2 extends object> = ObjectT.MergeUp<O2, O1>;

export default <I1 extends object, I2 extends object>(input1 : I1, input2 : I2, options : object = {})
    : Merge<I1, I2> =>
        merge(input1, input2, { ...optionsDefaults, ...options });
