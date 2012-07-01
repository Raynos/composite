var stream = require("testling").stream
    , es = require("event-stream")
    , gate = es.gate()
    , first = false
    , socket
    , results = {
        failed: 0
        , passed: 0
        , total: 0
        , tests: []
    }

var adapterStream = es.connect(
    gate
    , es.through(writer, ender)
)

stream.pipe(adapterStream)

window.customAdapter = customAdapter

function customAdapter(_socket) {
    socket = _socket
    gate.open()
}

function writer(data) {
    if (first === false) {
        first = true
        emit("tests-start")
    }

    if (typeof data === "object") {
        var tst = {
            passed: 0
            , failed: 0
            , total: 1
            , id: data.id
            , name: data.name
            , items: []
        }

        if (!data.ok) {
            tst.items.push({
                passed: false
                , message: data.name
                , stacktrace: data.stack.join("\n")
            })
            results.failed++
            tst.failed++
        } else {
            results.passed++
            tst.passed++
        }

        results.total++
        results.tests.push(tst)

        emit("test-result", tst)
    }
}

function ender() {
    emit("all-tests-results", results)
}

function emit() {
    socket.emit.apply(socket, arguments)
}