var compose = require("..")
    , assert = require("assert")
    , composeAsync = compose.async

var composed = compose(function (b) {
    return b * 2
}, function (a) {
    return a * 3
})

assert.equal(18, composed(3)) // 18

var composedAsync = composeAsync(function (err, b, cb) {
    cb(null, b * 2)
}, function (a, cb) {
    cb(null, a * 3)
})

composedAsync(3, function (err, result) {
    assert.equal(err, null)
    assert.equal(result, 18)
    console.log("done")
})
