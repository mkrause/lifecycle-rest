
# lifecycle-rest

Create a REST API client through a declarative API definition.


## Usage

This library exports a `RestApi` function, which you can use to define your API. It takes two arguments: the *agent* which is used to make the HTTP requests, and an API definition that declares the various kinds of resources that your REST API is made out of.

```js
import RestApi from '@mkrause/lifecycle-rest';

const api = RestApi(<agent>, <api-definition>);
```

The agent should be an instance of the [axios](https://github.com/axios/axios) library. We provide a `createAgent` helper that you can use that comes with a few useful defaults.

```js
import RestApi, { createAgent } from '@mkrause/lifecycle-rest';

const agent = createAgent({
    baseURL: 'https://example.com/api',
});
```

The API definition consists of a tree of *resource definitions*. A resource definition describes some [REST resource](https://stackoverflow.com/questions/10799198/what-are-rest-resources) in your API. For example, you might have an endpoint `hello` that takes a name and returns a greeting. You could define that resource as follows:

```js
const greetingApi = RestApi(agent, {
    uri: 'hello',
});

// GET https://example.com/api/hello?name=Bob
const greeting = await greetingApi.get({ name: 'Bob' }); // Returns "Hello Bob!"
```

Each resource may have *subresources*. Subresources are accessed as properties on the resulting API client:

```js
const api = RestApi(agent, {
    resources: {
        users: RestApi.Collection(),
    },
});

// GET https://example.com/api/users
const users = await api.users.list();
```

Notice that we've defined the `users` subresource as a `Collection` resource. There are several types of resources available, and each comes with their own methods.

  * `RestApi.Item`
  * `RestApi.Collection`

Note that if you do not specify the type of the resource explicitly (as in the "greeting" example), then we will create an Item resource by default.

Properties of subresources (like the `uri`) are relative to their parent resource by default. If the `uri` is not specified we will use the name of the subresource (e.g. `users` in the example above).


## Resource Types

### `RestApi.Item`

Signature:

```js
RestApi.Item(schema, resourceSpec)
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


### `RestApi.Collection`

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
