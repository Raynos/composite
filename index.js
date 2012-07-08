"use strict";

var partial = require("ap").partial
    , slice = Array.prototype.slice
    , globalScope = typeof global === "undefined" ? window : global

compose.async = composeAsync

module.exports = compose

function compose() {
    return slice.call(arguments).reduce(combineFunctions)
}

function combineFunctions(memo, current) {
    return partial(applyInOrder, current, memo)
}
   
function applyInOrder(first, second) {
    var result = first.apply(this, slice.call(arguments, 2))
    if (Array.isArray(result)) {
        return second.apply(this, result)
    }
    return second.call(this, result)
}

function composeAsync() {
    return createAsyncComposite(slice.call(arguments))
}

function createAsyncComposite(fns) {
    var index = fns.length - 1
        , thisValue
        , finishCallback

    return callFirst

    function callNext() {
        var args = slice.call(arguments)
            , f = fns[index--]
            , functionIndex = f.length - 1
            , callbackIndex = args.length

        if (callbackIndex < functionIndex) {
            callbackIndex = functionIndex
        }

        if (index === -1) {
            args[callbackIndex] = finishCallback
        } else {
            args[callbackIndex] = callNext
        }

        f.apply(thisValue, args)
    }

    function callFirst() {
        var args = slice.call(arguments)
            , f = fns[index--]
            , functionIndex = f.length - 1
            , callbackIndex = args.length
            , lastArg = args[callbackIndex - 1]

        thisValue = this

        if (typeof lastArg === "function") {
            finishCallback = lastArg.bind(thisValue)
            args.pop()
            callbackIndex--
        }

        if (callbackIndex < functionIndex) {
            callbackIndex = functionIndex
        }

        args[callbackIndex] = callNext

        f.apply(thisValue, args)
    }
}