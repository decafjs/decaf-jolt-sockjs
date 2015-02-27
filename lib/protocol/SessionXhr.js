/**
 * Created by mschwartz on 2/27/15.
 */

//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\

/*global require, module */

var Thread = require('Threads').Thread;

module.exports = function (Session) {
    function SessionXhr(req, res) {
        var me = this;
        me.messages = [];
        me.resume(req, res);
    }

    decaf.extend(SessionXhr.prototype, {
        resume    : function (req, res) {
            if (Session.DEBUGME) console.log('resume');
            var me = this;
            me.req = req;
            me.res = res;
            me.pending = true;
            me.timer = Session.POLL_TIME;
        },
        open      : function () {
            this.res.write('o\n');
        },
        send      : function (s) {
            if (Session.DEBUGME) console.log('write');
            var me = this,
                queue = sync(function (s) {
                    me.messages.push(Session.quote(s));
                }, me);
            queue(s);
            me.timer = 0;
        },
        run       : function () {
            var me = this;
            while (me.pending) {
                Thread.sleep(1);
            }
        },
        touch     : function () {
            var me = this;

            me.timer = Session.POLL_TIME;
        },
        tick      : function () {
            var me = this;

            if (Session.DEBUGME) console.log('xhr tick');
            if (--me.timer < 0) {
                if (me.pending) {
                    if (Session.DEBUGME) console.log('xhr tick pending, timeout');
                    me.flush();
                    me.timer = Session.DISCONNECT_TIME;
                    if (Session.DEBUGME) console.log('xhr tick pending: ' + me.pending);
                }
                else {
                    // closed (client no longer sending /xhr request
                    me.session_status = Session.CLOSED;
                    me.onclose();
                    me.fire('close');
                    if (Session.DEBUGME) console.log('XHR closed');
                    return false;       // remove Session
                }
            }
        },
        heartbeat : function () {
            var me = this;

            if (me.pending) {
                me.res.write('h\n');
                me.pending = false;
            }
        },
        flush     : function () {
            var me = this,
                res = me.res,
                dequeue = sync(function () {
                    var messages = me.messages,
                        response = 'a' + '[' + messages.join(',') + ']\n';

                    me.messages = [];
                    if (me.session_status === Session.OPEN) {
                        if (messages.length) {
                            if (Session.DEBUGME) console.log('dequeue ' + response);
                        }
                        try {
                            res.write(response);
                        }
                        catch (e) {
                            // EOF
                            if (Session.DEBUGME) console.exception(e);
                            me.pending = false;
                            me.session_status = Session.CLOSED;
                            me.onclose();
                            me.fire('close');
                        }
                    }
                }, me);
            if (me.pending) {
                dequeue();
                me.pending = false;
            }
        },
        close     : function (status, reason) {
            status = status || 1000;
            reason = reason || 'Normal closure';
            if (this.session_status === Session.OPEN) {
                this.flush();
                this.res.send('c' + JSON.stringify([status, reason]) + '\n');
                this.session_status = Session.CLOSED;
                this.pending = false;
                this.fire('close');
            }
        }
    });
    decaf.extend(SessionXhr.prototype, decaf.observable);

    return SessionXhr;
};
