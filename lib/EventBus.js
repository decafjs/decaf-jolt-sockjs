/**
 * # EventBus
 *
 * See vert.x documentation here:
 * - http://vertx.io/core_manual_js.html
 *
 * ## Use:
 *
 * ```javascript
 * var SockJs = require('decaf-jolt-sockjs').SockJS,
 *     EventBus = require('decaf-jolt-sockjs').EventBus,
 *     Application = require('decaf-jolt'),
 *     app = new Application(),
 *     sockjs = new SockJS(app, 'endpoint'),
 *     eventBus = new EventBus(sockjs);
 *
 * function handlerFn(message) {
 *     console.dir(message)'
 * }
 * eventBus.registerHandler('test.address', handlerFn, function() {
 *     console.log('registered handlerFn for test.address');
 * });
 * eventBus.publish('test.address', { message: 'hello, world' }); // can be any arbitrary object sent to any address
 *
 * ```
 */
/*!
 * Created by mschwartz on 3/10/15.
 */

/*global require, exports, module */

function EventBus(sockjs) {
    var me = this;

    sockjs.on('open', function (sock) {
        me.fire('open', sock);
        sock.on('close', function () {
            me.fire('close', sock);
            me.removeSubscription(sock);
        });
        sock.on('message', function (message) {
            try {
                message = JSON.parse(message);
            }
            catch (e) {
                console.exception(e);
            }
            switch (message.command) {
                case 'subscribe':
                    me.addSubscription(sock, message.address);
                    break;
                case 'unsubscribe':
                    me.removeSubscription(sock, message.address);
                    break;
                case 'publish':
                    me.fire('message', message);
                    me.onPublish(message);
                    break;
                case 'send':
                    me.fire('message', message);
                    me.onSend(message);
                    break;
                default:
                    console.log('EventBus - Invalid message:');
                    console.dir(message);
                    break;
            }
        });
    });

    /** @private */
    me.subscriptions = {}; // client sockets

    decaf.extend(me, {
        /**
         * @private
         */
        addSubscription    : sync(function (sock, address) {
            var me = this,
                duplicate = false;
            me.subscriptions[address] = me.subscriptions[address] || [];
            decaf.each(me.subscriptions[address], function (s) {
                if (s === sock) {
                    duplicate = true;
                }
            });
            if (!duplicate) {
                me.subscriptions[address].push(sock);
            }
        }, me.subscriptions),
        /**
         * @private
         */
        removeSubscription : sync(function (sock, address) {
            var me = this,
                newSubscriptions;

            if (address) {
                me.subscriptions[address] = me.subscriptions[address] || [];
                newSubscriptions = [];
                decaf.each(me.subscriptions[address], function (s) {
                    if (s !== sock) {
                        newSubscriptions.push(s);
                    }
                });
                me.subscriptions[address] = newSubscriptions;
            }
            else {
                decaf.each(me.subscriptions, function (listeners, address) {
                    newSubscriptions = [];
                    decaf.each(listeners, function (s) {
                        if (s !== sock) {
                            newSubscriptions.push(s);
                        }
                    });
                    me.subscriptions[address] = newSubscriptions;
                });
            }
        }, me.subscriptions),
        // broadcast
        /**
         * ## eventBus.publish(address, message)
         *
         * Broadcast a message to a specified address
         */
        publish            : sync(function (address, message) {
            var me = this;

            me.subscriptions[address] = me.subscriptions[address] || [];
            new Thread(function () {
                sync(function() {
                    decaf.each(me.subscriptions[address], function (sock) {
                        try {
                            sock.send(JSON.stringify({command : 'publish', address : address, payload : message}));
                        }
                        catch (e) {
                            console.exception(e);
                        }
                    });
                }, me.subscriptions)();
            }).start();
        }, me.subscriptions),
        /**
         * ## eventBus.send(address, message)
         *
         * Send a message to a specified address.
         *
         * This results in at most one handler registered at the address receiving the message.  The handler is chosen in a non strict round-robin fashion.
         */
        send               : sync(function (address, message) {
            var me = this,
                sock;

            me.subscriptions[address] = me.subscriptions[address] || [];

            sock = me.subscriptions[address].shift();
            if (sock) {
                me.subscriptions[address].push(sock);
                try {
                    sock.send(JSON.stringify({command : 'send', address : address, payload : message}));
                }
                catch (e) {
                    console.exception(e);
                }
            }
        }, me.subscriptions)
    });

    /** @private */
    me.handlers = {}; // server-side handlers
    decaf.extend(me, {
        /**
         * ## eventBus.registerHandler(address, handlerFn, callbackFn)
         *
         * Register a message handler on the specified address.
         *
         * Since the registration process may involve communication with other servers in a cluster, the optional callbackFn will be called once registration is truly completed.
         *
         * @param address
         * @param handlerFn
         * @param callbackFn
         */
        registerHandler   : function (address, handlerFn, callbackFn) {
            var me = this,
                duplicate = false;

            sync(function() {
                me.handlers[address] = me.handlers[address] || [];
                decaf.each(me.handlers[address], function (fn) {
                    if (fn === handlerFn) {
                        duplicate = true;
                    }
                });
                if (!duplicate) {
                    me.handlers[address].push(handlerFn);
                }
            }, me.handlers)();
            if (callbackFn) {
                callbackFn();
            }
        },
        /**
         * ## eventBus.unregisterHandler(address, handlerFn, callbackFn)
         *
         * Unregister a message handler on the specified address.
         *
         * Since the deregistration process may involve communication with other servers in a cluster, the optional callbackFn will be called once registration is truly completed.
         *
         * @param address
         * @param handlerFn
         * @param callbackFn
         */
        unregisterHandler : function (address, handlerFn, callbackFn) {
            var me = this,
                newHandlers = [];

            sync(function() {
                me.handlers[address] = me.handlers[address] || [];
                decaf.each(me.handlers[address], function(fn) {
                    if (fn !== handlerFn) {
                        newHandlers.push(fn);
                    }
                });
                me.handlers[address] = newHandlers;
            }, me.handlers)();
            callbackFn();
        },
        /**
         * @private
         * @param message
         */
        onPublish: function(message) {
            var me = this;

            sync(function() {
                me.handlers[address] = me.handlers[address] || [];
            }, me.handlers)();
            // needs to by synchronized in case me.handlers[address] might be changed by another thread
            sync(function() {
                decaf.each(me.handlers[address], function(handlerFn) {
                    handlerFn(message.payload);
                });
            }, me.handlers[address])();
        },
        /**
         * @private
         * @param message
         */
        onSend: function(message) {
            var me = this,
                handlerFn;

            sync(function() {
                me.handlers[address] = me.handlers[address] || [];
                handlerFn = me.handlers[address].shift();
                if (handlerFn) {
                    me.handlers[address].push(handlerFn);
                }
            }, me.handlers);
            if (handlerFn) {
                handlerFn(message.payload);
            }
        }
    });
}
decaf.extend(EventBus.prototype, decaf.observable);


module.exports = EventBus;
