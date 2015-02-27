/**
 * Created by mschwartz on 2/27/15.
 */

//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\

/*global require, module */

var Thread = require('Threads').Thread;

module.exports = function (Session) {

    function SessionXhrStreaming(req, res) {
        var me = this;

        me.messages = [];
        me.queue = sync(function (msg) {
            me.messages.push(msg);
        }, me);
        me.dequeue = sync(function () {
            if (me.pending && me.messages.length) {
                if (me.messages.length) {
                    me.res.write('a' + '[' + me.messages.join(',') + ']' + '\n');
                    me.messages = [];
                }
            }
        }, me);
        me.resume(req, res);
    }

    decaf.extend(SessionXhrStreaming.prototype, {
        resume    : function (req, res) {
            if (Session.DEBUGME) console.log('streaming resume');
            var me = this;
            me.req = req;
            me.res = res;
            me.written = 0;
            me.pending = true;
            me.timer = Session.POLL_TIME;
            me.dequeue();
        },
        open      : function () {
            this.res.write('o\n');
        },
        send      : function (s) {
            var me = this;

            if (me.session_status !== Session.OPEN) {
                me.onclose();
                me.fire('close');
                return;
            }
            if (me.pending) {
                try {
                    me.res.write('a' + '[' + Session.quote(s) + ']\n');
                    me.written += s.length;
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
            else {
                if (Session.DEBUGME) console.log('queue ' + s);
                me.queue(Session.quote(s));
            }
        },
        run       : function () {
            var me = this;

            while (me.pending && me.session_status === Session.OPEN && me.written < Session.BYTES_PER_STREAM) {
                Thread.sleep(1);
            }
            // connection has either closed or we're closing just this one XHR request to expect another to replace it soon
            me.pending = false;
            me.timer = Session.DISCONNECT_TIME;
        },
        touch     : function () {

        },
        tick      : function () {
            var me = this;

            if (Session.DEBUGME) console.log('xhr-stream tick');
            if (--me.timer < 0) {
                if (!me.pending || me.session_status === Session.CLOSING) {
                    // closed (client no longer sending /xhr request
                    if (Session.DEBUGME) console.log('XHR-STREAM closed');
                    me.onclose();
                    me.fire('close');
                    me.session_status = Session.CLOSED;
                    return false;       // remove Session
                }
            }
        },
        heartbeat : function () {
            if (Session.DEBUGME) console.log('streaming heartbeat');
            var me = this;
            if (me.pending && me.session_status === Session.OPEN) {
                try {
                    me.res.write('h\n');
                    me.res.flush();
                }
                catch (e) {
                    if (Session.DEBUGME) console.exception(e);
                    me.pending = false;
                    me.session_status = Session.CLOSED;
                }
            }
        },
        flush     : function () {
            if (this.messages.length) {
                this.dequeue();
                this.written = 8192;
            }
        },
        close     : function (status, reason) {
            status = status || 1000;
            reason = reason || 'Normal closure';
            if (this.session_status === Session.OPEN) {
                this.res.write('c' + JSON.stringify([reason, status]) + '\n');
                this.session_status = Session.CLOSING;
                this.timer = 0;
                //this.fire('close');
            }
        }
    });
    decaf.extend(SessionXhrStreaming.prototype, decaf.observable);

    return SessionXhrStreaming;
};
