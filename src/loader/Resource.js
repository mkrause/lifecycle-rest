
import type { LoadableT } from '@mkrause/lifecycle';


// FIXME: do we really need LoadableT?
// FIXME: should we make traversal optional? (e.g. leaf node types)
export type Item = LoadableT & {
    // Traversal
    get : (index : mixed) => Item,
    set : (index : mixed, item : Item) => void,
};

export type ItemSchema = {
    instantiate : () => Item,
    decode : (instanceEncoded : mixed) => Item;
    encode : (instance : Item) => mixed;
};

// FIXME: does not adhere to Item type currently
export class SimpleItem implements ItemSchema {
    static instantiate() { return {}; }
    static decode(instanceEncoded : mixed) : Item { return instanceEncoded; }
    static encode(instance : Item) : mixed { return instance; }
}
