var child_process = require("child_process")
    , spawn = child_process.spawn
    , exec = child_process.exec
    , createServers = require("../node_modules/testling/lib/servers")
    , runnerDomain = require("domain").create()
    , offset = 0

runnerDomain.run(chrome)

runnerDomain.on("error", handleError)

function chrome() {
    runCommand("google-chrome", firefox)
}

function firefox() {
    runCommand("firefox", chromium)
}

function chromium() {
    runCommand("chromium-browser", done)
}

function done() {
    console.log("done")
    process.exit()
}

function handleError(err)  {
    console.log("domain error", err)
}

function runCommand(cmd, next) {
    var port = 54046 + offset
        , proxyPort = 54045 + offset
        , browser

    createServers({
        files: ['./test/unit.js']
        , proxy: 'localhost:' + proxyPort
        , browser: 'echo'
        , server: 'localhost:' + port
        , callback: function () {
            browser.kill()
            next()
        }
    }, function (uri, ports, servers) {
        offset += 2

        browser = spawn(cmd, ["localhost:" + port])
        runnerDomain.add(browser)
        browser.stdout.pipe(process.stdout)
        browser.stderr.pipe(process.stderr)
    })
}