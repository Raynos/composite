var compose = require(".."),
    composeAsync = compose.async,
    sinon = require("sinon"),
    assert = require("assert"),
    ap = require("ap"),
    partial = ap.curry

var assertHasCallCount = partial(partial, function (spy, count) {
        assert.equal(this[spy].callCount, count, "spy was not called " +
            count + " times")
    }),
    assertWasCalledWith = partial(partial, function (spy) {
        var args = [].slice.call(arguments, 1)
        assert.equal(this[spy].calledWith.apply(this[spy], args), true,
            "spy was not calledWith " + args)
    }),
    assertIsValue = partial(partial, function (name, expected) {
        assert.equal(expected, this[name], name + " is not " + expected)
    }),
    assertIsType = partial(partial, function (name, type) {
        assert.equal(typeof this[name], type, name + " is not a " + type)
    }),
    callFunction = partial(partial, function (name, value) {
        this.result = this[name](value)
    })

context("calling composite", function () {
    beforeEach(function () {
        this.a = sinon.stub()
        this.b = sinon.stub()
        this.composed = compose(this.a, this.b)
    })

    describe("with empty functions", function () {
        it("should return a function", assertIsType("composed", "function"))

        describe("and calling it", function () {
            beforeEach(callFunction("composed", 5))

            it("should invoke a once", assertHasCallCount("a", 1))

            it("should invoke a with 5", assertWasCalledWith("a", 5))

            it("should invoke b once", assertHasCallCount("b", 1))

            it("should call b with undefined",
                assertWasCalledWith("b", undefined))

            it("should return undefined", assertIsValue("result", undefined))
        })
    })

    describe("calling it with non-trivial functions", function () {
        beforeEach(function () {
            this.a.returns(4)
            this.b.returns(8)
        })

        it("should return a function", assertIsType("composed", "function"))

        describe("and calling it", function () {
            beforeEach(callFunction("composed", 5))

            it("should invoke a once", assertHasCallCount("a", 1))

            it("should invoke a with 5", assertWasCalledWith("a", 5))

            it("should invoke b once", assertHasCallCount("b", 1))

            it("should invoke b with 4", assertWasCalledWith("b", 4))

            it("should return 8", assertIsValue("result", 8))
        })
    })
})