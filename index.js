'use strict';

var plugin = require('trooba-plugin');

module.exports = plugin({
    decorate: decorate
}, {
    troobaVersion: '^3'
});

function decorate(pipe) {
    pipe.decorate('request', function (original) {
        return function (request, callback) {
            if (this.context.$requestSession && this.context.$requestSession.closed !== true) {
                throw new Error('Request has already been initiated');
            }
            var session = this.context.$requestSession = {};

            this.resume();

            this.send({
                type: 'request',
                data: request,
                session: session
            });

            if (callback) {
                this.once('error', function (err) {
                    callback(err);
                })
                .once('response', function (response) {
                    callback(null, response);
                });
            }
            return createStream(this, pipe.Direction.REQUEST, session);
        };
    });

    pipe.decorate('continue', function () {
        return function (data) {
            if (data) {
                this.current.data = data;
            }
            this.current.next();
        };
    });

    pipe.decorate('retry', function () {
        return function (request) {
            shutdownSession(this);
            this.request(request);
        };
    });

    pipe.decorate('respond', function (original) {
        return function (response) {
            if (this.context.$responseSession && this.context.$responseSession.closed !== true) {
                throw new Error('Response has already been initiated');
            }
            var session = this.context.$responseSession = {};

            this.resume();
            this.send({
                type: 'response',
                data: response,
                session: session,
                direction: pipe.Direction.RESPONSE
            });
            return createStream(this, pipe.Direction.RESPONSE, session);
        };
    });

    pipe.decorate('throw', function (original) {
        return function (err) {
            shutdownSession(this);
            this.resume();
            this.send('error', err, pipe.Direction.RESPONSE);
        };
    }, true);

}

function shutdownSession(pipe) {
    if (pipe.context.$responseSession) {
        pipe.context.$responseSession.closed = true;
    }
    if (pipe.context.$requestSession) {
        pipe.context.$requestSession.closed = true;
    }
}

function createStream(pipe, direction, session) {
    var closed;

    return {
        point: pipe,
        
        direction: direction,

        on: function () {
            pipe.on.apply(pipe, arguments);
            return this;
        },

        once: function () {
            pipe.once.apply(pipe, arguments);
            return this;
        },

        write: function (data) {
            if (session && session.closed) {
                // in case stream close somewhere else and
                // should be ignored
                return;
            }
            if (closed) {
                throw new Error('The stream has been closed already');
            }
            var type = direction === pipe.Direction.REQUEST ?
                'request:data' : 'response:data';

            pipe.send({
                type: type,
                data: data,
                direction: direction,
                session: session
            });

            if (data === undefined) {
                closed = true;
            }

            return this;
        },

        end: function (data) {
            data && this.write(data);
            // mark end of stream
            this.write(undefined);
            return this;
        }
    };
}
