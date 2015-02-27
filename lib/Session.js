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

/*global module, require */

var Thread = require('Threads').Thread;


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
    /** @const */ DEBUGME          : true,
    /** @const */ BYTES_PER_STREAM : 4096,
    // session_status values
    /** @const */ CONNECTING       : 0,
    /** @const */ OPEN             : 1,
    /** @const */ CLOSING          : 2,
    /** @const */ CLOSED           : 3,
    // timer values
    /** @const */ DISCONNECT_TIME  : 5,
    /** @const */ POLL_TIME        : 5,
    /** @const */ HEARTBEAT_TIME   : 25,

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
    },
    quote   : function (s) {
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
};

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
                if (session.session_status === Session.CLOSED) {
                    toRemove.push(session.session_id);
                }
                else {
                    session.tick();
                }
            });
            if (toRemove.length) {
                decaf.each(toRemove, function (session_id) {
                    if (Session.DEBUGME) console.log('remove ' + session_id)
                    delete sessions[session_id];
                });
            }
        }
    }
}).start();

module.exports = Session;

decaf.extend(Session, {
    SessionXhr: (require('protocol/SessionXhr'))(Session),
    SessionXhrStreaming: (require('protocol/SessionXhrStreaming'))(Session),
    SessionEventSource: (require('protocol/SessionEventSource'))(Session),
    SessionWebSocket: (require('protocol/SessionWebSocket'))(Session)
});

