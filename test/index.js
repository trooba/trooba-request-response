'use strict';

var Assert = require('assert');
var Trooba = require('trooba');

describe(__filename, function () {

    it('should do request', function (next) {
        Trooba
        .use(require('..'))
        .use(function (pipe) {
            pipe.on('request', function (request) {
                Assert.equal('ping', request);
                next();
            });
        })
        .build()
        .create()
        .request('ping');
    });

    it('should continue request', function (next) {
        Trooba
        .use(require('..'))
        .use(function (pipe) {
            pipe.on('request', function (request) {
                Assert.equal('ping', request);
                pipe.continue('ping...');
            });
        })
        .use(function (pipe) {
            pipe.on('request', function (request) {
                Assert.equal('ping...', request);
                next();
            });
        })
        .build()
        .create()
        .request('ping');
    });

    it('should continue response', function (next) {
        Trooba
        .use(require('..'))
        .use(function (pipe) {
            pipe.on('response', function (response) {
                Assert.equal('pong', response);
                pipe.continue('pong!');
            });
        })
        .use(function (pipe) {
            pipe.on('request', function (request) {
                Assert.equal('ping', request);
                pipe.respond('pong');
            });
        })
        .build()
        .create()
        .request('ping')
        .once('error', next)
        .on('response', function (response) {
            Assert.equal('pong!', response);
            next();
        });
    });

    it('should do request/response', function (next) {
        Trooba
        .use(require('..'))
        .use(function (pipe) {
            pipe.on('request', function (request) {
                Assert.equal('ping', request);
                pipe.respond('pong');
            });
        })
        .build()
        .create()
        .request('ping', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('pong', response);
            next();
        });
    });

    it('should handle response error', function (next) {
        Trooba
        .use(require('..'))
        .use(function (pipe) {
            pipe.on('request', function (request) {
                Assert.equal('ping', request);
                pipe.throw(new Error('Boom'));
            });
        })
        .build()
        .create()
        .request('ping', function (err, response) {
            Assert.ok(err);
            Assert.equal('Boom', err.message);
            next();
        });
    });

    it('should do request/response with retry', function (next) {
        var reqCounter = 0;
        var resCounter = 0;

        Trooba
        .use(require('..'))
        .use(function (pipe) {
            var retry = true;
            var _request;
            pipe.on('request', function (request, next) {
                _request = request;
                next();
            });
            pipe.on('response', function (response, next) {
                resCounter++;
                Assert.equal('ping', _request);
                Assert.equal('pong', response);
                if (retry) {
                    retry = false;
                    pipe.retry(_request);
                    return;
                }
                next();
            });
        })
        .use(function (pipe) {
            pipe.on('request', function (request) {
                Assert.equal('ping', request);
                reqCounter++;
                pipe.respond('pong');
            });
        })
        .build()
        .create()
        .request('ping', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('pong', response);
            Assert.equal(2, reqCounter);
            Assert.equal(2, resCounter);
            next();
        });
    });

    it('should do request/response and error during retry', function (next) {
        var reqCounter = 0;
        var resCounter = 0;

        Trooba
        .use(require('..'))
        .use(function (pipe) {
            var retry = true;
            var _request;
            pipe.on('request', function (request, next) {
                _request = request;
                next();
            });
            pipe.on('response', function (response, next) {
                resCounter++;
                Assert.equal('ping', _request);
                Assert.equal('pong', response);
                if (retry) {
                    retry = false;
                    pipe.retry(_request);
                    return;
                }
                next();
            });
        })
        .use(function (pipe) {
            pipe.on('request', function (request) {
                Assert.equal('ping', request);
                reqCounter++;
                if (reqCounter === 2) {
                    return pipe.throw(new Error('Boom'));
                }
                pipe.respond('pong');
            });
        })
        .build()
        .create()
        .request('ping', function (err, response) {
            Assert.ok(err);
            Assert.equal(2, reqCounter);
            Assert.equal(1, resCounter);
            next();
        });
    });

    it('should fail with duplicate request call', function (next) {
        var pipe = Trooba
        .use(require('..'))
        .use(function (pipe) {
            pipe.on('request', function (request, next) {
            });
        })
        .build()
        .create();

        pipe.request('ping');
        Assert.throws(function () {
            pipe.request('ping');
        }, /Request has already been initiated/);
        next();
    });

    it('should fail with duplicate respond call', function (next) {
        Trooba
        .use(require('..'))
        .use(function (pipe) {
            pipe.on('request', function (request) {
                pipe.respond('pong');
                Assert.throws(function () {
                    pipe.respond('pong');
                }, /Response has already been initiated/);
                next();
            });
        })
        .build()
        .create()
        .request('ping');
    });

    describe('backwards compatibility', function () {

        it('should send custom message for custom handler', function (done) {
            var order = [];
            Trooba
            .use(require('..'))
            .use(function replace(pipe) {
                pipe.on('custom-handle-message', function (data, next) {
                    pipe.context.data = data;
                    order.push('replace');
                    next();
                });
            })
            .use(function transport(pipe) {
                pipe.on('custom-request', function (data) {
                    order.push('tr');
                    pipe.respond(data+pipe.context.data);
                });
            })
            .build()
            .create()
            .once('response', function (response) {
                Assert.equal('foobar', response);
                Assert.equal(['replace', 'tr'].toString(), order.toString());
                done();
            })
            .send('custom-handle-message', 'bar')
            .send('custom-request', 'foo');
        });

        it('should send sync custom message for custom handler', function (done) {
            var order = [];
            Trooba
            .use(require('..'))
            .use(function replace(pipe) {
                pipe.on('custom-handle-message', function (data, next) {
                    // since we get sync message we do not need to call any next method
                    // one cannot prevent it from propagation down the pipeline

                    Assert.equal('function skip() {}', next.toString());

                    order.push('replace');

                    pipe.context.data = 'foo';
                });
            })
            .use(function shouldNotAffect(pipe) {
                pipe.on('custom-handle-message', function (data, next) {
                    // since we get sync message we do not need to call any next method
                    // one cannot prevent it from propagation down the pipeline
                    Assert.equal('function skip() {}', next.toString());
                    order.push('shouldNotAffect');
                    // symulate delayed context change that should not affect reponse
                    setTimeout(function () {
                        pipe.context.data = 'boom';
                    }, 10);
                });
            })
            .use(function transport(pipe) {
                pipe.on('custom-handle-message', function (data) {
                    order.push('tr');
                    pipe.respond(data+pipe.context.data);
                });
            })
            .build()
            .create()
            .once('response', function (response) {
                Assert.deepEqual(['replace', 'shouldNotAffect', 'tr'], order);
                Assert.equal('barfoo', response);

                done();
            })
            .send({
                type: 'custom-handle-message',
                direction: 1,
                data: 'bar',
                sync: true
            });
        });

        it('should send async custom message for custom handler', function (done) {
            var order = [];
            Trooba
            .use(require('..'))
            .use(function replace(pipe) {
                pipe.on('custom-handle-message', function (data, next) {
                    order.push('replace');
                    // this change will be overwritten by the next handler
                    pipe.context.data = 'foo';
                    next();
                });
            })
            .use(function shouldNotAffect(pipe) {
                pipe.on('custom-handle-message', function (data, next) {
                    order.push('shouldNotAffect');
                    // since we get sync message we do not need to call any next method
                    // one cannot prevent it from propagation down the pipeline

                    // symulate delayed context change that should not affect reponse
                    setTimeout(function () {
                        pipe.context.data = 'boom';
                        next();
                    }, 10);
                });
            })
            .use(function (pipe) {
                pipe.on('custom-handle-message', function (data) {
                    order.push('tr');
                    pipe.respond(data+pipe.context.data);
                });
            })
            .build()
            .create()
            .once('response', function (response) {
                Assert.deepEqual(['replace', 'shouldNotAffect', 'tr'], order);

                Assert.equal('barboom', response);

                done();
            })
            .send({
                type: 'custom-handle-message',
                direction: 1,
                data: 'bar',
                sync: false
            });
        });

        it('should catch only request chunks and provide hook at stream level', function (done) {
            var pipe = Trooba
            .use(require('..'))
            .use(function (pipe) {
                var reqData = [];
                pipe.on('request', function () {
                    pipe.resume();
                });
                pipe.on('request:data', function (data, next) {
                    reqData.push(data);
                    next();
                });
                pipe.once('request:end', function (data) {
                    setImmediate(function () {
                        pipe.respond(reqData);
                    });
                });
            })
            .build()
            .create();

            pipe.request('request')
                .write('foo')
                .write('bar')
                .once('error', done)
                .on('response', function (response) {
                    Assert.deepEqual(['foo', 'bar', undefined], response);
                    done();
                })
                .end();
        });

        it('should catch only response chunks', function (done) {
            var pipe = Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function () {
                    pipe.respond('response')
                        .write('foo')
                        .write('bar')
                        .end();
                });
            })
            .build()
            .create()
            .on('response', function (response, next) {
                Assert.equal('response', response);
                next();
            });

            var reqData = [];
            pipe.request('request').on('response:data', function (data, next) {
                reqData.push(data);
                next();
            });
            pipe.once('response:end', function (data) {
                Assert.deepEqual(['foo', 'bar', undefined], reqData);
                done();
            });

        });

        it('should catch all response messages', function (done) {
            var pipe = Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function () {
                    pipe.respond('response')
                        .write('foo')
                        .write('bar')
                        .end();
                });
            })
            .build()
            .create();

            var reqData = [];
            pipe.request('request')
            .on('*', function (message) {
                reqData.push(message.data);
                message.next();
            })
            .once('response:end', function (data) {
                Assert.deepEqual(['response', 'foo', 'bar', undefined], reqData);
                done();
            });

        });

        it('should catch all messages', function (done) {
            var messages = [];
            var pipe = Trooba
            .use(require('..'))
            .use(function catchhAll(pipe) {
                pipe.on('*', function (message) {
                    messages.push(message.data);
                    message.next();
                });
            })
            .use(function (pipe) {
                pipe.on('request', function () {
                    pipe.respond('response')
                        .write('foo')
                        .write('bar')
                        .end();
                });
            })
            .build()
            .create()
            .request('request');

            pipe.once('response:end', function (data) {
                Assert.deepEqual(['request', 'response', 'foo', 'bar', undefined, undefined], messages);
                done();
            });

        });

        it('should handle error after a few chunks', function (done) {
            var pipe = Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function () {
                    pipe.respond('response')
                        .write('foo')
                        .write('bar');
                    setTimeout(function () {
                        pipe.throw(new Error('Boom'));
                    }, 10);
                });
            })
            .build()
            .create()
            .on('response', function (response, next) {
                Assert.equal('response', response);
                next(); // resume
            });

            var count = 0;
            pipe.request('request').on('response:data', function (data, next) {
                count++;
                next();
            });
            pipe.once('response:end', function (data) {
                done(new Error('Should never happen'));
            });
            pipe.once('error', function (err) {
                Assert.equal('Boom', err.message);
                Assert.equal(2, count);
                done();
            });

        });

        it('should throw errer on the way back', function (done) {
            Trooba
            .use(require('..'))
            .use(function handler(pipe) {
                pipe.on('response', function () {
                    pipe.throw(new Error('Test'));
                });
            })
            .use(function tr(pipe) {
                pipe.on('request', function () {
                    pipe.respond('bad content');
                });
            })
            .build({
                retry: 2
            })
            .create()
            .request({
                order: []
            }, function validateResponse(err, response) {
                Assert.ok(err);
                Assert.equal('Test', err.message);
                done();
            });
        });

        it('should handle empty reply', function (done) {
            Trooba
            .use(require('..'))
            .use(function handler(pipe) {
            })
            .use(function tr(pipe) {
                pipe.on('request', function () {
                    pipe.respond();
                });
            })
            .build({
                retry: 2
            })
            .create()
            .request({
                order: []
            }, function validateResponse(err, response) {
                Assert.ok(!err);
                Assert.ok(!response);
                done();
            });
        });
    });

    describe('streaming', function () {
        it('should provide access to pipe and direction for request stream', function () {
            var stream = Trooba
            .use(require('..'))
            .use(function () {})
            .build()
            .create()
            .request('ping');

            Assert.ok(stream.point);
            Assert.equal(1, stream.direction);
        });

        it('should provide access to pipe and direction for response stream', function (next) {
            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function () {
                    var stream = pipe.respond('pong');
                    Assert.ok(stream.point);
                    Assert.equal(2, stream.direction);
                    next();
                });
            })
            .build()
            .create()
            .request('ping');
        });

        it('should do empty request stream', function (next) {
            var events = [];

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual([], buffer);
                        pipe.respond('pong');
                        return;
                    }
                    buffer.push(data);
                    next();
                });
            })
            .build()
            .create()
            .request('ping', function (err, response) {
                Assert.ok(!err, err && err.stack);
                Assert.equal('pong', response);
                next();
            })
            .end();
        });

        it('should request stream with data in the end', function (next) {
            var events = [];

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual(['foo'], buffer);
                        pipe.respond('pong');
                        return;
                    }
                    buffer.push(data);
                    next();
                });
            })
            .build()
            .create()
            .request('ping', function (err, response) {
                Assert.ok(!err, err && err.stack);
                Assert.equal('pong', response);
                next();
            })
            .end('foo');
        });

        it('should do simple request stream', function (next) {
            var events = [];

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual(['foo', 'bar'], buffer);
                        pipe.respond('pong');
                        return;
                    }
                    buffer.push(data);
                    next();
                });
            })
            .build()
            .create()
            .request('ping', function (err, response) {
                Assert.ok(!err, err && err.stack);
                Assert.equal('pong', response);
                next();
            })
            .write('foo')
            .write('bar')
            .end();
        });

        it('should do complex request stream', function (next) {
            var events = [];

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('request:' + request);
                    next();
                });
                pipe.on('response', function (response, next) {
                    events.push('response:' + response);
                    next();
                });
            })
            .use(function (pipe) {
                pipe.on('request:data', function (data, next) {
                    events.push('request:data:' + data);
                    next();
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual([
                            'request:ping',
                            'request:data:foo',
                            'transport:ping',
                            'request:data:bar',
                            'request:data:undefined'
                        ], events);
                        Assert.deepEqual(['foo', 'bar'], buffer);
                        pipe.respond('pong');
                        return;
                    }
                    buffer.push(data);
                    next();
                });
            })
            .build()
            .create()
            .request('ping', function (err, response) {
                Assert.ok(!err, err && err.stack);
                Assert.equal('pong', response);
                next();
            })
            .write('foo')
            .write('bar')
            .end();
        });

        it('should do empty response stream', function (done) {
            var events = [];
            var buffer = [];
            var _response;

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.respond('pong')
                    .end();
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual([], buffer);
                    Assert.equal('pong', _response);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });
        });

        it('should do response stream with data in the end', function (done) {
            var events = [];
            var buffer = [];
            var _response;

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.respond('pong')
                    .end('foo');
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual(['foo'], buffer);
                    Assert.equal('pong', _response);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });
        });

        it('should do simple response stream', function (done) {
            var events = [];
            var buffer = [];
            var _response;

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.respond('pong')
                    .write('foo')
                    .write('bar')
                    .end();
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual(['foo', 'bar'], buffer);
                    Assert.equal('pong', _response);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });
        });

        it('should do complex response stream', function (done) {
            var events = [];
            var buffer = [];
            var _response;

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('response', function (response, next) {
                    events.push('response:' + response);
                    next();
                });
                pipe.on('response:data', function (data, next) {
                    events.push('response:data:' + data);
                    next();
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.respond('pong')
                    .write('foo')
                    .write('bar')
                    .end();
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual(['foo', 'bar'], buffer);
                    Assert.deepEqual([
                        'transport:ping',
                        'response:pong',
                        'response:data:foo',
                        'response:data:bar',
                        'response:data:undefined'
                    ], events);
                    Assert.equal('pong', _response);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });
        });

        it('should do request and response streams', function (done) {
            var events = [];
            var buffer = [];
            var _response;

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual(['foo', 'bar'], buffer);

                        respond();

                        return;
                    }
                    buffer.push(data);
                    next();
                });

                function respond() {
                    pipe.respond('pong')
                    .write('foo')
                    .write('bar')
                    .end();
                }
            })
            .build()
            .create()
            .request('ping')
            .write('foo')
            .write('bar')
            .end()
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual(['foo', 'bar'], buffer);
                    Assert.equal('pong', _response);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });

        });

        it('should do request stream and preserve order', function (done) {
            var MAX = 100;
            var events = [];
            var expected = [];

            var request = Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    next();
                });
                pipe.on('request:data', function (data, next) {
                    events.push(data);
                    next();
                });
            })
            .use(function (pipe) {
                pipe.on('request:data', function (data, next) {
                    // shuffle
                    setTimeout(next, 10 * Math.random());
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual(expected, buffer);
                        pipe.respond('pong');
                        return;
                    }
                    buffer.push(data);
                    next();
                });
            })
            .build()
            .create()
            .request('ping', function (err, response) {
                Assert.ok(!err, err && err.stack);
                Assert.equal('pong', response);
                done()();
            });

            for (var i = 0; i < MAX; i++) {
                var data = 'data:' + i;
                expected.push(data);
                request.write(data);
            }
            request.end();
        });

        it('should do response stream and preserve order', function (done) {
            var MAX = 10;
            var expected = [];
            var buffer = [];

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    next();
                });
                pipe.on('response:data', function (data, next) {
                    next();
                });
            })
            .use(function (pipe) {
                pipe.on('response:data', function (data, next) {
                    // shuffle
                    setTimeout(next, 10 * Math.random());
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    var stream = pipe.respond('pong');
                    for (var i = 0; i < MAX; i++) {
                        var data = 'data:' + i;
                        expected.push(data);
                        stream.write(data);
                    }
                    stream.end();
                });
            })
            .build()
            .create()
            .request('ping')
            .on('error', done)
            .on('response', function (response, next) {
                Assert.equal('pong', response);
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual(expected, buffer);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });
        });

        it('should do request stream/response stream and preserve order between delayed request/reponse and their chunks', function (done) {
            var events = [];
            var buffer = [];
            var _response;

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (_, next) {
                    setTimeout(next, 50);
                });
                pipe.on('response', function (_, next) {
                    setTimeout(next, 50);
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual(['foo', 'bar', 'etc'], buffer);

                        respond();

                        return;
                    }
                    buffer.push(data);
                    next();
                });

                function respond() {
                    pipe.respond('pong')
                    .write('foo')
                    .write('bar')
                    .write('etc')
                    .end();
                }
            })
            .build()
            .create()
            .request('ping')
            .write('foo')
            .write('bar')
            .write('etc')
            .end()
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual(['foo', 'bar', 'etc'], buffer);
                    Assert.equal('pong', _response);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });

        });

        it('should do request stream/response stream and preserve order', function (done) {
            var MAX = 50;
            var expectedRequestChunks = [];
            var expectedResponseChunks = [];
            var actualRequestChunks = [];
            var actualResponseChunks = [];

            var request = Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    next();
                });
                pipe.on('response:data', function (data, next) {
                    next();
                });
            })
            .use(function (pipe) {
                pipe.on('response:data', function (_, next) {
                    // shuffle
                    setTimeout(next, 10 * Math.random());
                });
                pipe.on('request:data', function (_, next) {
                    // shuffle
                    setTimeout(next, 10 * Math.random());
                });
                pipe.on('request', function (_, next) {
                    setTimeout(next, 10);
                });
                pipe.on('response', function (_, next) {
                    setTimeout(next, 20);
                });
            })
            .use(function (pipe) {
                var stream;
                pipe.on('request', function (request, next) {
                    stream = pipe.respond('pong');
                    for (var i = 0; i < MAX; i++) {
                        var data = 'data:' + i;
                        expectedResponseChunks.push(data);
                        stream.write(data);
                    }
                });
                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        stream.end();
                        return;
                    }
                    actualRequestChunks.push(data);
                    next();
                });
            })
            .build()
            .create()
            .request('ping');

            request.on('error', done)
            .on('response', function (response, next) {
                Assert.equal('pong', response);
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual(expectedResponseChunks, actualResponseChunks);
                    Assert.deepEqual(expectedRequestChunks, actualRequestChunks);
                    done();
                    return;
                }
                actualResponseChunks.push(data);
                next();
            });

            for (var i = 0; i < MAX; i++) {
                var data = 'data:' + i;
                expectedRequestChunks.push(data);
                request.write(data);
            }
            request.end();

        });

        it('should handle response stream error for simple request', function (done) {
            var buffer = [];
            var _response;

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    pipe.respond('pong')
                    .write('foo');
                    pipe.throw(new Error('Boom'));
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('error', function (err) {
                Assert.equal('Boom', err.message);
                Assert.deepEqual(['foo'], buffer);
                done();
            })
            .on('response:data', function (data, next) {
                Assert.equal('pong', _response);
                if (data === undefined) {
                    done(new Error('Should not happen'));
                    return;
                }
                buffer.push(data);
                next();
            });
        });

        it('should handle error for stream request', function (done) {
            var _response;
            var responseData = [];
            var requestData = [];

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                var _request;
                pipe.on('request', function (request, next) {
                    _request = request;
                    var response = pipe.respond('pong')
                    .write('foo');
                    setImmediate(function () {
                        pipe.throw(new Error('Boom'));
                        // should be ignored
                        response.write('bar');
                    });
                });
                pipe.on('request:data', function (data, next) {
                    Assert.equal('ping', _request);
                    data && requestData.push(data);
                    next();
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('error', function (err) {
                Assert.equal('Boom', err.message);
                Assert.deepEqual(['foo'], responseData);
                Assert.deepEqual(['qwe', 'wsx'], requestData);

                done();
            })
            .on('response:data', function (data, next) {
                Assert.equal('pong', _response);
                if (data === undefined) {
                    done(new Error('Should not happen'));
                    return;
                }
                responseData.push(data);
                next();
            })
            .write('qwe')
            .write('wsx')
            .end();
        });

        it('should do retry with error in first response chunk, session should be restarted', function (done) {
            var buffer = [];
            var _response;

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    pipe.once('error', function (err, next) {
                        // delay re-try to create race condition with response chunks
                        setTimeout(function () {
                            pipe.request(request);
                        }, 20);
                    });
                    next();
                });
                pipe.on('response:data', function (data, next) {
                    next();
                });
            })
            .use(function (pipe) {
                pipe.once('response', function (request, next) {
                    pipe.throw(new Error('Boom'));
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request) {
                    pipe.respond('pong')
                    .write('foo')
                    .write('bar')
                    .end();
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('error', done)
            .on('response:data', function (data, next) {
                Assert.equal('pong', _response);
                if (data === undefined) {
                    Assert.deepEqual(['foo', 'bar'], buffer);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });
        });

        it('should not do retry with error after first successful response chunk, should be handled by developer', function (done) {
            var buffer = [];
            var _response;

            Trooba
            .use(require('..'))
            .use(function (pipe) {
                var disableRetry;
                pipe.on('response:data', function (_, next) {
                    disableRetry = true;
                    next();
                });
                pipe.on('request', function (request, next) {
                    pipe.once('error', function (err, next) {
                        setImmediate(function () {
                            if (!disableRetry) {
                                pipe.request(request);
                            }
                            else {
                                next();
                            }
                        });
                    });
                    next();
                });
            })
            .use(function (pipe) {
                var retry = 1;
                pipe.on('request', function (request) {
                    var response = pipe.respond('pong')
                    .write('foo');
                    if (retry-- > 0) {
                        setImmediate(function () {
                            pipe.throw(new Error('Boom'));
                        });
                        return;
                    }
                    response
                    .write('bar')
                    .end();
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('error', function (err) {
                Assert.equal('Boom', err.message);
                Assert.equal('pong', _response);
                Assert.deepEqual(['foo'], buffer);
                done();
            })
            .on('response:data', function (data, next) {
                buffer.push(data);
                next();
            });
        });

        it('should throw error due to request stream being closed already', function (next) {
            var request = Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('response:data', function (_, next) {
                    next();
                });
                pipe.on('request', function (request, next) {
                    next();
                });
            })
            .build()
            .create()
            .request('ping');

            request.write('foo');
            request.write('bar');
            request.end();

            Assert.throws(function () {
                request.write();
            }, /The stream has been closed already/);
            next();
        });

        it('should throw error due to response stream being closed already', function (next) {
            Trooba
            .use(require('..'))
            .use(function (pipe) {
                pipe.on('request', function (request) {
                    var response = pipe.respond();
                    response.write('foo');
                    response.write('bar');
                    response.end();

                    Assert.throws(function () {
                        response.write();
                    }, /The stream has been closed already/);

                    next();
                });
            })
            .build()
            .create()
            .request('ping');
        });

    });
});
