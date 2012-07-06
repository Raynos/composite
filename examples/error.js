var compose = require("..")
    , assert = require("assert")
    , composeAsync = compose.async

composeAsync(function (err, data, cb) {
    // note how the callback is still the third parameter.
    // This is because asyncCompose ensures cb is always at least the
    // last parameter
    if (err) {
        return cb(err)
    }
}, function (cb) {
    cb(new Error("oops"))
})(function (err) {
    assert.equal(err.message, "oops")
    console.log("done")
})