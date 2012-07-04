node-test:
	./node_modules/.bin/tap --stderr ./test/unit.js

test-specific-browser:
	./node_modules/.bin/testling \
		--browser=$(browser) \
		./test/unit.js

testem:
	./node_modules/.bin/testem \
		--debuglog testem.log \
		--debug

browsers-test:
	node ./bin/run-browser-tests

testling-browsers-test:
	make test-specific-browser browser=testling.chrome/12.0 && \
		make test-specific-browser browser=testling.chrome/13.0

echo-test:
	make test-specific-browser browser=echo

.PHONY: test testem