# Composite [![build status][1]][2]

Compose functions together

## Example

    var compose = require("composite"),
        composeAsync = compose.async

    var composed = compose(function (b) {
        return b * 2
    }, function (a) {
        return a * 3
    })

    composed(3) // 18

    var composedAsync = composeAsync(function (err, b, cb) {
        cb(null, b * 2)
    }, function (a, cb) {
        cb(null, a * 3)
    })

    composedAsync(3, function (err, result) {
        // error === null, result === 18
    })

## Example abusing this

    var composed = composeAsync(parseFile, stringifyFile, fs.readFile)

    composed.call({}, "foo.js", function (err, data) {
        // data = someJSONObject
    })

    // If you specify a this value, then that value will be used as this for
    // all the functionsan empty object is given. This is useful to store state
    function stringifyFile(err, data, cb) {
        if (err) {
            return cb(err)
        }

        this.data = data.toString()
        cb(null)
    }

    function parseFile(err, cb) {
        cb(err, this.data && JSON.parse(this.data))
    }

## Installation

`npm install composite`

## Tests

`make test`

## Contributors

 - Raynos

## MIT Licenced

  [1]: https://secure.travis-ci.org/Raynos/composite.png
  [2]: http://travis-ci.org/Raynos/composite