node-test:
	./node_modules/.bin/testling ./test

test-specific-browser:
	./node_modules/.bin/testling \
		--browser=$(browser) \
		./test/unit.js

browsers-test:
	node ./bin/run-browser-tests

testling-browsers-test:
	make test-specific-browser browser=testling.firefox && \
		make test-specific-browser browser=testling.chrome && \
		make test-specific-browser browser=testling.chromium

echo-test:
	make test-specific-browser browser=echo

.PHONY: test