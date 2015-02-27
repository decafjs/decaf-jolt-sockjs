/**
 * Created by mschwartz on 2/27/15.
 */

//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\

/*global require, module */

var Thread = require('Threads').Thread;

module.exports = function(Session) {

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

        },
        close     : function (status, reason) {

        }
    });
    decaf.extend(SessionEventSource.prototype, decaf.observable);

    return SessionEventSource;
};
