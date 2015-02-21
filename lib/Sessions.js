/**
 * Created by mschwartz on 2/13/15.
 */

/**********************************************************************************************************************
 **********************************************************************************************************************
 **********************************************************************************************************************
 ***
 *** Session logic
 ***
 **********************************************************************************************************************
 **********************************************************************************************************************
 **********************************************************************************************************************/

/*global exports, require */

var Thread = require('Threads').Thread;

const DEBUGME = false;
const BYTES_PER_STREAM = 4096;


function unroll_lookup() {
    var escapable = /[\x00-\x1f\ud800-\udfff\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufff0-\uffff]/g,
        unrolled = {},
        i, c = [];

    for (i = 0; i < 65536; i++) {
        c.push(String.fromCharCode[i]);
    }
    escapable.lastIndex = 0;
    c.join('').replace(escapable, function (a) {
        return unrolled[a] = '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
    });
    return unrolled;
}
var lookup = unroll_lookup();

function quote(s) {
    var escapable = /[\x00-\x1f\ud800-\udfff\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufff0-\uffff]/g,
        quoted = JSON.stringify(s);

    escapable.lastIndex = 0;
    if (!escapable.test(quoted)) {
        return quoted;
    }
    else {
        return quoted.replace(escapable, function (a) {
            return lookup[a]
        });
    }
}

var sessions = {};

var Session = {
    CONNECTING      : 0,
    OPEN            : 1,
    CLOSING         : 2,
    CLOSED          : 3,
    // timer values
    DISCONNECT_TIME : 5,
    POLL_TIME       : 5,
    HEARTBEAT_TIME  : 25, // 25,

    /**
     * add a session of any type
     *
     * @param id uuid of session
     * @param session instance of session
     * @returns session so add() can be chained.
     */
    add     : function (id, session) {
        decaf.extend(session, {
            session_id     : id,
            session_status : Session.OPEN,
            onmessage      : function () {},
            onclose        : function () {}
        });
        sessions[id] = session;
        session.open();
        return session;
    },
    getById : function (id) {
        return sessions[id];
    }
};

//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\

function SessionEventSource(req, res) {
    this.req = req;
    this.res = res;
    this.written = 0;
    this.timeout = Session.DISCONNECT_TIME;
}
decaf.extend(SessionEventSource.prototype, {
    open      : function () {
        this.res.write('data: o\r\n\r\n');
    },
    send      : function (s) {
        var me = this,
            out = 'data: a' + s + '\r\n\r\n';

        if (me.session_status === Session.OPEN) {
            me.written += out.length;
            me.res.write(out);
        }
    },
    run       : function () {
        while (this.written < BYTES_PER_STREAM) {
            Thread.sleep(1);
        }
    },
    touch     : function () {

    },
    tick      : function () {

    },
    heartbeat : function () {

    },
    flush     : function (res) {

    }
});
decaf.extend(SessionEventSource.prototype, decaf.observable);

//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\

function SessionXhr(req, res) {
    var me = this;
    me.messages = [];
    me.resume(req, res);
}
decaf.extend(SessionXhr.prototype, {
    resume    : function (req, res) {
        if (DEBUGME) console.log('resume');
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
        if (DEBUGME) console.log('write');
        var me = this,
            queue = sync(function (s) {
                me.messages.push(quote(s));
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

        if (DEBUGME) console.log('xhr tick');
        if (--me.timer < 0) {
            if (me.pending) {
                if (DEBUGME) console.log('xhr tick pending, timeout');
                me.flush();
                me.timer = Session.DISCONNECT_TIME;
                if (DEBUGME) console.log('xhr tick pending: ' + me.pending);
            }
            else {
                // closed (client no longer sending /xhr request
                me.session_status = Session.CLOSED;
                me.onclose();
                me.fire('close');
                if (DEBUGME) console.log('XHR closed');
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
                        if (DEBUGME) console.log('dequeue ' + response);
                    }
                    try {
                        res.write(response);
                    }
                    catch (e) {
                        // EOF
                        if (DEBUGME) console.dir(e);
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
    }
});
decaf.extend(SessionXhr.prototype, decaf.observable);

//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\

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
        if (DEBUGME) console.log('streaming resume');
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
                me.res.write('a' + '[' + quote(s) + ']\n');
                me.written += s.length;
            }
            catch (e) {
                // EOF
                if (DEBUGME) console.dir(e);
                me.pending = false;
                me.session_status = Session.CLOSED;
                me.onclose();
                me.fire('close');
            }
        }
        else {
            if (DEBUGME) console.log('queue ' + s);
            me.queue(quote(s));
        }
    },
    run       : function () {
        var me = this;

        while (me.pending && me.session_status === Session.OPEN && me.written < BYTES_PER_STREAM) {
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

        if (DEBUGME) console.log('xhr-stream tick');
        if (--me.timer < 0) {
            if (!me.pending) {
                // closed (client no longer sending /xhr request
                if (DEBUGME) console.log('XHR-STREAM closed');
                me.onclose();
                me.fire('close');
                return false;       // remove Session
            }
        }
    },
    heartbeat : function () {
        if (DEBUGME) console.log('streaming heartbeat');
        var me = this;
        if (me.pending) {
            try {
                me.res.write('h\n');
                me.res.flush();
            }
            catch (e) {
                if (DEBUGME) console.dir(e);
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
    }
});
decaf.extend(SessionXhrStreaming.prototype, decaf.observable);

//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\

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

        }
    });
}
decaf.extend(SessionWebSocket.prototype, {
    send      : function (s) {
        try {
            this.ws.send('a' + '[' + quote(s) + ']\n');
        }
        catch (e) {
            console.dir(e);
        }
    },
    open      : function () {
        this.ws.send('o');
    },
    tick      : function () {

    },
    heartbeat : function () {
        if (DEBUGME) console.log('WebSocket heartbeat');
        this.ws.send('h');
    }
});
decaf.extend(SessionWebSocket.prototype, decaf.observable);

//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\

// monitor sessions
new Thread(function () {
    var timer = Session.HEARTBEAT_TIME;
    while (true) {
        Thread.sleep(1);
        if (--timer <= 0) {
            timer = Session.HEARTBEAT_TIME;
            decaf.each(sessions, function (session) {
                session.heartbeat();
            });
        }
        else {
            var toRemove = [];
            decaf.each(sessions, function (session) {
                if (session.session_status !== Session.OPEN) {
                    toRemove.push(session.session_id);
                }
                else {
                    session.tick();
                }
            });
            if (toRemove.length) {
                decaf.each(toRemove, function (session_id) {
                    if (DEBUGME) console.log('remove ' + session_id)
                    delete sessions[session_id];
                });
            }
        }
    }
}).start();

decaf.extend(exports, {
    Session             : Session,
    SessionWebSocket    : SessionWebSocket,
    SessionEventSource  : SessionEventSource,
    SessionXhr          : SessionXhr,
    SessionXhrStreaming : SessionXhrStreaming
});
