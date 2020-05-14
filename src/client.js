export default (url, { debug = false } = { debug: false }) => {
  const setup = () => {
    let ws = new WebSocket(url)
    debug && console.log(`Constructing event listeners`)
    ws.onopen = onOpen
    ws.onclose = onClose
    ws.onmessage = onMessage
    return ws
  }
  const heartbeat = setInterval(() => {
    requestQueue.push(
      JSON.stringify({
        method: '__heartbeat',
      })
    )
    kickoffRequests()
  }, 5000)
  let ws = setup()
  let requestQueue = []
  const kickoffRequests = () => {
    let req = requestQueue.shift()
    if (!req) {
      return
    }
    try {
      ws.send(req)
      if (requestQueue.length > 0) {
        Promise.resolve().then(kickoffRequests)
      }
    } catch (e) {
      requestQueue.push(req)
    }
  }
  let inProgress = {
    subscriptions: {
      __heartbeat: (payload) => {
        debug && console.log(`Heartbeat: ${payload}`)
      },
    },
    rpc: {},
  }
  let requestId = 1
  let proxy = new Proxy(inProgress, {
    set: (target, event, handler) => {
      target.subscriptions[event] = handler
    },
    get: (target, method) => {
      return (payload) => {
        return new Promise((resolve, reject) => {
          target.rpc[requestId] = { resolve, reject }

          requestQueue.push(
            JSON.stringify({
              method,
              requestId,
              payload,
            })
          )
          kickoffRequests()
          requestId++
        })
      }
    },
  })
  function onOpen() {
    debug && console.log(`Connection opened`)

    kickoffRequests()
  }
  const reconnect = () => {
    try {
      ws = setup()
    } catch (e) {
      setTimeout(reconnect, 1000)
    }
  }
  function onClose() {
    debug && console.warn(`Connection closed`)
    reconnect()
  }

  function onMessage({ data }) {
    const { payload, success, subscription, requestId } = JSON.parse(data)
    debug &&
      console.log(`Message received from server:`, {
        payload,
        success,
        subscription,
        requestId,
      })

    if (subscription) {
      let handler = inProgress.subscriptions[subscription]
      if (handler) {
        return handler(payload)
      } else {
        debug && console.warn(`No handler for subscription: ${subscription}`)
        return
      }
    }

    let handler = inProgress.rpc[requestId]

    if (handler) {
      if (success) {
        handler.resolve(payload)
      } else {
        handler.reject(payload)
      }

      delete inProgress.rpc[requestId]
    } else {
      console.error(`No handler for RPC return: ${requestId}`)
    }
  }
  return proxy
}
