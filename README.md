
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

```js
RestApi.Item(schema, resourceSpec)
```

Configuration:

  * `uri`: The URI of the resource. If relative, will be created relative to the URI of the parent resource. Defaults to the name of the subresource (or empty `""` if this is the root resource).
  * `methods`: Custom methods definitions (see below).
  * `resources`: A map of subresources, if any.

There are a number of methods implemented on this resource by default:

  * `get(params : Object)`: Perform a GET request, using `params` as the query parameters.
  * `put(item : Item, params : Object)`: Perform a PUT request, where `item` is the resource to send.

Schema:

```js
type Item = mixed;
type ItemSchema = {
    instantiate : () => Item,
    decode : (instanceEncoded : mixed) => Item;
    encode : (instance : Item) => mixed;
};
```

Custom methods can be defined as follows:

```js
const api = RestApi.Item(Item, {
    methods: {
        getCustom: (spec, ...args) => {
            // Here, `spec` is the resource definition, and `args` contains any remaining arguments
        },
    },
});

api.getCustom('foo', 'bar');
```


### `RestApi.Collection`

```js
RestApi.Collection(CollectionSchema, resourceSpec)
```

Configuration:

  * `uri`: The URI of the resource. If relative, will be created relative to the URI of the parent resource. Defaults to the name of the subresource (or empty `""` if this is the root resource).
  * `methods`: Custom methods definitions (see below).
  * `resources`: A map of subresources, if any.
  * `entry`: Resource definition for entries of this collection.

There are a number of methods implemented on this resource by default:

  * `list(params : Object)`: Perform a GET request, using `params` as the query parameters.
  * `put(collection : Collection, params : Object)`: Perform a PUT request, where `collection` is the resource to send.
  * `create(entry : Entry)`. Create a new entry in the collection. Requires the `entry` property to be defined in order to determine the resource type (`Entry`).


Schema:

```js
type Collection = mixed;
type CollectionSchema = {
    instantiate : () => Collection,
    decode : (instanceEncoded : mixed) => Collection;
    encode : (instance : Collection) => mixed;
};
```


## Integration with redux

`lifecycle-rest` comes with integration with redux out of the box. To use it, you will need to install the middleware in order to be able to dispatch REST API calls.

```js
import { createStore, applyMiddleware } from 'redux';
import { redux as lifecycleRedux } from '@mkrause/lifecycle-rest';

const lifecycleMiddleware = lifecycleRedux.middleware;
const store = createStore(reducer, initialState, applyMiddleware(lifecycleMiddleware));
```

Now, you can use `dispatch` to dispatch API calls as follows:

```js
const api = RestApi(...);

// Somewhere in your application:
dispatch(api.users.get());
```

This will result in two actions being dispatched: a *loading* action right at the start of the call. Then later either a *ready* or *failed* action when the API call gets a response. You can handle these actions yourself in your reducer, or if you want you can use the standard reducer provided by this library:

```js
import { createStore, applyMiddleware } from 'redux';
import { redux as lifecycleRedux } from '@mkrause/lifecycle-rest';

const lifecycleMiddleware = lifecycleRedux.middleware;
const reducers = [lifecycleRedux.reducer]; // Add your own reducers

const reducer = (state, action) =>
    reducers.reduce((state, reducer) => reducer(state, action), state);
const store = createStore(reducer, initialState, applyMiddleware(lifecycleMiddleware));
```


## Similar libraries

There are plenty of libraries already out there to create REST clients, [see here](https://github.com/marmelab/awesome-rest#javascript-clients) for some popular examples. The main reason I've created this library is because I needed it to integrate with a set of state management libraries I've called [lifecycle](https://github.com/mkrause/lifecycle-loader).

But there are a few other reasons I think makes this library stand out from the rest (no pun intended!):

* Upfront, declarative definition as opposed to defining endpoints dynamically. By teaching the client about the API resources up front we can provide smarter, more error-proof handling of API requests.

* API calls don't just return data, but also provide descriptions of the state updates that need to be done to incorporate this data in your state tree (redux, or other state management libraries). For example, depending on the type of API request performed, the state update may be partial or full, and this is reflected through the `status` of the resulting state item.
