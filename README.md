
# lifecycle-rest

Create a REST API client through a declarative API definition.


## Usage

This library exports a `RestApi` function, which you can use to define your API. It takes two arguments: the *agent* which is used to make the HTTP requests, and an API definition that declares the various kinds of resources that your REST API is made out of.

```js
import RestApi from '@mkrause/lifecycle-rest';

const api = RestApi(<agent>, <api-definition>);
```

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


## Similar libraries

There are plenty of libraries already out there to create REST clients, [see here](https://github.com/marmelab/awesome-rest#javascript-clients) for some popular examples. The main reason I've created this library is because I needed it to integrate with a set of state management libraries I've called [lifecycle](https://github.com/mkrause/lifecycle-loader).

But there are a few other reasons I think makes this library stand out from the rest (no pun intended!):

* Upfront, declarative definition as opposed to defining endpoints dynamically. By teaching the client about the API resources up front we can provide smarter, more error-proof handling of API requests.

* API calls don't just return data, but also provide descriptions of the state updates that need to be done to incorporate this data in your state tree (redux, or other state management libraries). For example, depending on the type of API request performed, the state update may be partial or full, and this is reflected through the `status` of the resulting state item.
