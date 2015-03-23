/**
 * Created by alexandrulazar on 3/21/15.
 * Requires SockJS to be able to use it
 * 
 * var eventBus = new EventBus('ws://domain.com/socokets'); // just takes the URL as param
 * eventBus.on('open', function() { console.log('connection open');});
 * eventBus.on('close', function() { console.log('connection closed');});
 * eventBus.on('message', function(msg) { 
 *      console.log('Message = ', msg); // it will be JSON object
 *      if (msg.action == "add") { 
 *          // add something 
 *          
 *      }
 * });
 * 
 * // Subscribe to a certain room/address
 * eventBus.subscribe('Room-1');
 * 
 * // Broadcast a message to all the socksts subscribed to a certain address
 * eventBus.publish('Room-1', { 
 *          "action":"add", 
 *          "data": { 
 *              "message": "My new message"
 *          }
 * });
 * 
 * // Unsubscribe from a certain room/address
 * eventBus.unsubscribe('Room-1');
 */
(function() {
    "use strict";

    function EventBus(url) {
        if (!SockJS || typeof SockJS !== "function") {
            console.error("SockJS is required to use EventBus. Make sure you have included it in the scripts app loads.");
            return;
        }

        var me = this,
            config = { debug: true },
            socket = new SockJS(url, null, config);

        socket.onopen = function() {
            me.fire("open");
        };
        socket.onclose = function() {
            me.fire("close");
        };

        socket.onmessage = function (message) {

            //console.log("Message: ", message);
            if (message.type == "message") {
                var messageData = message.data,
                    data;
                try {
                    data = JSON.parse(messageData);
                    me.fire("message", data.payload);
                }
                catch (e) {
                    console.error(e);
                }
            } else {
                //only heart-bit for keeping the connection alive
            }
        };


        /**
         * @private sendObject
         * Will stringify the and send the object according to the EventBus standard
         * */
        var sendObject = function(command, address, data) {
            var obj = JSON.stringify({"command": command, "address": address, "payload": data});
            //console.log("OBJ = ", obj);
            socket.send(obj);
        };

        /**
         * Will send a message to a specific address that is registered on the server
         * */
        this.send = function(address, data) {
            sendObject("send", address, data);
        };

        /**
         * Will broadcast a message to all sockets that belong to an address
         * */

        this.publish = function(address, data) {
            sendObject("publish", address, data);
        };

        /**
         * Will subscribe to a certain address
         * */
        this.subscribe = function(address) {
            sendObject("subscribe", address);
        };

        /**
         * Will unsubscribe from a certain address
         * */
        this.unsubscribe = function(address) {
            sendObject("unsubscribe", address);
        };
    }

    /**
     * Add observable
     * */
    EventBus.prototype = Object.create( {

        handlers: [],

        on   : function ( name, handler ) {
            var me = this;

            if ( !me.handlers[ name ] ) {
                me.handlers[ name ] = [];
            }
            me.handlers[ name ].push(handler);
            return me;
        },

        fire : function ( event ) {
            var me = this;
            if ( me.handlers[ event ] ) {
                var args = Array.prototype.splice.call(arguments, 1);

                if (me.handlers[ event ].length > 0) {
                    me.handlers[ event ].forEach(function ( fn ) {
                        fn.apply(me, args);
                    });
                }
            }
            return me;
        }
    });

    window.EventBus = EventBus;

}());
