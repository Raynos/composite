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
        , inner = args[callbackIndex].bind(this)

    args[callbackIndex] = partial(applyOuter, outer, inner, this)

    memo.apply(this, args)
}

function applyOuter(outer, inner, thisValue) {
    var args = slice.call(arguments, 3).concat(inner)

    outer.apply(thisValue, args)
}