decaf-jolt-sockjs
=================

SockJS implementation for decafjs/jolt

This decafjs module implements the sockjs protocol for the server-side using the jolt application framework.  It works with the stock sockjs client.

WebSockets are unreliable:

1. They are not implemented in all browsers in use.  
2. There may be proxies between the browser and the server that do not pass on the WebSocket protocol.

SockJS implements an API that strongly resembles the WebSocket API, but under the hood it will use a variety of streaming or polling protocols to achieve WebSocket-like results if WebSockets are not available.

You use the stock SockJS client library in your HTML/Web application.   This module implements a compatible server-side that speaks the various protocols.  On the server, the API resembles the decafjs style Socket API.  Note that you listen for connections on the server and you create connections on the client, so the API cannot be exactly the same.  But they are very close.

There is a nice example working test program at https://github.com/decafjs/decaf-examples/tree/master/SockJS.

## References

See:

* http://sockjs.org for details about the sockjs client.
* https://github.com/sockjs/sockjs-protocol for details about the sockjs protocol.

## Use

Add the following to your application's bower.json:

```javascript
  "dependencies": [
    ...
    "decaf-jolt-sockjs": "decafjs/decaf-jolt-sockjs#master",
    "sockjs" : "*",
    ...
  ]
```

In your app.js (decafjs application main program):

```javascript
var SockJS       = require('decaf-jolt-sockjs').SockJS,
    Application  = require('decaf-jolt').Application,
    StaticFile   = require('decaf-jolt-static').StaticFile,
    ... // etc (more jolt plugins)
    app          = new Application(),
    sockjs       = new SockJS(app, 'echo'),

app.verb('/', new StaticFile('index.html'));
sockjs.on('open', function(sock) {
    sock.write('hello, world');	// any thread may write to the socket at any time
    sock.on('message', function(message) {
      // messages are processed via events
      console.log('message = ' + message);
      sock.write(message);
    });
    sock.on('close', function() {
    	// a close event is fired when the socket is closed.
      console.log('goodbye cruel world');
    });
});
```

In your HTML page, something you do something like this:

```html
<body>
...
<script type="text/javascript" src="bower_components/sockjs/sockjs.js"></script>
<script>
var sock = new SockJS('http://localhost:8080/echo', null, { debug: true });
sock.onopen = function() {
  console.log('socket open');
  sock.send('hello from client');
};
sock.onmessage = function(e) {
  console.log('message: ' + e.data);  // 'hello world' sent by server code above
};
sock.onclose = function(e) {
  console.log('socket closed');
};
</script>
...
</body>
```

## Implemented

1. WebSocket
2. xhr streaming
3. xhr polling

These may be sufficient for complete functionality.  Other protocols may provide more optimal transport methods.

## Not implemented yet

1. EventSource incomplete
2. xdr streaming
3. iframe-htmlfile
4. iframe-xhr-polling
5. iframe-eventsource
6. jsonp-polling
