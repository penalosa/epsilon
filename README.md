# `@penalosa/epsilon`

> Fast, fun & simple communication over websockets

Install with `npm install @penalosa/epsilon` or `yarn add @penalosa/epsilon`. It works, but is in a very early stage of development, so expect bugs.

## QuickStart

```javascript
// On the server, node.js code
import { server } from '@penalosa/epsilon'

const app = server()

app.helloWorld = ({ name }) => {
  return `Hello ${name}`
}
```

```javascript
// Clientside
import { client } from '@penalosa/epsilon'

const api = client(`ws://localhost:8090`)

api.helloWorld({ name: `Jane Smith` }).then(console.log)
// Will output "Hello Jane Smith"
```

## API reference

```javascript
// server :: ({ port: number | undefined, debug: boolean | undefined } | undefined) -> Proxy
import { server } from '@penalosa/epsilon'
```

The `port` parameter describes the port on which the websocket server will be served, and the `debug` parameter enables debug logging to the console.

The `server` function returns a proxy that can be assigned to in order to register handlers. The property that you assign to becomes the endpoint name. The function definition can be `async`, and when called is given three parameters:

- `payload`, wich is whatever was sent by the client
- `persisted`, any data that's been persisted for this specific connection
- `api`, of the form `{ persist, publish}`, both of which are functions:
  - `persist` - Takes a single parameter of any type, and persists it onto the specific connection. Any subsequent handler invocations will receive it as `persisted`
  - `publish` - Publish some data to multiple clients. Takes three parameters, `(subscription, match, payload)`. `subscription` is a string that identifies this for clients to know where to send it. `match` is a function that decides which clients this data will be sent to. It takes a single parameter of the persisted data on a specific client, and returns a boolean. Payload is what should be sent to clients.

```javascript
import { server } from '@penalosa/epsilon'

const app = server()

app.hello = async ({ name }, _, { persist, publish }) => {
  persist({ name })
  publish('say_hi', () => true, `${name} was greeted`)
  return `Hello ${name}`
}
app.whoami = async (_, { name }) => {
  return name
}
```

```javascript
// client :: (string, { debug: boolean | undefined } | undefined) -> Proxy
import { client } from '@penalosa/epsilon'
```

The first parameter is the websocket connection string to use, a la `ws://localhost:3000`, where `3000` is the port defined in `server()` (default is `8090`),and the `debug` parameter enables debug logging to the console.

Calling `client` returns a proxy that works in a similar manner to the server. Calling a property triggers the corresponding handler on the server, and is resolved with the handler's return value (or rejected if the handler rejects):

```javascript
// client :: (string, { debug: boolean | undefined } | undefined) -> Proxy
import { client } from '@penalosa/epsilon'

const api = client(`ws://localhost:8090`)

api
  .hello({ name: `Jane Smith` })
  .then(() => api.whoami())
  .then(console.log)
//Logs `Jane Smith`
```

Listening for server published events is also really simple - instead of calling a property of the proxy, you assign to the property:

```javascript
import { client } from '@penalosa/epsilon'

const api = client(`ws://localhost:8090`)

api.say_hi = console.log

// Using the examples above, this could log `Jane Smith was greeted`
```
