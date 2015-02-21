/**
 * Created by mschwartz on 1/18/15.
 */

/*global require, exports */
var {Session, SessionWebSocket, SessionEventSource, SessionXhr, SessionXhrStreaming} = require('Sessions');
var uuid = require('support').uuid;

function random32() {
    var v = [Math.random() % 256, Math.random() % 256, Math.random() % 256, Math.random() % 256];
    return v[0] + (v[1] * 256) + (v[2] * 256 * 256) + (v[3] * 256 * 256 * 256);
}


function SockJS(app, endpoint, options) {
    var me = this;

    options = options || {};
    app.verb(endpoint, function (req, res) {
        var uuid,
            session;

        //console.dir({
        //    what   : endpoint,
        //    args   : req.args,
        //    length : req.args.length,
        //    data   : req.data
        //});
        if (!req.args.length) {
            console.log('GREETING');
            res.writeHead(200, {'Content-Type' : 'text/plain; charset=UTF-8'});
            res.end('Welcome to SockJS!\n');
        }
        else if (req.args[0] === 'info') {
            res.writeHead(200, {'Content-type' : 'application/json; charset=UTF-8'});
            res.end(JSON.stringify(decaf.extend(options, {
                websocket     : true,
                origins       : ['*:*'],
                cookie_needed : false,
                entropy       : random32()
            })));
        }
        else if (req.args[0].match(/\d\d\d/)) {
            uuid = req.args[1];
            session = Session.getById(uuid);

            switch (req.args[2]) {
                case 'eventsource':
                    console.log('EVENTSOURCE');
                    res.writeHead(200, {
                        'Content-Type'  : 'text/event-stream; charset=UTF-8',
                        'Cache-Control' : 'no-store, no-cache, must-revalidate, max-age=0'
                    });
                    res.write('\r\n');
                    if (session) {
                        console.log('**** ERROR Session ' + uuid + ' exists!');
                    }
                    else {
                        session = Session.add(uuid,new SessionEventSource(req, res));
                        me.fire('open', session);
                        session.run();
                        return false;
                    }
                    break;
                case 'xhr_send':
                    console.log('XHR_SEND ' + uuid);
                    if (!session) {
                        throw new Error('xhr_send: no session for ' + uuid);
                    }
                    session.touch();
                    try {
                        var messages = JSON.parse(req.data.post);
                        if (!decaf.isArray(messages)) {
                            messages = [ messages ];
                        }
                        decaf.each(messages, function (message) {
                            session.fire('message', message);
                        });
                    }
                    catch (e) {
                        console.dir(e);
                    }
                    res.writeHead(204, {
                        'Content-Type' : 'text/plain: charset=UTF-8'
                    });
                    res.end();
                    //session.write(req.data.post);
                    break;
                case 'xhr':
                    if (!session) {
                        session = Session.add(uuid, new SessionXhr(req, res));
                        me.fire('open', session);
                    }
                    else {
                        session.resume(req, res);
                        session.run();
                    }
                    break;
                case 'xhr_streaming':
                    if (!session) {
                        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
                        res.write(new Array(2049).join('h') + '\n');
                        session = Session.add(uuid, new SessionXhrStreaming(req, res));
                        me.fire('open', session);
                    }
                    else {
                        session.resume(req, res);
                    }
                    session.run();
                    break;
            }
        }
        else {
            console.log('404');
            return 404;
        }
    });
    app.webSocket(endpoint, function (ws) {
        var session = new SessionWebSocket(ws);
        Session.add(uuid(), session);
        me.fire('open', session);
    });
}
decaf.extend(SockJS.prototype, decaf.observable);

decaf.extend(exports, {
    SockJS : SockJS
});
