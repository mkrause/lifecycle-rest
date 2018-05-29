
# lifecycle-rest

Declarative REST API definition utility.


## Usage

To define your API, you first need to create an *agent* that performs the HTTP requests. We provide a `createAgent` function that wraps around the [axios](https://github.com/axios/axios) library.

```js
import RestApi, { createAgent } from '@mkrause/lifecycle-rest';

const agent = createAgent({
    baseURL: 'https://example.com/api',
});

const api = RestApi(agent, {
    resources: {
        users: RestApi.Collection(UsersCollection, {}),
    },
});

const users = await api.users.list();
```

The API definition itself is a tree of *resources*. There are two types of resources:

* Item (default)
* Collection

Each resource has *methods* that you may call. Additionally, each resource may define subresources.


## Item resources

Signature:

```js
RestApi.Item(ItemSchema, resourceSpec)
```

Schema:

```js
type ItemInstance = mixed;
type ItemSchema = {
    instantiate : () => ItemInstance,
    decode : (instanceEncoded : mixed) => ItemInstance;
    encode : (instance : ItemInstance) => mixed;
};
```

Methods:

  * `get()`
  * `put()`


## Collection resources

```js
RestApi.Collection(CollectionSchema, resourceSpec)
```

Schema:

```js
type CollectionInstance = mixed;
type CollectionSchema = {
    instantiate : () => CollectionInstance,
    decode : (instanceEncoded : mixed) => CollectionInstance;
    encode : (instance : CollectionInstance) => mixed;
};
```

Methods:

  * `list()`
  * `create()`
  * `put()`
