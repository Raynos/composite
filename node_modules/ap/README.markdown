ap
==

`Function.prototype.bind` sets `this` which is super annoying if you just want
to do currying over arguments while passing `this` through.

Instead you can do:

    var ap = require('ap');
    var z = ap([3], function (x, y) {
        return this.z * (x * 2 + y);
    }).call({ z : 10 }, 4);
    console.log(z);
***
    100

methods
=======

ap(args, fn)
------------

Fill in the arguments `args` at the beginning of `fn`'s arguments list.

pa(args, fn)
------------

Fill in the arguments `args` at the end of `fn`'s arguments list.

apa(left, right, fn)
--------------------

Fill in `left` arguments starting from the beginning of `fn`'s argument list and
`right` arguments starting from the end.

curry(fn, args[0], args[1], ...)
--------------------------------

Fill in `fn`'s arguments with `args` from the beginning of `fn`'s arguments
list.
