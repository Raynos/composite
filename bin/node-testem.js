var io = require("socket.io-client")
    , tap = require("tap")
    , Runner = tap.createRunner
    , socket = io.connect("http://localhost:7357")
    , runner
    , first = false
    , results = {
        failed: 0
        , passed: 0
        , total: 0
        , tests: []
    }

socket.emit('browser-login', 'Node')
socket.on('reconnect', startTests)
socket.on('start-tests', startTests)

function startTests() {
    socket.emit('browser-login', 'Node')
    console.log("starting tests")
    if (runner) {
        runner.removeListener("file", onFile)
        runner.removeListener("end", onEnd)
    }

    runner = new Runner({
        argv: {
            remain: "test"
        }
        , version: false
        , help: false
        , timeout: 30
        , diag: process.env.TAP_DIAG
        , tap: process.env.TAP_DIAG
        , stderr: process.env.TAP_STDERR
        , cover:  "./lib"
        , "cover-dir": "./coverage"
    })

    runner.on("file", onFile)

    runner.on("end", onEnd)
}

function onFile(file, data, details) {
    if (first === false) {
        first = true
        emit("tests-start")
    }

    console.log("runner got file", data)

    details.list.forEach(function (data) {
        if (data.id === undefined) {
            return
        }

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
    })
}

function onEnd() {
    console.log("runner ended")
    emit("all-test-results", results)
}

function emit() {
    socket.emit.apply(socket, arguments)
}