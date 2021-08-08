
import * as ObjectUtil from '../util/ObjectUtil';


export type Index = string | number; // TODO: support other index types?
export type StepIndex = { index : Index };
export type Step = string | number | StepIndex;
export type Location = Array<Step>;

export const isIndex = (value : unknown) : value is Step => {
    return typeof value === 'string' || typeof value === 'number';
};

export const isIndexStep = (value : unknown) : value is StepIndex => {
    return ObjectUtil.isObject(value) && ObjectUtil.isPlainObject(value) && ObjectUtil.hasOwnProp(value, 'index')
        && isIndex(value.index);
};

export const isStep = (value : unknown) : value is Step => {
    return typeof value === 'string' || typeof value === 'number' || isIndexStep(value);
};

export const isLocation = (value : unknown) : value is Location => {
    return Array.isArray(value) && value.every(isStep);
};


/*
TODO: in the future, we may want to extend `Index` to any kind of "showable" value (convertable to string)

export type Showable = string | number
    | { toString : () => string }
    | { toJSON : () => unknown }

export const showableToString = (showable : Showable) : string => {
    if (typeof showable === 'string') {
        return showable;
    } else if (typeof showable === 'number') {
        return String(showable);
    } else if ('toJSON' in showable) {
        // Note: the `toJSON` if branch must come before the `toString` one, otherwise TypeScript (as of v3.7) seems
        // to have a bug where it infers the type as `never` after the `toString` case.
        return JSON.stringify(showable);
    } else if ('toString' in showable) {
        return showable.toString();
    } else {
        throw new TypeError($msg`Invalid argument given, unable to convert to string: ${showable}`);
    }
};
*/

export const indexAsString = (index : Index) : string => {
    // TODO: may want to support more than just `string | number` here
    return String(index);
};

export const stepAsString = (step : Step) : string => {
    if (isIndexStep(step)) {
        return indexAsString(step.index);
    } else {
        return String(step);
    }
};

export const locationAsString = (location : Location, separator = '.') : string => {
    return location.map(stepAsString).join(separator);
};
