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
    var thisValue = this === globalScope || this === undefined ? {} : this

    var result = first.apply(thisValue, slice.call(arguments, 2))
    if (Array.isArray(result)) {
        return second.apply(thisValue, result)
    }
    return second.call(thisValue, result)
}

function composeAsync() {
    return slice.call(arguments).reduceRight(combineFunctionsAsync)
}

function combineFunctionsAsync(memo, outer) {
    return partial(applyInOrderAsync, memo, outer)
}

function applyInOrderAsync(memo, outer) {
    var needsCleanThisValue = this === globalScope || this === undefined
        , thisValue = needsCleanThisValue ? {} : this
        , args = slice.call(arguments, 2)
        , callbackIndex = args.length - 1
        , inner = args[callbackIndex]

    if (needsCleanThisValue) {
        inner = inner.bind(thisValue)
        args[callbackIndex] = partial(applyOuterWithThis, outer,
            inner, thisValue)
    } else {
        args[callbackIndex] = partial(applyOuter, outer, inner)
    }

    memo.apply(thisValue, args)
}

function applyOuter(outer, inner) {
    var args = slice.call(arguments, 2).concat(inner)

    outer.apply(this, args)
}

function applyOuterWithThis(outer, inner, thisValue) {
    var args = slice.call(arguments, 3).concat(inner)

    outer.apply(thisValue, args)
}