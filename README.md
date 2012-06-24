# Composite [![build status][1]][2]

Compose functions together

## Example

    var compose = require("composite"),
        composeAsync = compose.async

    var composed = compose(function (a) {
        return a * 2
    }, function (b) {
        return b * 3
    })

    composed(3) // 18

    var composedAsync = composeAsync(function (a, cb) {
        cb(null, a * 2)
    }, function (err, b, cb) {
        cb(null, b * 3)
    })

    composedAsync(3, function (err, result) {
        // error === null, result === 18
    })

## Installation

`npm install composite`

## Tests

`make test`

## Contributors

 - Raynos

## MIT Licenced

  [1]: https://secure.travis-ci.org/Raynos/composite.png
  [2]: http://travis-ci.org/Raynos/composite