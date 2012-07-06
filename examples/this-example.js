var composeAsync = require("..").async
    , assert = require("assert")
    , fs = require("fs")
    , path = require("path")

var composed = composeAsync(parseFile, stringifyFile, fs.readFile)

composed.call({}, path.join(__dirname,  "foo.json"), function (err, data) {
    assert.equal(err, null)
    assert.equal(data.foo, "bar")
    console.log("done")
})

// If you do not specify a this value, then an empty object is given
// to you as this. This is useful to store state
function stringifyFile(err, data, cb) {
    if (err) {
        console.log(err)
        return cb(err)
    }

    this.data = data.toString()
    cb(null)
}

function parseFile(err, cb) {
    cb(err, this.data && JSON.parse(this.data))
}