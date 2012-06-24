var assert = require('assert');
var ap = require('ap');

exports.ap = function () {
    assert.eql(
        ap([3], function (x, y) { return x * 2 + y })(4),
        3 * 2 + 4
    );
    
    assert.eql(
        ap([3,4], function (x, y, z, w) { return x * 2 + (y + z) * w })(5,6),
        3 * 2 + (4 + 5) * 6
    );
    
    assert.eql(
        ap([3], function (x, y) {
            return this.z * (x * 2 + y)
        }).call({ z : 10 }, 4),
        10 * (3 * 2 + 4)
    );
};

exports.pa = function () {
    assert.eql(
        ap.pa([3], function (x, y) { return x * 2 + y })(4),
        4 * 2 + 3
    );
    
    assert.eql(
        ap.pa([3,4], function (x, y, z, w) { return x * 2 + (y + z) * w })(5,6),
        5 * 2 + (6 + 3) * 4
    );
    
    assert.eql(
        ap.pa([3], function (x, y) {
            return this.z * (x * 2 + y)
        }).call({ z : 10 }, 4),
        10 * (4 * 2 + 3)
    );
};
