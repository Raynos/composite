"use strict";

var partial = require("ap").partial
    , slice = Array.prototype.slice
    , globalScope = typeof global === "undefined" ? window : global

compose.async = composeAsync

module.exports = compose

function compose() {
    return slice.call(arguments).reduceRight(combineFunctions)
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
    
}