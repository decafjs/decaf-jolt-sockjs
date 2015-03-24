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
 * //Connects the socket
 * eventBus.connect();
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
 *
 * //Close connection
 * eventBus.close();
 */
(function () {

    "use strict";

    function EventBus(url, config) {

        if (!SockJS || typeof SockJS !== "function") {
            console.error("SockJS is required to use EventBus. Make sure you have included it in the scripts app loads.");
            return;
        }
        var me = this;


        me.url    = url;
        me.config = config;


        /**
         * @private sendObject
         * Will stringify the and send the object according to the EventBus standard
         * */
        var sendObject = function (command, address, data) {
            var obj = JSON.stringify({"command" : command, "address" : address, "payload" : data});

            if (me.socket && me.isConnectionOpen) {
                me.socket.send(obj);
            } else {
                me.connect(null, function() {
                    me.socket.send(obj);
                });
            }

        };

        me.connect = function(refresh, callback) {
            if (me.isConnectionOpen && refresh) {
                me.close();
            }
            var config = me.config,
                socket = me.socket = new SockJS(url, null, config);

            socket.onopen = function () {
                me.isConnectionOpen = true;
                me.fire("open");
                setTimeout(function() {
                    callback && callback.call(me);
                }, 800);
            };
            socket.onclose = function () {
                me.isConnectionOpen = false;
                me.fire("close");
            };

            socket.onmessage = function (message) {

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
                    //only heart-bit for keeping the connection alive maybe
                }
            };
        };


        /**
         * Will send a message to a specific address that is registered on the server
         * */
        me.send = function (address, data) {
            sendObject("send", address, data);
        };

        /**
         * Will broadcast a message to all sockets that belong to an address
         * */

        me.publish = function (address, data) {
            sendObject("publish", address, data);
        };

        /**
         * Will subscribe to a certain address
         * */
        me.subscribe = function (address) {
            sendObject("subscribe", address);
        };

        /**
         * Will unsubscribe from a certain address
         * */
        me.unsubscribe = function (address) {
            sendObject("unsubscribe", address);
        };

        /**
         * Will unsubscribe from a certain address
         * */

        me.close = function () {
            if (me.isConnectionOpen) {
                try {
                    me.isConnectionOpen = false;
                    me.socket.close();
                } catch (e) {
                    console.exception("Could not close socket connection: " + e.toString());
                    me.isConnectionOpen = true;
                }
            }

        }
    }

    /**
     * Add observable
     * */
    EventBus.prototype = Object.create({

        handlers : [],

        on : function (name, handler, scope) {
            var me = this,
                handle = {
                    handler: handler,
                    scope: scope || me
                };

            if (!me.handlers[name]) {
                me.handlers[name] = [];
            }
            me.handlers[name].push(handle);
            return me;
        },

        fire : function (event) {
            var me = this;
            if (me.handlers[event]) {
                var args = Array.prototype.splice.call(arguments, 1);

                if (me.handlers[event].length > 0) {
                    me.handlers[event].forEach(function (item) {
                        item.handler.apply(item.scope, args);
                    });
                }
            }
            return me;
        }
    });

    window.EventBus = EventBus;

}());
