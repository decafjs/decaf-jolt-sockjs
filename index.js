/**
 * Created by mschwartz on 1/18/15.
 */

/*global require, exports */

//exports.Session = require('lib/Session');
var Session = require('lib/Session');

//console.log('x');
//console.dir(Session);
//console.log('y');

decaf.extend(exports, {
    SockJS  : require('lib/jolt-sockjs').SockJS,
    Session : require('lib/Session')
});
