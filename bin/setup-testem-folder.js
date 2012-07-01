var browserify = require("browserify")
    , path = require("path")
    , fs = require("fs")

fs.watch(path.join(process.cwd(), "index.js"), writeBundle)
fs.watch(path.join(process.cwd(), "test"), writeBundle)

writeBundle()

function writeBundle() {
    console.log("writing bundle")

    var bundle = browserify()

    bundle.addEntry(path.join(__dirname, "testlingAdapter.js"))
    bundle.addEntry(path.join(process.cwd(), "test", "unit.js"))

    fs.writeFile(path.join(process.cwd(), "testem", "test.js"),
        bundle.bundle())
}