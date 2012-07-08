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
    return slice.call(arguments).reduceRight(combineFunctionsAsync)
}

function combineFunctionsAsync(memo, outer, index) {
    return partial(applyInOrderAsync, memo, outer)
}

function applyInOrderAsync(memo, outer) {
    var args = slice.call(arguments, 2)
        , callbackIndex = args.length - 1
        , memoLength = memo.length
        , inner = args[callbackIndex]

    if (typeof inner === "function") {
        inner = inner.bind(this)
    }

    if (callbackIndex < memoLength - 1) {
        callbackIndex = memoLength - 1
    }

    if (callbackIndex < 0) {
        callbackIndex = 0
    }

    args[callbackIndex] = partial(applyOuter, outer, inner, this)

    memo.apply(this, args)
}

function applyOuter(outer, inner, thisValue) {
    var args = slice.call(arguments, 3)
        , callbackIndex = args.length
        , outerIndex = outer.length - 1

    if (callbackIndex < outerIndex) {
        args[outerIndex] = inner
    } else {
        args[callbackIndex] = inner
    }

    outer.apply(thisValue, args)
}