var partial = require("ap").curry,
    slice = Array.prototype.slice

module.exports = compose

function compose() {
    return slice.call(arguments).reduceRight(combineFunctions)
}

function combineFunctions(memo, current) {
    return partial(applyInOrder, current, memo)
}
   
function applyInOrder(first, second) {
    var result = first.apply(this, slice.call(arguments, 2))
    return second.call(this, result)
}


function add(x, y)  {
    return x + y
}

addOne = partial([1], add)

var addOne = function (y) {
    return add(1, y)
}