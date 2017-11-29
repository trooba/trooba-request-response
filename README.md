# request-response plugin

[![codecov](https://codecov.io/gh/trooba/trooba-request-response/branch/master/graph/badge.svg)](https://codecov.io/gh/trooba/trooba-request-response)
[![Build Status](https://travis-ci.org/trooba/trooba-request-response.svg?branch=master)](https://travis-ci.org/trooba/trooba-request-response) [![NPM](https://img.shields.io/npm/v/trooba-request-response.svg)](https://www.npmjs.com/package/trooba-request-response)
[![Downloads](https://img.shields.io/npm/dm/trooba-request-response.svg)](http://npm-stat.com/charts.html?package=trooba-request-response)
[![Known Vulnerabilities](https://snyk.io/test/github/trooba/trooba-request-response/badge.svg)](https://snyk.io/test/github/trooba/trooba-request-response)

The plugin provides request/response/streaming functionality for trooba framework.

By default, trooba version 3+ framework provides only generic messaging protocol.

This plugin extends it to support most popular use-cases:

* oneway request
* request / response
* request stream / response
* request / response stream
* request stream / response stream

## Install

```
npm install trooba -S
npm install trooba-request-response -S
```

## Usage

### Simple request/response

```js
const Trooba = require('trooba');

Trooba
.use('trooba-request-response')
.use(pipe => {
    pipe.on('request', request => {
        console.log(request); // ping
        pipe.respond('pong');
    })
})
.build()
.create()
.request('ping')
.on('error', err => {
    console.log('[ERROR]', err);
})
.on('response', response => {
    console.log(response); // pong
});
```

### Request stream

```js
const Trooba = require('trooba');

Trooba
.use('trooba-request-response')
.use(pipe => {
    pipe.on('request', (request, next) => {
        console.log(request); // ping
        next();
    })

    pipe.on('request:data', (data, next) => {
        if (data === undefined) {
            // at the end of stream
            pipe.respond('pong');
        }
        console.log(data); // >> foo, bar
        next();
    });

})
.build()
.create()
// writing request stream
.request('ping')
.write('foo')
.write('bar')
.end()
.on('response', response => {
    console.log(response); // pong
});
```

### Response stream

```js
const Trooba = require('trooba');

Trooba
.use('trooba-request-response')
.use(pipe => {
    pipe.on('request', request => {
        console.log(request); // ping
        pipe.respond('pong')
        .write('foo')
        .write('bar')
        .end();
    })
})
.build()
.create()
.request('ping')
.on('response', (response, next) => {
    console.log(response); // pong
    next();
})
.on('response:data', (data, next) => {
    if (data === undefined) {
        console.log('done!');
        return;
    }
    console.log(data); // >> foo, bar
});
```

### Retry

Retry is useful when one would like to retry after the failure

```js
const Trooba = require('trooba');

Trooba
.use('trooba-request-response')
.use(pipe => {
    var _request;
    pipe.on('request', (request, next) => {
        // our retry handler
        pipe.on('error', err => {
            pipe.retry(request);
        })
    });
})
.use(pipe => {
    var failOnce = 1;
    pipe.on('request', request => {
        if (failOnce-- > 0) {
            return pipe.throw(new Error('Boom'));
        }
        console.log(request); // ping
        pipe.respond('pong');
    })
})
.build()
.create()
.request('ping')
.on('response', response => {
    console.log(response); // pong
});
```

### Resume

```js
const Trooba = require('trooba');

Trooba
.use('trooba-request-response')
.use(pipe => {
    pipe.once('response:data', () => {
        pipe.resume();
    })
})
.use(pipe => {
    pipe.on('request', request => {
        pipe.respond('pong')
        .write('foo')
        .write('bar')
        .end();
    })
})
.build()
.create()
.request('ping')
.on('response', (response, next) => {
    console.log(response); // pong
    next();
})
.on('response:data', (data, next) => {
    data && console.log(data); // >> bar
    next();
});
```

### Continue

In some special cases when data is not directly available and one would like to continue with current data instead of resuming. In such cases one can use pipe.continue

```js
const Trooba = require('trooba');

Trooba
.use('trooba-request-response')
.use(pipe => {
    pipe.on('response', () => {
        pipe.continue();
    })
})
.use(pipe => {
    pipe.on('request', request => {
        pipe.respond('pong');
    })
})
.build()
.create()
.request('ping')
.on('response', response => {
    console.log(response); // pong
});
```
