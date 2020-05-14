/* Data format is {
    method: 'ping',
    payload: {
        ...arbitrary
    },
    Error format is {
      error:true,
      message: "...",
      ...echo input
    }
}

API is 
.publish (match_function(persisted_data), payload)
.* = (persisted_data, payload)
  -> return { payload }, or { persist:new_persisted_data, payload:payload }
*/
import WebSocket from 'ws'
export default ({ port = 8090, debug = false } = {}) => {
  const persistData = Symbol('persist')
  const identifier = Symbol('identifier')
  let id = 1
  const wss = new WebSocket.Server({ port })

  let connection = {
    heartbeat: (payload) => payload,
  }

  let proxy = new Proxy(connection, {
    set: (target, method, definition) => {
      if (target[method])
        debug &&
          console.warn(`Overriding defined method ${method}`, target[method])
      target[method] = definition

      return true
    },
    get: (target, method) => {
      if (!target[method]) throw new Error("Method doesn't exist")
      return target[method]
    },
  })

  const respond = ({ requestId, payload }) =>
    JSON.stringify({
      success: true,
      requestId,
      payload,
    })
  const error = ({ requestId, payload }) =>
    JSON.stringify({
      success: false,
      requestId,
      payload,
    })
  wss.on('connection', (ws) => {
    ws[identifier] = id++
    ws[persistData] = {}
    ws.on('message', async (message) => {
      try {
        let { method, payload, requestId } = JSON.parse(message)

        try {
          if (method == `__heartbeat`) {
            return ws.send(JSON.stringify({ subscription: '__heartbeat' }))
          }
          if (!method) {
            throw new Error('Method not supplied')
          }
          if (!requestId) {
            throw new Error('requestId not supplied')
          }
          let handler = proxy[method]
          let result = await handler(payload || {}, ws[persistData], {
            persist: (data) => (ws[persistData] = data),
            publish: (subscription, match, payload) => {
              wss.clients.forEach((client) => {
                if (
                  client.readyState === WebSocket.OPEN &&
                  match(client[persistData])
                ) {
                  client.send(
                    JSON.stringify({
                      success: true,
                      subscription,
                      payload,
                    })
                  )
                }
              })
            },
          })
          return ws.send(respond({ requestId, payload: result }))
        } catch (e) {
          return ws.send(error({ requestId, payload: e.message }))
        }
      } catch (e) {
        debug && console.error('Malformed payload received:', e.message)
      }
    })
  })
  return proxy
}
