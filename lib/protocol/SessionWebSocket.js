/**
 * Created by mschwartz on 2/27/15.
 */

//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\

/*global require, module */

var Thread = require('Threads').Thread;

module.exports = function (Session) {

    function SessionWebSocket(ws) {
        var me = this;

        me.ws = ws;
        ws.on('close', function () {
            me.session_status = Session.CLOSED;
            me.onclose();
            me.fire('close');
        });
        ws.on('message', function (messages) {
            try {
                messages = JSON.parse(messages);
                decaf.each(messages, function (message) {
                    me.onmessage(message);
                    me.fire('message', message);
                });
            }
            catch (e) {
                console.exception(e);
            }
        });
    }

    decaf.extend(SessionWebSocket.prototype, {
        send      : function (s) {
            try {
                this.ws.send('a' + '[' + Session.quote(s) + ']\n');
            }
            catch (e) {
                console.exception(e);
            }
        },
        open      : function () {
            this.ws.send('o');
        },
        tick      : function () {
            if (this.session_status === Session.CLOSING) {
                this.timer--;
                if (this.timer <= 0) {
                    this.ws.close();
                    this.session_status = Session.CLOSED;
                }
            }
        },
        heartbeat : function () {
            if (Session.DEBUGME) console.log('WebSocket heartbeat');
            this.ws.send('h');
        },
        close     : function (status, reason) {
            status = status || 1000;
            reason = reason || 'Normal closure';
            this.ws.send('c' + JSON.stringify([status, reason]) + '\n');
            this.session_status = Session.CLOSING;
            this.timer = 2;
            //this.ws.close();
            //this.session_status = Session.CLOSED;
        }
    });
    decaf.extend(SessionWebSocket.prototype, decaf.observable);

    return SessionWebSocket;
};
