node-test:
	./node_modules/.bin/tap --stderr ./test

test-specific-browser:
	./node_modules/.bin/testling \
		--browser=$(browser) \
		./test/unit.js

testem-test-builder:
	node ./bin/setup-testem-folder

testem:
	./node_modules/.bin/testem

browsers-test:
	node ./bin/run-browser-tests

testling-browsers-test:
	make test-specific-browser browser=testling.chrome/12.0 && \
		make test-specific-browser browser=testling.chrome/13.0

echo-test:
	make test-specific-browser browser=echo

.PHONY: test testem