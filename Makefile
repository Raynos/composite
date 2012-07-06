node-test:
	./node_modules/.bin/tap --stderr ./test/unit.js

specific-browser:
	./node_modules/.bin/testling \
		--browser=$(browser) \
		./test/unit.js

test:
	./node_modules/.bin/testem \
		--file testem.json \
		--debuglog testem.log \
		--debug 2> testem.err

browsers-test:
	node ./bin/run-browser-tests

browsers-testling-test:
	make specific-browser browser=testling.chrome/12.0 && \
		make specific-browser browser=testling.chrome/13.0

echo-test:
	make specific-browser browser=echo

.PHONY: test testem