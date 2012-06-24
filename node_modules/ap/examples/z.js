var ap = require('ap');
var z = ap([3], function (x, y) {
    return this.z * (x * 2 + y);
}).call({ z : 10 }, 4);
console.log(z);
