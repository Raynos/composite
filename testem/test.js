(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    
    require.define = function (filename, fn) {
        if (require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            return require(file, dirname);
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = { exports : {} };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process
            );
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};
});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process){var process = module.exports = {};

process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();
});

require.define("/node_modules/testling/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js","browserify":"browser.js"}});

require.define("/node_modules/testling/browser.js",function(require,module,exports,__dirname,__filename,process){window.Buffer = require('buffer').Buffer;
module.exports = require('./browser/harness')().test;
});

require.define("buffer",function(require,module,exports,__dirname,__filename,process){function SlowBuffer (size) {
    this.length = size;
};

var assert = require('assert');

exports.INSPECT_MAX_BYTES = 50;


function toHex(n) {
  if (n < 16) return '0' + n.toString(16);
  return n.toString(16);
}


SlowBuffer.prototype.inspect = function() {
  var out = [],
      len = this.length;
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i]);
    if (i == exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...';
      break;
    }
  }
  return '<SlowBuffer ' + out.join(' ') + '>';
};


SlowBuffer.prototype.hexSlice = function(start, end) {
  var len = this.length;

  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;

  var out = '';
  for (var i = start; i < end; i++) {
    out += toHex(this[i]);
  }
  return out;
};


SlowBuffer.prototype.toString = function(encoding, start, end) {
  encoding = String(encoding || 'utf8').toLowerCase();
  start = +start || 0;
  if (typeof end == 'undefined') end = this.length;

  // Fastpath empty strings
  if (+end == start) {
    return '';
  }

  switch (encoding) {
    case 'hex':
      return this.hexSlice(start, end);

    case 'utf8':
    case 'utf-8':
      return this.utf8Slice(start, end);

    case 'ascii':
      return this.asciiSlice(start, end);

    case 'binary':
      return this.binarySlice(start, end);

    case 'base64':
      return this.base64Slice(start, end);

    case 'ucs2':
    case 'ucs-2':
      return this.ucs2Slice(start, end);

    default:
      throw new Error('Unknown encoding');
  }
};


SlowBuffer.prototype.hexWrite = function(string, offset, length) {
  offset = +offset || 0;
  var remaining = this.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = +length;
    if (length > remaining) {
      length = remaining;
    }
  }

  // must be an even number of digits
  var strLen = string.length;
  if (strLen % 2) {
    throw new Error('Invalid hex string');
  }
  if (length > strLen / 2) {
    length = strLen / 2;
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16);
    if (isNaN(byte)) throw new Error('Invalid hex string');
    this[offset + i] = byte;
  }
  SlowBuffer._charsWritten = i * 2;
  return i;
};


SlowBuffer.prototype.write = function(string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length;
      length = undefined;
    }
  } else {  // legacy
    var swap = encoding;
    encoding = offset;
    offset = length;
    length = swap;
  }

  offset = +offset || 0;
  var remaining = this.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = +length;
    if (length > remaining) {
      length = remaining;
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase();

  switch (encoding) {
    case 'hex':
      return this.hexWrite(string, offset, length);

    case 'utf8':
    case 'utf-8':
      return this.utf8Write(string, offset, length);

    case 'ascii':
      return this.asciiWrite(string, offset, length);

    case 'binary':
      return this.binaryWrite(string, offset, length);

    case 'base64':
      return this.base64Write(string, offset, length);

    case 'ucs2':
    case 'ucs-2':
      return this.ucs2Write(string, offset, length);

    default:
      throw new Error('Unknown encoding');
  }
};


// slice(start, end)
SlowBuffer.prototype.slice = function(start, end) {
  if (end === undefined) end = this.length;

  if (end > this.length) {
    throw new Error('oob');
  }
  if (start > end) {
    throw new Error('oob');
  }

  return new Buffer(this, end - start, +start);
};


function coerce(length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length);
  return length < 0 ? 0 : length;
}


// Buffer

function Buffer(subject, encoding, offset) {
  if (!(this instanceof Buffer)) {
    return new Buffer(subject, encoding, offset);
  }

  var type;

  // Are we slicing?
  if (typeof offset === 'number') {
    this.length = coerce(encoding);
    this.parent = subject;
    this.offset = offset;
  } else {
    // Find the length
    switch (type = typeof subject) {
      case 'number':
        this.length = coerce(subject);
        break;

      case 'string':
        this.length = Buffer.byteLength(subject, encoding);
        break;

      case 'object': // Assume object is an array
        this.length = coerce(subject.length);
        break;

      default:
        throw new Error('First argument needs to be a number, ' +
                        'array or string.');
    }

    if (this.length > Buffer.poolSize) {
      // Big buffer, just alloc one.
      this.parent = new SlowBuffer(this.length);
      this.offset = 0;

    } else {
      // Small buffer.
      if (!pool || pool.length - pool.used < this.length) allocPool();
      this.parent = pool;
      this.offset = pool.used;
      pool.used += this.length;
    }

    // Treat array-ish objects as a byte array.
    if (isArrayIsh(subject)) {
      for (var i = 0; i < this.length; i++) {
        this.parent[i + this.offset] = subject[i];
      }
    } else if (type == 'string') {
      // We are a string
      this.length = this.write(subject, 0, encoding);
    }
  }

}

function isArrayIsh(subject) {
  return Array.isArray(subject) || Buffer.isBuffer(subject) ||
         subject && typeof subject === 'object' &&
         typeof subject.length === 'number';
}

exports.SlowBuffer = SlowBuffer;
exports.Buffer = Buffer;

Buffer.poolSize = 8 * 1024;
var pool;

function allocPool() {
  pool = new SlowBuffer(Buffer.poolSize);
  pool.used = 0;
}


// Static methods
Buffer.isBuffer = function isBuffer(b) {
  return b instanceof Buffer || b instanceof SlowBuffer;
};


// Inspect
Buffer.prototype.inspect = function inspect() {
  var out = [],
      len = this.length;

  for (var i = 0; i < len; i++) {
    out[i] = toHex(this.parent[i + this.offset]);
    if (i == exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...';
      break;
    }
  }

  return '<Buffer ' + out.join(' ') + '>';
};


Buffer.prototype.get = function get(i) {
  if (i < 0 || i >= this.length) throw new Error('oob');
  return this.parent[this.offset + i];
};


Buffer.prototype.set = function set(i, v) {
  if (i < 0 || i >= this.length) throw new Error('oob');
  return this.parent[this.offset + i] = v;
};


// write(string, offset = 0, length = buffer.length-offset, encoding = 'utf8')
Buffer.prototype.write = function(string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length;
      length = undefined;
    }
  } else {  // legacy
    var swap = encoding;
    encoding = offset;
    offset = length;
    length = swap;
  }

  offset = +offset || 0;
  var remaining = this.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = +length;
    if (length > remaining) {
      length = remaining;
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase();

  var ret;
  switch (encoding) {
    case 'hex':
      ret = this.parent.hexWrite(string, this.offset + offset, length);
      break;

    case 'utf8':
    case 'utf-8':
      ret = this.parent.utf8Write(string, this.offset + offset, length);
      break;

    case 'ascii':
      ret = this.parent.asciiWrite(string, this.offset + offset, length);
      break;

    case 'binary':
      ret = this.parent.binaryWrite(string, this.offset + offset, length);
      break;

    case 'base64':
      // Warning: maxLength not taken into account in base64Write
      ret = this.parent.base64Write(string, this.offset + offset, length);
      break;

    case 'ucs2':
    case 'ucs-2':
      ret = this.parent.ucs2Write(string, this.offset + offset, length);
      break;

    default:
      throw new Error('Unknown encoding');
  }

  Buffer._charsWritten = SlowBuffer._charsWritten;

  return ret;
};


// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function(encoding, start, end) {
  encoding = String(encoding || 'utf8').toLowerCase();

  if (typeof start == 'undefined' || start < 0) {
    start = 0;
  } else if (start > this.length) {
    start = this.length;
  }

  if (typeof end == 'undefined' || end > this.length) {
    end = this.length;
  } else if (end < 0) {
    end = 0;
  }

  start = start + this.offset;
  end = end + this.offset;

  switch (encoding) {
    case 'hex':
      return this.parent.hexSlice(start, end);

    case 'utf8':
    case 'utf-8':
      return this.parent.utf8Slice(start, end);

    case 'ascii':
      return this.parent.asciiSlice(start, end);

    case 'binary':
      return this.parent.binarySlice(start, end);

    case 'base64':
      return this.parent.base64Slice(start, end);

    case 'ucs2':
    case 'ucs-2':
      return this.parent.ucs2Slice(start, end);

    default:
      throw new Error('Unknown encoding');
  }
};


// byteLength
Buffer.byteLength = SlowBuffer.byteLength;


// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill(value, start, end) {
  value || (value = 0);
  start || (start = 0);
  end || (end = this.length);

  if (typeof value === 'string') {
    value = value.charCodeAt(0);
  }
  if (!(typeof value === 'number') || isNaN(value)) {
    throw new Error('value is not a number');
  }

  if (end < start) throw new Error('end < start');

  // Fill 0 bytes; we're done
  if (end === start) return 0;
  if (this.length == 0) return 0;

  if (start < 0 || start >= this.length) {
    throw new Error('start out of bounds');
  }

  if (end < 0 || end > this.length) {
    throw new Error('end out of bounds');
  }

  return this.parent.fill(value,
                          start + this.offset,
                          end + this.offset);
};


// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function(target, target_start, start, end) {
  var source = this;
  start || (start = 0);
  end || (end = this.length);
  target_start || (target_start = 0);

  if (end < start) throw new Error('sourceEnd < sourceStart');

  // Copy 0 bytes; we're done
  if (end === start) return 0;
  if (target.length == 0 || source.length == 0) return 0;

  if (target_start < 0 || target_start >= target.length) {
    throw new Error('targetStart out of bounds');
  }

  if (start < 0 || start >= source.length) {
    throw new Error('sourceStart out of bounds');
  }

  if (end < 0 || end > source.length) {
    throw new Error('sourceEnd out of bounds');
  }

  // Are we oob?
  if (end > this.length) {
    end = this.length;
  }

  if (target.length - target_start < end - start) {
    end = target.length - target_start + start;
  }

  return this.parent.copy(target.parent,
                          target_start + target.offset,
                          start + this.offset,
                          end + this.offset);
};


// slice(start, end)
Buffer.prototype.slice = function(start, end) {
  if (end === undefined) end = this.length;
  if (end > this.length) throw new Error('oob');
  if (start > end) throw new Error('oob');

  return new Buffer(this.parent, end - start, +start + this.offset);
};


// Legacy methods for backwards compatibility.

Buffer.prototype.utf8Slice = function(start, end) {
  return this.toString('utf8', start, end);
};

Buffer.prototype.binarySlice = function(start, end) {
  return this.toString('binary', start, end);
};

Buffer.prototype.asciiSlice = function(start, end) {
  return this.toString('ascii', start, end);
};

Buffer.prototype.utf8Write = function(string, offset) {
  return this.write(string, offset, 'utf8');
};

Buffer.prototype.binaryWrite = function(string, offset) {
  return this.write(string, offset, 'binary');
};

Buffer.prototype.asciiWrite = function(string, offset) {
  return this.write(string, offset, 'ascii');
};

Buffer.prototype.readUInt8 = function(offset, noAssert) {
  var buffer = this;

  if (!noAssert) {
    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset < buffer.length,
        'Trying to read beyond buffer length');
  }

  return buffer[offset];
};

function readUInt16(buffer, offset, isBigEndian, noAssert) {
  var val = 0;


  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 1 < buffer.length,
        'Trying to read beyond buffer length');
  }

  if (isBigEndian) {
    val = buffer[offset] << 8;
    val |= buffer[offset + 1];
  } else {
    val = buffer[offset];
    val |= buffer[offset + 1] << 8;
  }

  return val;
}

Buffer.prototype.readUInt16LE = function(offset, noAssert) {
  return readUInt16(this, offset, false, noAssert);
};

Buffer.prototype.readUInt16BE = function(offset, noAssert) {
  return readUInt16(this, offset, true, noAssert);
};

function readUInt32(buffer, offset, isBigEndian, noAssert) {
  var val = 0;

  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 3 < buffer.length,
        'Trying to read beyond buffer length');
  }

  if (isBigEndian) {
    val = buffer[offset + 1] << 16;
    val |= buffer[offset + 2] << 8;
    val |= buffer[offset + 3];
    val = val + (buffer[offset] << 24 >>> 0);
  } else {
    val = buffer[offset + 2] << 16;
    val |= buffer[offset + 1] << 8;
    val |= buffer[offset];
    val = val + (buffer[offset + 3] << 24 >>> 0);
  }

  return val;
}

Buffer.prototype.readUInt32LE = function(offset, noAssert) {
  return readUInt32(this, offset, false, noAssert);
};

Buffer.prototype.readUInt32BE = function(offset, noAssert) {
  return readUInt32(this, offset, true, noAssert);
};


/*
 * Signed integer types, yay team! A reminder on how two's complement actually
 * works. The first bit is the signed bit, i.e. tells us whether or not the
 * number should be positive or negative. If the two's complement value is
 * positive, then we're done, as it's equivalent to the unsigned representation.
 *
 * Now if the number is positive, you're pretty much done, you can just leverage
 * the unsigned translations and return those. Unfortunately, negative numbers
 * aren't quite that straightforward.
 *
 * At first glance, one might be inclined to use the traditional formula to
 * translate binary numbers between the positive and negative values in two's
 * complement. (Though it doesn't quite work for the most negative value)
 * Mainly:
 *  - invert all the bits
 *  - add one to the result
 *
 * Of course, this doesn't quite work in Javascript. Take for example the value
 * of -128. This could be represented in 16 bits (big-endian) as 0xff80. But of
 * course, Javascript will do the following:
 *
 * > ~0xff80
 * -65409
 *
 * Whoh there, Javascript, that's not quite right. But wait, according to
 * Javascript that's perfectly correct. When Javascript ends up seeing the
 * constant 0xff80, it has no notion that it is actually a signed number. It
 * assumes that we've input the unsigned value 0xff80. Thus, when it does the
 * binary negation, it casts it into a signed value, (positive 0xff80). Then
 * when you perform binary negation on that, it turns it into a negative number.
 *
 * Instead, we're going to have to use the following general formula, that works
 * in a rather Javascript friendly way. I'm glad we don't support this kind of
 * weird numbering scheme in the kernel.
 *
 * (BIT-MAX - (unsigned)val + 1) * -1
 *
 * The astute observer, may think that this doesn't make sense for 8-bit numbers
 * (really it isn't necessary for them). However, when you get 16-bit numbers,
 * you do. Let's go back to our prior example and see how this will look:
 *
 * (0xffff - 0xff80 + 1) * -1
 * (0x007f + 1) * -1
 * (0x0080) * -1
 */
Buffer.prototype.readInt8 = function(offset, noAssert) {
  var buffer = this;
  var neg;

  if (!noAssert) {
    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset < buffer.length,
        'Trying to read beyond buffer length');
  }

  neg = buffer[offset] & 0x80;
  if (!neg) {
    return (buffer[offset]);
  }

  return ((0xff - buffer[offset] + 1) * -1);
};

function readInt16(buffer, offset, isBigEndian, noAssert) {
  var neg, val;

  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 1 < buffer.length,
        'Trying to read beyond buffer length');
  }

  val = readUInt16(buffer, offset, isBigEndian, noAssert);
  neg = val & 0x8000;
  if (!neg) {
    return val;
  }

  return (0xffff - val + 1) * -1;
}

Buffer.prototype.readInt16LE = function(offset, noAssert) {
  return readInt16(this, offset, false, noAssert);
};

Buffer.prototype.readInt16BE = function(offset, noAssert) {
  return readInt16(this, offset, true, noAssert);
};

function readInt32(buffer, offset, isBigEndian, noAssert) {
  var neg, val;

  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 3 < buffer.length,
        'Trying to read beyond buffer length');
  }

  val = readUInt32(buffer, offset, isBigEndian, noAssert);
  neg = val & 0x80000000;
  if (!neg) {
    return (val);
  }

  return (0xffffffff - val + 1) * -1;
}

Buffer.prototype.readInt32LE = function(offset, noAssert) {
  return readInt32(this, offset, false, noAssert);
};

Buffer.prototype.readInt32BE = function(offset, noAssert) {
  return readInt32(this, offset, true, noAssert);
};

function readFloat(buffer, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset + 3 < buffer.length,
        'Trying to read beyond buffer length');
  }

  return require('buffer_ieee754').readIEEE754(buffer, offset, isBigEndian,
      23, 4);
}

Buffer.prototype.readFloatLE = function(offset, noAssert) {
  return readFloat(this, offset, false, noAssert);
};

Buffer.prototype.readFloatBE = function(offset, noAssert) {
  return readFloat(this, offset, true, noAssert);
};

function readDouble(buffer, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset + 7 < buffer.length,
        'Trying to read beyond buffer length');
  }

  return require('buffer_ieee754').readIEEE754(buffer, offset, isBigEndian,
      52, 8);
}

Buffer.prototype.readDoubleLE = function(offset, noAssert) {
  return readDouble(this, offset, false, noAssert);
};

Buffer.prototype.readDoubleBE = function(offset, noAssert) {
  return readDouble(this, offset, true, noAssert);
};


/*
 * We have to make sure that the value is a valid integer. This means that it is
 * non-negative. It has no fractional component and that it does not exceed the
 * maximum allowed value.
 *
 *      value           The number to check for validity
 *
 *      max             The maximum value
 */
function verifuint(value, max) {
  assert.ok(typeof (value) == 'number',
      'cannot write a non-number as a number');

  assert.ok(value >= 0,
      'specified a negative value for writing an unsigned value');

  assert.ok(value <= max, 'value is larger than maximum value for type');

  assert.ok(Math.floor(value) === value, 'value has a fractional component');
}

Buffer.prototype.writeUInt8 = function(value, offset, noAssert) {
  var buffer = this;

  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset < buffer.length,
        'trying to write beyond buffer length');

    verifuint(value, 0xff);
  }

  buffer[offset] = value;
};

function writeUInt16(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 1 < buffer.length,
        'trying to write beyond buffer length');

    verifuint(value, 0xffff);
  }

  if (isBigEndian) {
    buffer[offset] = (value & 0xff00) >>> 8;
    buffer[offset + 1] = value & 0x00ff;
  } else {
    buffer[offset + 1] = (value & 0xff00) >>> 8;
    buffer[offset] = value & 0x00ff;
  }
}

Buffer.prototype.writeUInt16LE = function(value, offset, noAssert) {
  writeUInt16(this, value, offset, false, noAssert);
};

Buffer.prototype.writeUInt16BE = function(value, offset, noAssert) {
  writeUInt16(this, value, offset, true, noAssert);
};

function writeUInt32(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 3 < buffer.length,
        'trying to write beyond buffer length');

    verifuint(value, 0xffffffff);
  }

  if (isBigEndian) {
    buffer[offset] = (value >>> 24) & 0xff;
    buffer[offset + 1] = (value >>> 16) & 0xff;
    buffer[offset + 2] = (value >>> 8) & 0xff;
    buffer[offset + 3] = value & 0xff;
  } else {
    buffer[offset + 3] = (value >>> 24) & 0xff;
    buffer[offset + 2] = (value >>> 16) & 0xff;
    buffer[offset + 1] = (value >>> 8) & 0xff;
    buffer[offset] = value & 0xff;
  }
}

Buffer.prototype.writeUInt32LE = function(value, offset, noAssert) {
  writeUInt32(this, value, offset, false, noAssert);
};

Buffer.prototype.writeUInt32BE = function(value, offset, noAssert) {
  writeUInt32(this, value, offset, true, noAssert);
};


/*
 * We now move onto our friends in the signed number category. Unlike unsigned
 * numbers, we're going to have to worry a bit more about how we put values into
 * arrays. Since we are only worrying about signed 32-bit values, we're in
 * slightly better shape. Unfortunately, we really can't do our favorite binary
 * & in this system. It really seems to do the wrong thing. For example:
 *
 * > -32 & 0xff
 * 224
 *
 * What's happening above is really: 0xe0 & 0xff = 0xe0. However, the results of
 * this aren't treated as a signed number. Ultimately a bad thing.
 *
 * What we're going to want to do is basically create the unsigned equivalent of
 * our representation and pass that off to the wuint* functions. To do that
 * we're going to do the following:
 *
 *  - if the value is positive
 *      we can pass it directly off to the equivalent wuint
 *  - if the value is negative
 *      we do the following computation:
 *         mb + val + 1, where
 *         mb   is the maximum unsigned value in that byte size
 *         val  is the Javascript negative integer
 *
 *
 * As a concrete value, take -128. In signed 16 bits this would be 0xff80. If
 * you do out the computations:
 *
 * 0xffff - 128 + 1
 * 0xffff - 127
 * 0xff80
 *
 * You can then encode this value as the signed version. This is really rather
 * hacky, but it should work and get the job done which is our goal here.
 */

/*
 * A series of checks to make sure we actually have a signed 32-bit number
 */
function verifsint(value, max, min) {
  assert.ok(typeof (value) == 'number',
      'cannot write a non-number as a number');

  assert.ok(value <= max, 'value larger than maximum allowed value');

  assert.ok(value >= min, 'value smaller than minimum allowed value');

  assert.ok(Math.floor(value) === value, 'value has a fractional component');
}

function verifIEEE754(value, max, min) {
  assert.ok(typeof (value) == 'number',
      'cannot write a non-number as a number');

  assert.ok(value <= max, 'value larger than maximum allowed value');

  assert.ok(value >= min, 'value smaller than minimum allowed value');
}

Buffer.prototype.writeInt8 = function(value, offset, noAssert) {
  var buffer = this;

  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset < buffer.length,
        'Trying to write beyond buffer length');

    verifsint(value, 0x7f, -0x80);
  }

  if (value >= 0) {
    buffer.writeUInt8(value, offset, noAssert);
  } else {
    buffer.writeUInt8(0xff + value + 1, offset, noAssert);
  }
};

function writeInt16(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 1 < buffer.length,
        'Trying to write beyond buffer length');

    verifsint(value, 0x7fff, -0x8000);
  }

  if (value >= 0) {
    writeUInt16(buffer, value, offset, isBigEndian, noAssert);
  } else {
    writeUInt16(buffer, 0xffff + value + 1, offset, isBigEndian, noAssert);
  }
}

Buffer.prototype.writeInt16LE = function(value, offset, noAssert) {
  writeInt16(this, value, offset, false, noAssert);
};

Buffer.prototype.writeInt16BE = function(value, offset, noAssert) {
  writeInt16(this, value, offset, true, noAssert);
};

function writeInt32(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 3 < buffer.length,
        'Trying to write beyond buffer length');

    verifsint(value, 0x7fffffff, -0x80000000);
  }

  if (value >= 0) {
    writeUInt32(buffer, value, offset, isBigEndian, noAssert);
  } else {
    writeUInt32(buffer, 0xffffffff + value + 1, offset, isBigEndian, noAssert);
  }
}

Buffer.prototype.writeInt32LE = function(value, offset, noAssert) {
  writeInt32(this, value, offset, false, noAssert);
};

Buffer.prototype.writeInt32BE = function(value, offset, noAssert) {
  writeInt32(this, value, offset, true, noAssert);
};

function writeFloat(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 3 < buffer.length,
        'Trying to write beyond buffer length');

    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38);
  }

  require('buffer_ieee754').writeIEEE754(buffer, value, offset, isBigEndian,
      23, 4);
}

Buffer.prototype.writeFloatLE = function(value, offset, noAssert) {
  writeFloat(this, value, offset, false, noAssert);
};

Buffer.prototype.writeFloatBE = function(value, offset, noAssert) {
  writeFloat(this, value, offset, true, noAssert);
};

function writeDouble(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 7 < buffer.length,
        'Trying to write beyond buffer length');

    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308);
  }

  require('buffer_ieee754').writeIEEE754(buffer, value, offset, isBigEndian,
      52, 8);
}

Buffer.prototype.writeDoubleLE = function(value, offset, noAssert) {
  writeDouble(this, value, offset, false, noAssert);
};

Buffer.prototype.writeDoubleBE = function(value, offset, noAssert) {
  writeDouble(this, value, offset, true, noAssert);
};

SlowBuffer.prototype.readUInt8 = Buffer.prototype.readUInt8;
SlowBuffer.prototype.readUInt16LE = Buffer.prototype.readUInt16LE;
SlowBuffer.prototype.readUInt16BE = Buffer.prototype.readUInt16BE;
SlowBuffer.prototype.readUInt32LE = Buffer.prototype.readUInt32LE;
SlowBuffer.prototype.readUInt32BE = Buffer.prototype.readUInt32BE;
SlowBuffer.prototype.readInt8 = Buffer.prototype.readInt8;
SlowBuffer.prototype.readInt16LE = Buffer.prototype.readInt16LE;
SlowBuffer.prototype.readInt16BE = Buffer.prototype.readInt16BE;
SlowBuffer.prototype.readInt32LE = Buffer.prototype.readInt32LE;
SlowBuffer.prototype.readInt32BE = Buffer.prototype.readInt32BE;
SlowBuffer.prototype.readFloatLE = Buffer.prototype.readFloatLE;
SlowBuffer.prototype.readFloatBE = Buffer.prototype.readFloatBE;
SlowBuffer.prototype.readDoubleLE = Buffer.prototype.readDoubleLE;
SlowBuffer.prototype.readDoubleBE = Buffer.prototype.readDoubleBE;
SlowBuffer.prototype.writeUInt8 = Buffer.prototype.writeUInt8;
SlowBuffer.prototype.writeUInt16LE = Buffer.prototype.writeUInt16LE;
SlowBuffer.prototype.writeUInt16BE = Buffer.prototype.writeUInt16BE;
SlowBuffer.prototype.writeUInt32LE = Buffer.prototype.writeUInt32LE;
SlowBuffer.prototype.writeUInt32BE = Buffer.prototype.writeUInt32BE;
SlowBuffer.prototype.writeInt8 = Buffer.prototype.writeInt8;
SlowBuffer.prototype.writeInt16LE = Buffer.prototype.writeInt16LE;
SlowBuffer.prototype.writeInt16BE = Buffer.prototype.writeInt16BE;
SlowBuffer.prototype.writeInt32LE = Buffer.prototype.writeInt32LE;
SlowBuffer.prototype.writeInt32BE = Buffer.prototype.writeInt32BE;
SlowBuffer.prototype.writeFloatLE = Buffer.prototype.writeFloatLE;
SlowBuffer.prototype.writeFloatBE = Buffer.prototype.writeFloatBE;
SlowBuffer.prototype.writeDoubleLE = Buffer.prototype.writeDoubleLE;
SlowBuffer.prototype.writeDoubleBE = Buffer.prototype.writeDoubleBE;
});

require.define("assert",function(require,module,exports,__dirname,__filename,process){// UTILITY
var util = require('util');
var Buffer = require("buffer").Buffer;
var pSlice = Array.prototype.slice;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.message = options.message;
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
};
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (value === undefined) {
    return '' + value;
  }
  if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
    return value.toString();
  }
  if (typeof value === 'function' || value instanceof RegExp) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (typeof s == 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

assert.AssertionError.prototype.toString = function() {
  if (this.message) {
    return [this.name + ':', this.message].join(' ');
  } else {
    return [
      this.name + ':',
      truncate(JSON.stringify(this.actual, replacer), 128),
      this.operator,
      truncate(JSON.stringify(this.expected, replacer), 128)
    ].join(' ');
  }
};

// assert.AssertionError instanceof Error

assert.AssertionError.__proto__ = Error.prototype;

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!!!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (Buffer.isBuffer(actual) && Buffer.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = Object.keys(a),
        kb = Object.keys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (expected instanceof RegExp) {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail('Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail('Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};
});

require.define("util",function(require,module,exports,__dirname,__filename,process){var events = require('events');

exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (value && typeof value.inspect === 'function' &&
        // Filter out the util module, it's inspect function is special
        value !== exports &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      return value.inspect(recurseTimes);
    }

    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object_keys(value);
    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > 50) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
  return re instanceof RegExp ||
    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
  if (d instanceof Date) return true;
  if (typeof d !== 'object') return false;
  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
  return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
    var res = [];
    for (var key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
};

var Object_create = Object.create || function (prototype, properties) {
    // from es5-shim
    var object;
    if (prototype === null) {
        object = { '__proto__' : null };
    }
    else {
        if (typeof prototype !== 'object') {
            throw new TypeError(
                'typeof prototype[' + (typeof prototype) + '] != \'object\''
            );
        }
        var Type = function () {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
    }
    if (typeof properties !== 'undefined' && Object.defineProperties) {
        Object.defineProperties(object, properties);
    }
    return object;
};

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object_create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};
});

require.define("events",function(require,module,exports,__dirname,__filename,process){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = list.indexOf(listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};
});

require.define("buffer_ieee754",function(require,module,exports,__dirname,__filename,process){exports.readIEEE754 = function(buffer, offset, isBE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isBE ? 0 : (nBytes - 1),
      d = isBE ? 1 : -1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.writeIEEE754 = function(buffer, value, offset, isBE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isBE ? (nBytes - 1) : 0,
      d = isBE ? -1 : 1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};
});

require.define("/node_modules/testling/browser/harness.js",function(require,module,exports,__dirname,__filename,process){var Results = require('tap/lib/tap-results');
var Harness = require('tap/lib/tap-harness');

var Test = require('./test');
var output = require('./output');

module.exports = function () {
    var harness = new Harness(Test);
    harness.test = harness.test.bind(harness);
    harness.test.stream = output;
    harness.plan = harness.plan.bind(harness);
    
    harness.on('childEnd', function (child) {
        output.write(child.conf.name || '(unnamed test)')
        harness.results.list.forEach(function (res) {
            output.write(res)
        });
        harness.results.list.length = 0
    });
    
    var streamEnded = false;
    harness.on('end', function () {
        if (!streamEnded) {
            harness.results.list.forEach(function (res) {
                output.write(res);
            });
            harness.results.list.length = 0;
            output.end();
            streamEnded = true;
        }
    });
    
    harness.on('log', function (msg) {
        output.write({ 'log' : msg });
    });
    
    /*
    process.on('unhandledException', function (e) {
        harness.bailout('unhandled exception: ' + e.message)
    })
    */
    
    return harness;
};
});

require.define("/node_modules/tap/lib/tap-results.js",function(require,module,exports,__dirname,__filename,process){// A class for counting up results in a test harness.

module.exports = Results

var inherits = require("inherits")
  , EventEmitter = require("events").EventEmitter

inherits(Results, EventEmitter)

function Results (r) {
  //console.error("result constructor", r)
  this.ok = true
  this.addSet(r)
}

Results.prototype.addSet = function (r) {
  //console.error("add set of results", r)
  r = r || {ok: true}
  ; [ "todo"
    , "todoPass"
    , "todoFail"
    , "skip"
    , "skipPass"
    , "skipFail"
    , "pass"
    , "passTotal"
    , "fail"
    , "failTotal"
    , "tests"
    , "testsTotal" ].forEach(function (k) {
      this[k] = (this[k] || 0) + (r[k] || 0)
      //console.error([k, this[k]])
    }, this)

  this.ok = this.ok && r.ok && true
  this.bailedOut = this.bailedOut || r.bailedOut || false
  this.list = (this.list || []).concat(r.list || [])
  this.emit("set", this.list)
  //console.error("after addSet", this)
}

Results.prototype.add = function (r, addToList) {
  //console.error("add result", r)
  var pf = r.ok ? "pass" : "fail"
    , PF = r.ok ? "Pass" : "Fail"

  this.testsTotal ++
  this[pf + "Total"] ++

  if (r.skip) {
    this["skip" + PF] ++
    this.skip ++
  } else if (r.todo) {
    this["todo" + PF] ++
    this.todo ++
  } else {
    this.tests ++
    this[pf] ++
  }

  if (r.bailout || typeof r.bailout === "string") {
    // console.error("Bailing out in result")
    this.bailedOut = true
  }
  this.ok = !!(this.ok && r.ok)

  if (addToList === false) return
  this.list = this.list || []
  this.list.push(r)
  this.emit("result", r)
}
});

require.define("/node_modules/tap/node_modules/inherits/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"./inherits.js"}});

require.define("/node_modules/tap/node_modules/inherits/inherits.js",function(require,module,exports,__dirname,__filename,process){module.exports = inherits

function inherits (c, p, proto) {
  proto = proto || {}
  var e = {}
  ;[c.prototype, proto].forEach(function (s) {
    Object.getOwnPropertyNames(s).forEach(function (k) {
      e[k] = Object.getOwnPropertyDescriptor(s, k)
    })
  })
  c.prototype = Object.create(p.prototype, e)
  c.super = p
}

//function Child () {
//  Child.super.call(this)
//  console.error([this
//                ,this.constructor
//                ,this.constructor === Child
//                ,this.constructor.super === Parent
//                ,Object.getPrototypeOf(this) === Child.prototype
//                ,Object.getPrototypeOf(Object.getPrototypeOf(this))
//                 === Parent.prototype
//                ,this instanceof Child
//                ,this instanceof Parent])
//}
//function Parent () {}
//inherits(Child, Parent)
//new Child
});

require.define("/node_modules/tap/lib/tap-harness.js",function(require,module,exports,__dirname,__filename,process){// a thing that runs tests.
// Every "test" is also a harness.  If they do not have a harness,
// then they are attached to the defaut "global harness",
// which writes its results to stdout.


// TODO:
// - Bailout should stop running any tests.
// - "skip" in the test config obj should skip it.

module.exports = Harness
require("inherits")(Harness, require("events").EventEmitter)

var Results = require("./tap-results")
  , TapProducer = require("./tap-producer")
  , assert = require("./tap-assert")

function Harness (Test) {
  if (!(this instanceof Harness)) return new Harness(Test)

  //console.error("Test in "+this.constructor.name, Test)

  this._Test = Test
  this._plan = null
  this._children = []
  this._started = false

  this._testCount = 0
  this._planSum = 0

  this.results = new Results()
  // emit result events on the harness.
  //this.results.on("result", function (res) {
  //  console.error("proxying result ev from res to harness")
  //  this.emit("result", res)
  //}.bind(this))
  var me = this
  this.results.on("result", this.emit.bind(this, "result"))

  var p = this.process.bind(this)
  this.process = function () {
    this._started = true
    process.nextTick(p)
  }

  this.output = new TapProducer()
  Harness.super.call(this)
}

// this function actually only gets called bound to
// the Harness object, and on process.nextTick.  Even if
// passed as an event handler, everything *else* will
// happen before it gets called.
Harness.prototype.process = function () {
  //console.error("harness process")
  // "end" can emit multiple times, so only actually move on
  // to the next test if the current one is actually over.
  // TODO: multiple in-process tests, if all are marked "async"
  if (this._current) {
    if (!this._current._ended) return
    // handle the current one before moving onto the next.
    this.childEnd(this._current)
  }
  var skip = true
  while (skip) {
    //console.error("checking for skips")
    var current = this._current = this._children.shift()
    if (current) {
      skip = current.conf.skip
      if (skip) {
        //console.error("add a failure for the skipping")
        this.results.add(assert.fail(current.conf.name
                                    ,{skip:true, diag:false}))
      }
    } else skip = false
  }

  // keep processing through skipped tests, instead of running them.
  if (current && this._bailedOut) {
    return this.process()
  }

  //console.error("got current?", !!current)
  if (current) {
    current.on("end", this.process)
    current.emit("ready")
    //console.error("emitted ready")
    //console.error("_plan", this._plan, this.constructor.name)
  } else {
    //console.error("Harness process: no more left.  ending")
    if (this._endNice) {
      this._endNice()
    } else {
      this.end()
    }
  }
}

Harness.prototype.end = function () {
  if (this._children.length) {
    return this.process()
  }
  //console.error("harness end", this.constructor.name)
  if (this._bailedOut) return

  // can't call .end() more than once.
  if (this._ended) {
    //console.error("adding failure for end calling")
    this.results.add(assert.fail("end called more than once"))
  }

  // see if the plan is completed properly, if there was one.
  if (this._plan !== null) {
    var total = this._testCount
    if (total !== this._plan) {
      this.results.add(assert.equal(total, this._plan, "test count != plan"))
    }
    this._plan = total
  }

  //console.error("setting ended true", this.constructor.name)
  this._ended = true
  this.emit("end")
}

Harness.prototype.plan = function (p) {
  //console.error("setting plan", new Error().stack)
  if (this._plan !== null) {
    //console.error("about to add failure for calling plan")
    return this.results.add(assert.fail("plan set multiple times"))
  }
  this._plan = p
  if (p === 0 || this.results.testsTotal) {
    this.end()
  }
}

Harness.prototype.childEnd = function (child) {
  //console.error("childEnd")
  this._testCount ++
  this._planSum += child._plan
  //console.error("adding set of child.results")
  this.results.addSet(child.results)
  this.emit("childEnd", child)
  // was this planned?
  if (this._plan === this._testCount) {
    //console.error("plan", [this._plan, this._testCount])
    return this.end()
  }
}

function copyObj(o) {
  var copied = {}
  Object.keys(o).forEach(function (k) { copied[k] = o[k] })
  return copied
}

Harness.prototype.test = function test (name, conf, cb) {
  if (this._bailedOut) return

  if (typeof conf === "function") cb = conf, conf = null
  if (typeof name === "object") conf = name, name = null
  if (typeof name === "function") cb = name, name = null

  conf = (conf ? copyObj(conf) : {})
  name = name || ""

  //console.error("making test", [name, conf, cb])

  // timeout: value in milliseconds. Defaults to 30s
  // Set to Infinity to have no timeout.
  if (isNaN(conf.timeout)) conf.timeout = 30000
  var t = new this._Test(this, name, conf)
  var self = this
  if (cb) {
    //console.error("attaching cb to ready event")
    t.on("ready", function () {
      if (!isNaN(conf.timeout) && isFinite(conf.timeout)) {
        var timer = setTimeout(this.timeout.bind(this), conf.timeout)
        var clear = clearTimeout.bind(null, timer)
        t.on("end", clear)
        t.on("bailout", function (message) {
          self.bailout(message)
          clear()
        })
      }
    })
    t.on("ready", cb.bind(t, t))
    // proxy the child results to this object.
    //t.on("result", function (res) {
    //  console.error("in harness, proxying result up")
    //  t.results.add(res)
    //})
  }
  return t
}

Harness.prototype.bailout = function (message) {
  // console.error("Harness bailout", this.constructor.name)
  message = message || ""
  //console.error("adding bailout message result")
  this.results.add({bailout: message})
  // console.error(">>> results after bailout" , this.results)
  this._bailedOut = true
  this.emit("bailout", message)
  this.output.end({bailout: message})
}

Harness.prototype.add = function (child) {
  //console.error("adding child")
  this._children.push(child)
  if (!this._started) this.process()
}

// the tearDown function is *always* guaranteed to happen.
// Even if there's a bailout.
Harness.prototype.tearDown = function (fn) {
  this.on("end", fn)
}
});

require.define("/node_modules/tap/lib/tap-producer.js",function(require,module,exports,__dirname,__filename,process){module.exports = TapProducer

var Results = require("./tap-results")
  , inherits = require("inherits")
  , yamlish = require("yamlish")

TapProducer.encode = function (result, diag) {
  var tp = new TapProducer(diag)
    , out = ""
  tp.on("data", function (c) { out += c })
  if (Array.isArray(result)) {
    result.forEach(tp.write, tp)
  } else tp.write(result)
  tp.end()
  return out
}

inherits(TapProducer, require("stream").Stream)
function TapProducer (diag) {
  TapProducer.super.call(this)
  this.diag = diag
  this.count = 0
  this.readable = this.writable = true
  this.results = new Results
}

TapProducer.prototype.trailer = true

TapProducer.prototype.write = function (res) {
  // console.error("TapProducer.write", res)
  if (typeof res === "function") throw new Error("wtf?")
  if (!this.writable) this.emit("error", new Error("not writable"))

  if (!this._didHead) {
    this.emit("data", "TAP version 13\n")
    this._didHead = true
  }

  var diag = res.diag
  if (diag === undefined) diag = this.diag

  this.emit("data", encodeResult(res, this.count + 1, diag))

  if (typeof res === "string") return true

  if (res.bailout) {
    var bo = "bail out!"
    if (typeof res.bailout === "string") bo += " " + res.bailout
    this.emit("data", bo)
    return
  }
  this.results.add(res, false)

  this.count ++
}

TapProducer.prototype.end = function (res) {
  if (res) this.write(res)
  // console.error("TapProducer end", res, this.results)
  this.emit("data", "\n1.."+this.results.testsTotal+"\n")
  if (this.trailer && typeof this.trailer !== "string") {
    // summary trailer.
    var trailer = "tests "+this.results.testsTotal + "\n"
    if (this.results.pass) {
      trailer += "pass  " + this.results.pass + "\n"
    }
    if (this.results.fail) {
      trailer += "fail  " + this.results.fail + "\n"
    }
    if (this.results.skip) {
      trailer += "skip  "+this.results.skip + "\n"
    }
    if (this.results.todo) {
      trailer += "todo  "+this.results.todo + "\n"
    }
    if (this.results.bailedOut) {
      trailer += "bailed out" + "\n"
    }

    if (this.results.testsTotal === this.results.pass) {
      trailer += "\nok\n"
    }
    this.trailer = trailer
  }
  if (this.trailer) this.write(this.trailer)
  this.writable = false
  this.emit("end", null, this.count, this.ok)
}

function encodeResult (res, count, diag) {
  // console.error(res, count, diag)
  if (typeof res === "string") {
    res = res.split(/\r?\n/).map(function (l) {
      if (!l.trim()) return l.trim()
      return "# " + l
    }).join("\n")
    if (res.substr(-1) !== "\n") res += "\n"
    return res
  }

  if (res.bailout) return ""


  if (!!process.env.TAP_NODIAG) diag = false
  else if (!!process.env.TAP_DIAG) diag = true
  else if (diag === undefined) diag = !res.ok

  var output = ""
  res.name = res.name && ("" + res.name).trim()
  output += ( !res.ok ? "not " : "") + "ok " + count
            + ( !res.name ? ""
              : " " + res.name.replace(/[\r\n]/g, " ") )
            + ( res.skip ? " # SKIP"
              : res.todo ? " # TODO"
              : "" )
            + "\n"

  if (!diag) return output
  var d = {}
    , dc = 0
  Object.keys(res).filter(function (k) {
    return k !== "ok" && k !== "name" && k !== "id"
  }).forEach(function (k) {
    dc ++
    d[k] = res[k]
  })
  //console.error(d, "about to encode")
  if (dc > 0) output += "  ---"+yamlish.encode(d)+"\n  ...\n"
  return output
}
});

require.define("/node_modules/tap/node_modules/yamlish/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"yamlish.js"}});

require.define("/node_modules/tap/node_modules/yamlish/yamlish.js",function(require,module,exports,__dirname,__filename,process){exports.encode = encode
exports.decode = decode

var seen = []
function encode (obj, indent) {
  var deep = arguments[2]
  if (!indent) indent = "  "

  if (obj instanceof String ||
      Object.prototype.toString.call(obj) === "[object String]") {
    obj = obj.toString()
  }

  if (obj instanceof Number ||
      Object.prototype.toString.call(obj) === "[object Number]") {
    obj = obj.valueOf()
  }

  // take out the easy ones.
  switch (typeof obj) {
    case "string":
      obj = obj.trim()
      if (obj.indexOf("\n") !== -1) {
        return "|\n" + indent + obj.split(/\r?\n/).join("\n"+indent)
      } else {
        return (obj)
      }

    case "number":
      return obj.toString(10)

    case "function":
      return encode(obj.toString(), indent, true)

    case "boolean":
      return obj.toString()

    case "undefined":
      // fallthrough
    case "object":
      // at this point we know it types as an object
      if (!obj) return "~"

      if (obj instanceof Date ||
          Object.prototype.toString.call(obj) === "[object Date]") {
        return JSON.stringify("[Date " + obj.toISOString() + "]")
      }

      if (obj instanceof RegExp ||
          Object.prototype.toString.call(obj) === "[object RegExp]") {
        return JSON.stringify(obj.toString())
      }

      if (obj instanceof Boolean ||
          Object.prototype.toString.call(obj) === "[object Boolean]") {
        return obj.toString()
      }

      if (seen.indexOf(obj) !== -1) {
        return "[Circular]"
      }
      seen.push(obj)

      if (typeof Buffer === "function" &&
          typeof Buffer.isBuffer === "function" &&
          Buffer.isBuffer(obj)) return obj.inspect()

      if (obj instanceof Error) {
        var o = { name: obj.name
                , message: obj.message
                , type: obj.type }

        if (obj.code) o.code = obj.code
        if (obj.errno) o.errno = obj.errno
        if (obj.type) o.type = obj.type
        obj = o
      }

      var out = ""

      if (Array.isArray(obj)) {
        var out = "\n" + indent + "- " +obj.map(function (item) {
          return encode(item, indent + "  ", true)
        }).join("\n"+indent + "- ")
        break
      }

      // an actual object
      var keys = Object.keys(obj)
        , niceKeys = keys.map(function (k) {
            return (k.match(/^[a-zA-Z0-9_]+$/) ? k : JSON.stringify(k)) + ": "
          })
      //console.error(keys, niceKeys, obj)
      var maxLength = Math.max.apply(Math, niceKeys.map(function (k) {
            return k.length
          }).concat(0))
      //console.error(niceKeys, maxLength)

      var spaces = new Array(maxLength + 1).join(" ")

      if (!deep) indent += "  "
      out = "\n" + indent + keys.map(function (k, i) {
        var niceKey = niceKeys[i]
        return niceKey + spaces.substr(niceKey.length)
                       + encode(obj[k], indent + "  ", true)
      }).join("\n" + indent)
      break

    default: return ""
  }
  if (!deep) seen.length = 0
  return out
}

function decode (str) {
  var v = str.trim()
    , d
    , dateRe = /^\[Date ([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2})?(?:\.[0-9]{3})?(?:[A-Z]+)?)\]$/

  if (v === "~") return null

  try {
    var jp = JSON.parse(str)
  } catch (e) {
    var jp = ""
  }

  if (jp &&
      typeof jp === "string" &&
      (d = jp.match(dateRe)) &&
      (d = Date.parse(d[1]))) {
    return new Date(d)
  }

  if (typeof jp === "boolean") return jp
  if (v && !isNaN(v)) return parseInt(v, 10)

  // something interesting.
  var lines = str.split(/\r?\n/)
  // check if it's some kind of string or something.
  // if the first line is > or | then it's a wrapping indented string.
  // if the first line is blank, and there are many lines,
  // then it's an array or object.
  // otherwise, it's just ""
  var first = lines.shift().trim()
  if (lines.length) lines = undent(lines)
  switch (first) {
    case "|":
      return lines.join("\n")
    case ">":
      return lines.join("\n").split(/\n{2,}/).map(function (l) {
        return l.split(/\n/).join(" ")
      }).join("\n")
    default:
      if (!lines.length) return first
      // array or object.
      // the first line will be either "- value" or "key: value"
      return lines[0].charAt(0) === "-" ? decodeArr(lines) : decodeObj(lines)
  }
}

function decodeArr (lines) {
  var out = []
    , key = 0
    , val = []
  for (var i = 0, l = lines.length; i < l; i ++) {
    // if it starts with a -, then it's a new thing
    var line = lines[i]
    if (line.charAt(0) === "-") {
      if (val.length) {
        out[key ++] = decode(val.join("\n"))
        val.length = 0
      }
      val.push(line.substr(1).trim())
    } else if (line.charAt(0) === " ") {
      val.push(line)
    } else return []
  }
  if (val.length) {
    out[key ++] = decode(val.join("\n"))
  }
  return out
}

function decodeObj (lines) {
  var out = {}
    , val = []
    , key = null

  for (var i = 0, l = lines.length; i < l; i ++) {
    var line = lines[i]
    if (line.charAt(0) === " ") {
      val.push(line)
      continue
    }
    // some key:val
    if (val.length) {
      out[key] = decode(val.join("\n"))
      val.length = 0
    }
    // parse out the quoted key
    var first
    if (line.charAt(0) === "\"") {
      for (var ii = 1, ll = line.length, esc = false; ii < ll; ii ++) {
        var c = line.charAt(ii)
        if (c === "\\") {
          esc = !esc
        } else if (c === "\"" && !esc) {
          break
        }
      }
      key = JSON.parse(line.substr(0, ii + 1))
      line = line.substr(ii + 1)
      first = line.substr(line.indexOf(":") + 1).trim()
    } else {
      var kv = line.split(":")
      key = kv.shift()
      first = kv.join(":").trim()
    }
    // now we've set a key, and "first" has the first line of the value.
    val.push(first.trim())
  }
  if (val.length) out[key] = decode(val.join("\n"))
  return out
}

function undent (lines) {
  var i = lines[0].match(/^\s*/)[0].length
  return lines.map(function (line) {
    return line.substr(i)
  })
}


// XXX Turn this into proper tests.
if (require.main === module) {
var obj = [{"bigstring":new Error().stack}
          ,{ar:[{list:"of"},{some:"objects"}]}
          ,{date:new Date()}
          ,{"super huge string":new Error().stack}
          ]

Date.prototype.toJSON = function (k, val) {
  console.error(k, val, this)
  return this.toISOString() + " (it's a date)"
}

var enc = encode(obj)
  , dec = decode(enc)
  , encDec = encode(dec)

console.error(JSON.stringify({ obj : obj
                             , enc : enc.split(/\n/)
                             , dec : dec }, null, 2), encDec === enc)

var num = 100
  , encNum = encode(num)
  , decEncNum = decode(encNum)
console.error([num, encNum, decEncNum])
}
});

require.define("stream",function(require,module,exports,__dirname,__filename,process){var events = require('events');
var util = require('util');

function Stream() {
  events.EventEmitter.call(this);
}
util.inherits(Stream, events.EventEmitter);
module.exports = Stream;
// Backwards-compat with node 0.4.x
Stream.Stream = Stream;

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once, and
  // only when all sources have ended.
  if (!dest._isStdio && (!options || options.end !== false)) {
    dest._pipeCount = dest._pipeCount || 0;
    dest._pipeCount++;

    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (this.listeners('error').length === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('end', cleanup);
    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('end', cleanup);
  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};
});

require.define("/node_modules/tap/lib/tap-assert.js",function(require,module,exports,__dirname,__filename,process){// an assert module that returns tappable data for each assertion.
var difflet = require('difflet')
  , deepEqual = require('deep-equal')
  , bufferEqual = require('buffer-equal')

module.exports = assert

var syns = {}
  , id = 1

function assert (ok, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)

  //console.error("assert %j", [ok, message, extra])
  //if (extra && extra.skip) return assert.skip(message, extra)
  //console.error("assert", [ok, message, extra])
  ok = !!ok
  var res = { id : id ++, ok: ok }

  var caller = getCaller(extra && extra.error)
  if (extra && extra.error) {
    res.type = extra.error.name
    res.message = extra.error.message
    res.code = extra.error.code
             || extra.error.type
    res.errno = extra.error.errno
    delete extra.error
  }
  if (caller.file) {
    res.file = caller.file
    res.line = +caller.line
    res.column = +caller.column
  }
  res.stack = caller.stack

  res.name = message || "(unnamed assert)"

  if (extra) Object.keys(extra).forEach(function (k) {
    if (!res.hasOwnProperty(k)) res[k] = extra[k]
  })

  // strings and objects are hard to diff by eye
  if (!ok &&
      res.hasOwnProperty("found") &&
      res.hasOwnProperty("wanted") &&
      res.found !== res.wanted) {
    if (typeof res.wanted !== typeof res.found ||
        typeof res.wanted === "object" && (!res.found || !res.wanted)) {
      res.type = { found: typeof found
                 , wanted: typeof wanted }
    } else if (typeof res.wanted === "string") {
      res.diff = diffString(res.found, res.wanted)
    } else if (typeof res.wanted === "object") {
      res.diff = diffObject(res.found, res.wanted)
    }
  }

  //console.error("assert return", res)

  return res
}
assert.ok = assert
syns.ok = [ "true", "assert" ]


function notOk (ok, message, extra) {
  return assert(!ok, message, extra)
}
assert.notOk = notOk
syns.notOk = [ "false", "notok" ]

function error (er, message, extra) {
  if (!er) {
    // just like notOk(er)
    return assert(!er, message, extra)
  }
  message = message || er.message
  extra = extra || {}
  extra.error = er
  return assert.fail(message, extra)
}
assert.error = error
syns.error = [ "ifError", "ifErr", "iferror" ]


function pass (message, extra) {
  return assert(true, message, extra)
}
assert.pass = pass

function fail (message, extra) {
  //console.error("assert.fail", [message, extra])
  //if (extra && extra.skip) return assert.skip(message, extra)
  return assert(false, message, extra)
}
assert.fail = fail

function skip (message, extra) {
  //console.error("assert.skip", message, extra)
  if (!extra) extra = {}
  return { id: id ++, skip: true, name: message || "" }
}
assert.skip = skip

function throws (fn, wanted, message, extra) {
  if (typeof wanted === "string") {
    extra = message
    message = wanted
    wanted = null
  }

  if (extra && extra.skip) return assert.skip(message, extra)

  var found = null
  try {
    fn()
  } catch (e) {
    found = { name: e.name, message: e.message }
  }

  extra = extra || {}

  extra.found = found
  if (wanted) {
    wanted = { name: wanted.name, message: wanted.message }
    extra.wanted = wanted
  }

  if (!message) {
    message = "Expected to throw"
    if (wanted) message += ": "+wanted.name + " " + wanted.message
  }

  return (wanted) ? assert.similar(found, wanted, message, extra)
                  : assert.ok(found, message, extra)
}
assert.throws = throws


function doesNotThrow (fn, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  var found = null
  try {
    fn()
  } catch (e) {
    found = {name: e.name, message: e.message}
  }
  message = message || "Should not throw"

  return assert.equal(found, null, message, extra)
}
assert.doesNotThrow = doesNotThrow


function equal (a, b, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  extra = extra || {}
  message = message || "should be equal"
  extra.found = a
  extra.wanted = b
  return assert(a === b, message, extra)
}
assert.equal = equal
syns.equal = ["equals"
             ,"isEqual"
             ,"is"
             ,"strictEqual"
             ,"strictEquals"]


function equivalent (a, b, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  var extra = extra || {}
  message = message || "should be equivalent"
  extra.found = a
  extra.wanted = b

  if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) {
    return assert(bufferEqual(a, b), message, extra)
  } else {
    return assert(deepEqual(a, b), message, extra)
  }
}
assert.equivalent = equivalent
syns.equivalent = ["isEquivalent"
                  ,"looseEqual"
                  ,"looseEquals"
                  ,"isDeeply"
                  ,"same"
                  ,"deepEqual"
                  ,"deepEquals"]


function inequal (a, b, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  extra = extra || {}
  message = message || "should not be equal"
  extra.found = a
  extra.doNotWant = b
  return assert(a !== b, message, extra)
}
assert.inequal = inequal
syns.inequal = ["notEqual"
               ,"notEquals"
               ,"isNotEqual"
               ,"isNot"
               ,"not"
               ,"doesNotEqual"
               ,"isInequal"]


function inequivalent (a, b, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  extra = extra || {}
  message = message || "should not be equivalent"
  extra.found = a
  extra.doNotWant = b
  
  if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) {
    return assert(!bufferEqual(a, b), message, extra)
  } else {
    return assert(!deepEqual(a, b), message, extra)
  }
}
assert.inequivalent = inequivalent
syns.inequivalent = ["notEquivalent"
                    ,"notDeepEqual"
                    ,"notDeeply"
                    ,"notSame"
                    ,"isNotDeepEqual"
                    ,"isNotDeeply"
                    ,"isNotEquivalent"
                    ,"isInequivalent"]

function similar (a, b, message, extra, flip) {
  if (extra && extra.skip) return assert.skip(message, extra)
  // test that a has all the fields in b
  message = message || "should be similar"

  if (typeof a === "string" &&
      (Object.prototype.toString.call(b) === "[object RegExp]")) {
    extra = extra || {}
    extra.pattern = b
    extra.string = a
    var ok = a.match(b)
    extra.match = ok
    if (flip) ok = !ok
    return assert.ok(ok, message, extra)
  }

  var isObj = assert(a && typeof a === "object", message, extra)
  if (!isObj.ok) {
    // not an object
    if (a == b) isObj.ok = true
    if (flip) isObj.ok = !isObj.ok
    return isObj
  }

  var eq = flip ? inequivalent : equivalent
  return eq(selectFields(a, b), b, message, extra)
}
assert.similar = similar
syns.similar = ["isSimilar"
               ,"has"
               ,"hasFields"
               ,"like"
               ,"isLike"]

function dissimilar (a, b, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  message = message || "should be dissimilar"
  return similar(a, b, message, extra, true)
}
assert.dissimilar = dissimilar
syns.dissimilar = ["unsimilar"
                  ,"notSimilar"
                  ,"unlike"
                  ,"isUnlike"
                  ,"notLike"
                  ,"isNotLike"
                  ,"doesNotHave"
                  ,"isNotSimilar"
                  ,"isDissimilar"]

function type (thing, t, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  var name = t
  if (typeof name === "function") name = name.name || "(anonymous ctor)"
  //console.error("name=%s", name)
  message = message || "type is "+name
  var type = typeof thing
  //console.error("type=%s", type)
  if (!thing && type === "object") type = "null"
  if (type === "object" && t !== "object") {
    if (typeof t === "function") {
      //console.error("it is a function!")
      extra = extra || {}
      extra.found = Object.getPrototypeOf(thing).constructor.name
      extra.wanted = name
      //console.error(thing instanceof t, name)
      return assert.ok(thing instanceof t, message, extra)
    }

    //console.error("check prototype chain")
    // check against classnames or objects in prototype chain, as well.
    // type(new Error("asdf"), "Error")
    // type(Object.create(foo), foo)
    var p = thing
    while (p = Object.getPrototypeOf(p)) {
      if (p === t || p.constructor && p.constructor.name === t) {
        type = name
        break
      }
    }
  }
  //console.error(type, name, type === name)
  return assert.equal(type, name, message, extra)
}
assert.type = type
syns.type = ["isa"]

// synonyms are helpful.
Object.keys(syns).forEach(function (c) {
  syns[c].forEach(function (s) {
    Object.defineProperty(assert, s, { value: assert[c], enumerable: false })
  })
})

// helpers below

function selectFields (a, b) {
  // get the values in A of the fields in B
  var ret = Array.isArray(b) ? [] : {}
  Object.keys(b).forEach(function (k) {
    if (!a.hasOwnProperty(k)) return
    var v = b[k]
      , av = a[k]
    if (v && av && typeof v === "object" && typeof av === "object"
       && !(v instanceof Date)
       && !(v instanceof RegExp)
       && !(v instanceof String)
       && !(v instanceof Boolean)
       && !(v instanceof Number)
       && !(Array.isArray(v))) {
      ret[k] = selectFields(av, v)
    } else ret[k] = av
  })
  return ret
}

function sortObject (obj) {
  if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) {
    return obj
  }
   
  return Object.keys(obj).sort().reduce(function (acc, key) {
    acc[key] = sortObject(obj[key])
    return acc
  }, {})
}

function stringify (a) {
  return JSON.stringify(sortObject(a), (function () {
    var seen = []
      , keys = []
    return function (key, val) {
      var s = seen.indexOf(val)
      if (s !== -1) {
        return "[Circular: "+keys[s]+"]"
      }
      if (val && typeof val === "object" || typeof val === "function") {
        seen.push(val)
        keys.push(val["!"] || val.name || key || "<root>")
        if (typeof val === "function") {
          return val.toString().split(/\n/)[0]
        } else if (typeof val.toUTCString === "function") {
          return val.toUTCString()
        }
      }
      return val
  }})())
}

function diffString (f, w) {
  if (w === f) return null
  var p = 0
    , l = w.length
  while (p < l && w.charAt(p) === f.charAt(p)) p ++
  w = stringify(w).substr(1).replace(/"$/, "")
  f = stringify(f).substr(1).replace(/"$/, "")
  return diff(f, w, p)
}

function diffObject (f, w) {
  return difflet({ indent : 2, comment : true }).compare(w, f)
}

function diff (f, w, p) {
  if (w === f) return null
  var i = p || 0 // it's going to be at least p. JSON can only be bigger.
    , l = w.length
  while (i < l && w.charAt(i) === f.charAt(i)) i ++
  var pos = Math.max(0, i - 20)
  w = w.substr(pos, 40)
  f = f.substr(pos, 40)
  var pointer = i - pos
  return "FOUND:  "+f+"\n"
       + "WANTED: "+w+"\n"
       + (new Array(pointer + 9).join(" "))
       + "^ (at position = "+p+")"
}

function getCaller (er) {
  // get the first file/line that isn't this file.
  if (!er) er = new Error
  var stack = er.stack || ""
  stack = stack.split(/\n/)
  for (var i = 1, l = stack.length; i < l; i ++) {
    var s = stack[i].match(/\(([^):]+):([0-9]+):([0-9]+)\)$/)
    if (!s) continue
    var file = s[1]
      , line = +s[2]
      , col = +s[3]
    if (file.indexOf(__dirname) === 0) continue
    if (file.match(/tap-test\/test.js$/)) continue
    else break
  }
  var res = {}
  if (file && file !== __filename && !file.match(/tap-test\/test.js$/)) {
    res.file = file
    res.line = line
    res.column = col
  }

  res.stack = stack.slice(1).map(function (s) {
    return s.replace(/^\s*at\s*/, "")
  })

  return res
}


});

require.define("/node_modules/tap/node_modules/difflet/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/tap/node_modules/difflet/index.js",function(require,module,exports,__dirname,__filename,process){var traverse = require('traverse');
var Stream = require('stream').Stream;
var charm = require('charm');
var deepEqual = require('deep-equal');

var exports = module.exports = function (opts_) {
    var fn = difflet.bind(null, opts_);
    fn.compare = function (prev, next) {
        var opts = Object.keys(opts_ || {}).reduce(function (acc, key) {
            acc[key] = opts_[key];
            return acc;
        }, {});
        var s = opts.stream = new Stream;
        var data = '';
        s.write = function (buf) { data += buf };
        s.end = function () {};
        s.readable = true;
        s.writable = true;
        
        difflet(opts, prev, next);
        return data;
    };
    return fn;
};

exports.compare = function (prev, next) {
    return exports({}).compare(prev, next);
};

function difflet (opts, prev, next) {
    var stream = opts.stream || new Stream;
    if (!opts.stream) {
        stream.readable = true;
        stream.writable = true;
        stream.write = function (buf) { this.emit('data', buf) };
        stream.end = function () { this.emit('end') };
    }
    
    if (!opts) opts = {};
    if (opts.start === undefined && opts.stop === undefined) {
        var c = charm(stream);
        opts.start = function (type) {
            c.foreground({
                inserted : 'green',
                updated : 'blue',
                deleted : 'red',
                comment : 'cyan',
            }[type]);
            c.display('bright');
        };
        opts.stop = function (type) {
            c.display('reset');
        };
    }
    var write = function (buf) {
        if (opts.write) opts.write(buf, stream)
        else stream.write(buf)
    };
    
    var commaFirst = opts.comma === 'first';
    
    var stringify = function (node, params) {
        return stringifier.call(this, true, node, params || opts);
    };
    var plainStringify = function (node, params) {
        return stringifier.call(this, false, node, params || opts);
    };
    
    var levels = 0;
    function set (type) {
        if (levels === 0) opts.start(type, stream);
        levels ++;
    }
    
    function unset (type) {
        if (--levels === 0) opts.stop(type, stream);
    }
    
    function stringifier (insertable, node, opts) {
        var indent = opts.indent;
        
        if (insertable) {
            var prevNode = traverse.get(prev, this.path || []);
        }
        var inserted = insertable && prevNode === undefined;
        
        var indentx = indent ? Array(
            ((this.path || []).length + 1) * indent + 1
        ).join(' ') : '';
        if (commaFirst) indentx = indentx.slice(indent);
        
        if (Array.isArray(node)) {
            var updated = (prevNode || traverse.has(prev, this.path))
                && !Array.isArray(prevNode);
            if (updated) {
                set('updated');
            }
            
            if (opts.comment && !Array.isArray(prevNode)) {
                indent = 0;
            }
            
            this.before(function () {
                if (inserted) set('inserted');
                if (indent && commaFirst) {
                    if ((this.path || []).length === 0
                    || Array.isArray(this.parent.node)) {
                        write('[ ');
                    }
                    else write('\n' + indentx + '[ ');
                }
                else if (indent) {
                    write('[\n' + indentx);
                }
                else {
                    write('[');
                }
            });
            
            this.post(function (child) {
                if (!child.isLast && !(indent && commaFirst)) {
                    write(',');
                }
                
                var prev = prevNode && prevNode[child.key];
                if (indent && opts.comment && child.node !== prev
                && (typeof child.node !== 'object' || typeof prev !== 'object')
                ) {
                    set('comment');
                    write(' // != ');
                    traverse(prev).forEach(function (x) {
                        plainStringify.call(this, x, { indent : 0 });
                    });
                    unset('comment');
                }
                
                if (!child.isLast) {
                    if (indent && commaFirst) {
                        write('\n' + indentx + ', ');
                    }
                    else if (indent) {
                        write('\n' + indentx);
                    }
                }
            });
            
            this.after(function () {
                if (indent && commaFirst) write('\n' + indentx);
                else if (indent) write('\n' + indentx.slice(indent));
                
                write(']');
                if (updated) unset('updated');
                if (inserted) unset('inserted');
            });
        }
        else if (isRegExp(node)) {
            this.block();
            
            if (inserted) {
                set('inserted');
                write(node.toString());
                unset('inserted');
            }
            else if (insertable && prevNode !== node) {
                set('updated');
                write(node.toString());
                unset('updated');
            }
            else write(node.toString());
        }
        else if (typeof node === 'object'
        && node && typeof node.inspect === 'function') {
            this.block();
            if (inserted) {
                set('inserted');
                write(node.inspect());
                unset('inserted');
            }
            else if (!(prevNode && typeof prevNode.inspect === 'function'
            && prevNode.inspect() === node.inspect())) {
                set('updated');
                write(node.inspect());
                unset('updated');
            }
            else write(node.inspect());
        }
        else if (typeof node == 'object') {
            var insertedKey = false;
            var deleted = insertable && typeof prevNode === 'object'
                ? Object.keys(prevNode).filter(function (key) {
                    return !Object.hasOwnProperty.call(node, key);
                })
                : []
            ;
            
            this.before(function () {
                if (inserted) set('inserted');
                write(indent && commaFirst && !this.isRoot
                    ? '\n' + indentx + '{ '
                    : '{'
                );
            });
            
            this.pre(function (x, key) {
                if (insertable) {
                    var obj = traverse.get(prev, this.path.concat(key));
                    if (obj === undefined) {
                        insertedKey = true;
                        set('inserted');
                    }
                }
                
                if (indent && !commaFirst) write('\n' + indentx);
                
                plainStringify(key);
                write(indent ? ' : ' : ':');
            });
            
            this.post(function (child) {
                if (!child.isLast && !(indent && commaFirst)) {
                    write(',');
                }
                
                if (child.isLast && deleted.length) {
                    if (insertedKey) unset('inserted');
                    insertedKey = false;
                }
                else if (insertedKey) {
                    unset('inserted');
                    insertedKey = false;
                }
                
                var prev = prevNode && prevNode[child.key];
                if (indent && opts.comment && child.node !== prev
                && (typeof child.node !== 'object' || typeof prev !== 'object')
                ) {
                    set('comment');
                    write(' // != ');
                    traverse(prev).forEach(function (x) {
                        plainStringify.call(this, x, { indent : 0 });
                    });
                    unset('comment');
                }
                
                if (child.isLast && deleted.length) {
                    if (insertedKey) unset('inserted');
                    insertedKey = false;
                    
                    if (indent && commaFirst) {
                        write('\n' + indentx + ', ')
                    }
                    else if (opts.comment && indent) {
                        write('\n' + indentx);
                    }
                    else if (indent) {
                        write(',\n' + indentx);
                    }
                    else write(',');
                }
                else {
                    if (!child.isLast) {
                        if (indent && commaFirst) {
                            write('\n' + indentx + ', ');
                        }
                    }
                }
            });
            
            this.after(function () {
                if (inserted) unset('inserted');
                
                if (deleted.length) {
                    if (indent && !commaFirst
                    && Object.keys(node).length === 0) {
                        write('\n' + indentx);
                    }
                    
                    set('deleted');
                    deleted.forEach(function (key, ix) {
                        if (indent && opts.comment) {
                            unset('deleted');
                            set('comment');
                            write('// ');
                            unset('comment');
                            set('deleted');
                        }
                        
                        plainStringify(key);
                        write(indent ? ' : ' : ':');
                        traverse(prevNode[key]).forEach(function (x) {
                            plainStringify.call(this, x, { indent : 0 });
                        });
                        
                        var last = ix === deleted.length - 1;
                        if (insertable && !last) {
                            if (indent && commaFirst) {
                                write('\n' + indentx + ', ');
                            }
                            else if (indent) {
                                write(',\n' + indentx);
                            }
                            else write(',');
                        }
                    });
                    unset('deleted');
                }
                
                if (commaFirst && indent) {
                    write(indentx.slice(indent) + ' }');
                }
                else if (indent) {
                    write('\n' + indentx.slice(indent) + '}');
                }
                else write('}');
            });
        }
        else {
            var changed = false;
            
            if (inserted) set('inserted');
            else if (insertable && !deepEqual(prevNode, node)) {
                changed = true;
                set('updated');
            }
            
            if (typeof node === 'string') {
                write('"' + node.toString().replace(/"/g, '\\"') + '"');
            }
            else if (isRegExp(node)) {
                write(node.toString());
            }
            else if (typeof node === 'function') {
                write(node.name
                    ? '[Function: ' + node.name + ']'
                    : '[Function]'
                );
            }
            else if (node === undefined) {
                write('undefined');
            }
            else if (node === null) {
                write('null');
            }
            else {
                write(node.toString());
            }
            
            if (inserted) unset('inserted');
            else if (changed) unset('updated');
        }
    }
    
    if (opts.stream) {
        traverse(next).forEach(stringify);
    }
    else process.nextTick(function () {
        traverse(next).forEach(stringify);
        stream.emit('end');
    });
    
    return stream;
}

function isRegExp (node) {
    return node instanceof RegExp || (node
        && typeof node.test === 'function' 
        && typeof node.exec === 'function'
        && typeof node.compile === 'function'
        && node.constructor && node.constructor.name === 'RegExp'
    );
}
});

require.define("/node_modules/tap/node_modules/difflet/node_modules/traverse/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/tap/node_modules/difflet/node_modules/traverse/index.js",function(require,module,exports,__dirname,__filename,process){var traverse = module.exports = function (obj) {
    return new Traverse(obj);
};

function Traverse (obj) {
    this.value = obj;
}

Traverse.prototype.get = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) {
            node = undefined;
            break;
        }
        node = node[key];
    }
    return node;
};

Traverse.prototype.has = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) {
            return false;
        }
        node = node[key];
    }
    return true;
};

Traverse.prototype.set = function (ps, value) {
    var node = this.value;
    for (var i = 0; i < ps.length - 1; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) node[key] = {};
        node = node[key];
    }
    node[ps[i]] = value;
    return value;
};

Traverse.prototype.map = function (cb) {
    return walk(this.value, cb, true);
};

Traverse.prototype.forEach = function (cb) {
    this.value = walk(this.value, cb, false);
    return this.value;
};

Traverse.prototype.reduce = function (cb, init) {
    var skip = arguments.length === 1;
    var acc = skip ? this.value : init;
    this.forEach(function (x) {
        if (!this.isRoot || !skip) {
            acc = cb.call(this, acc, x);
        }
    });
    return acc;
};

Traverse.prototype.paths = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.path); 
    });
    return acc;
};

Traverse.prototype.nodes = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.node);
    });
    return acc;
};

Traverse.prototype.clone = function () {
    var parents = [], nodes = [];
    
    return (function clone (src) {
        for (var i = 0; i < parents.length; i++) {
            if (parents[i] === src) {
                return nodes[i];
            }
        }
        
        if (typeof src === 'object' && src !== null) {
            var dst = copy(src);
            
            parents.push(src);
            nodes.push(dst);
            
            forEach(objectKeys(src), function (key) {
                dst[key] = clone(src[key]);
            });
            
            parents.pop();
            nodes.pop();
            return dst;
        }
        else {
            return src;
        }
    })(this.value);
};

function walk (root, cb, immutable) {
    var path = [];
    var parents = [];
    var alive = true;
    
    return (function walker (node_) {
        var node = immutable ? copy(node_) : node_;
        var modifiers = {};
        
        var keepGoing = true;
        
        var state = {
            node : node,
            node_ : node_,
            path : [].concat(path),
            parent : parents[parents.length - 1],
            parents : parents,
            key : path.slice(-1)[0],
            isRoot : path.length === 0,
            level : path.length,
            circular : null,
            update : function (x, stopHere) {
                if (!state.isRoot) {
                    state.parent.node[state.key] = x;
                }
                state.node = x;
                if (stopHere) keepGoing = false;
            },
            'delete' : function (stopHere) {
                delete state.parent.node[state.key];
                if (stopHere) keepGoing = false;
            },
            remove : function (stopHere) {
                if (isArray(state.parent.node)) {
                    state.parent.node.splice(state.key, 1);
                }
                else {
                    delete state.parent.node[state.key];
                }
                if (stopHere) keepGoing = false;
            },
            keys : null,
            before : function (f) { modifiers.before = f },
            after : function (f) { modifiers.after = f },
            pre : function (f) { modifiers.pre = f },
            post : function (f) { modifiers.post = f },
            stop : function () { alive = false },
            block : function () { keepGoing = false }
        };
        
        if (!alive) return state;
        
        function updateState() {
            if (typeof state.node === 'object' && state.node !== null) {
                if (!state.keys || state.node_ !== state.node) {
                    state.keys = objectKeys(state.node)
                }
                
                state.isLeaf = state.keys.length == 0;
                
                for (var i = 0; i < parents.length; i++) {
                    if (parents[i].node_ === node_) {
                        state.circular = parents[i];
                        break;
                    }
                }
            }
            else {
                state.isLeaf = true;
                state.keys = null;
            }
            
            state.notLeaf = !state.isLeaf;
            state.notRoot = !state.isRoot;
        }
        
        updateState();
        
        // use return values to update if defined
        var ret = cb.call(state, state.node);
        if (ret !== undefined && state.update) state.update(ret);
        
        if (modifiers.before) modifiers.before.call(state, state.node);
        
        if (!keepGoing) return state;
        
        if (typeof state.node == 'object'
        && state.node !== null && !state.circular) {
            parents.push(state);
            
            updateState();
            
            forEach(state.keys, function (key, i) {
                path.push(key);
                
                if (modifiers.pre) modifiers.pre.call(state, state.node[key], key);
                
                var child = walker(state.node[key]);
                if (immutable && Object.hasOwnProperty.call(state.node, key)) {
                    state.node[key] = child.node;
                }
                
                child.isLast = i == state.keys.length - 1;
                child.isFirst = i == 0;
                
                if (modifiers.post) modifiers.post.call(state, child);
                
                path.pop();
            });
            parents.pop();
        }
        
        if (modifiers.after) modifiers.after.call(state, state.node);
        
        return state;
    })(root).node;
}

function copy (src) {
    if (typeof src === 'object' && src !== null) {
        var dst;
        
        if (isArray(src)) {
            dst = [];
        }
        else if (isDate(src)) {
            dst = new Date(src);
        }
        else if (isRegExp(src)) {
            dst = new RegExp(src);
        }
        else if (isError(src)) {
            dst = { message: src.message };
        }
        else if (isBoolean(src)) {
            dst = new Boolean(src);
        }
        else if (isNumber(src)) {
            dst = new Number(src);
        }
        else if (isString(src)) {
            dst = new String(src);
        }
        else if (Object.create && Object.getPrototypeOf) {
            dst = Object.create(Object.getPrototypeOf(src));
        }
        else if (src.constructor === Object) {
            dst = {};
        }
        else {
            var proto =
                (src.constructor && src.constructor.prototype)
                || src.__proto__
                || {}
            ;
            var T = function () {};
            T.prototype = proto;
            dst = new T;
        }
        
        forEach(objectKeys(src), function (key) {
            dst[key] = src[key];
        });
        return dst;
    }
    else return src;
}

var objectKeys = Object.keys || function keys (obj) {
    var res = [];
    for (var key in obj) res.push(key)
    return res;
};

function toS (obj) { return Object.prototype.toString.call(obj) }
function isDate (obj) { return toS(obj) === '[object Date]' }
function isRegExp (obj) { return toS(obj) === '[object RegExp]' }
function isError (obj) { return toS(obj) === '[object Error]' }
function isBoolean (obj) { return toS(obj) === '[object Boolean]' }
function isNumber (obj) { return toS(obj) === '[object Number]' }
function isString (obj) { return toS(obj) === '[object String]' }

var isArray = Array.isArray || function isArray (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

var forEach = function (xs, fn) {
    if (xs.forEach) return xs.forEach(fn)
    else for (var i = 0; i < xs.length; i++) {
        fn(xs[i], i, xs);
    }
};

forEach(objectKeys(Traverse.prototype), function (key) {
    traverse[key] = function (obj) {
        var args = [].slice.call(arguments, 1);
        var t = new Traverse(obj);
        return t[key].apply(t, args);
    };
});
});

require.define("/node_modules/tap/node_modules/difflet/node_modules/charm/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/tap/node_modules/difflet/node_modules/charm/index.js",function(require,module,exports,__dirname,__filename,process){var tty = require('tty');
var encode = require('./lib/encode');
var EventEmitter = require('events').EventEmitter;

var exports = module.exports = function () {
    var input = null;
    function setInput (s) {
        if (input) throw new Error('multiple inputs specified')
        else input = s
    }
    
    var output = null;
    function setOutput (s) {
        if (output) throw new Error('multiple outputs specified')
        else output = s
    }
    
    for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        if (!arg) continue;
        if (arg.readable) setInput(arg)
        else if (arg.stdin || arg.input) setInput(arg.stdin || arg.input)
        
        if (arg.writable) setOutput(arg)
        else if (arg.stdout || arg.output) setOutput(arg.stdout || arg.output)
        
    }
    
    return new Charm(input, output);
};

var Charm = exports.Charm = function (input, output) {
    var self = this;
    self.input = input;
    self.output = output;
    self.pending = [];
    
    if (!output) {
        self.emit('error', new Error('output stream required'));
    }
    
    if (input && typeof input.fd === 'number' && tty.isatty(input.fd)) {
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(true);
        }
        else tty.setRawMode(true);
        input.resume();
    }
    
    if (input) {
        input.on('data', function (buf) {
            if (self.pending.length) {
                var codes = extractCodes(buf);
                var matched = false;
                
                for (var i = 0; i < codes.length; i++) {
                    for (var j = 0; j < self.pending.length; j++) {
                        var cb = self.pending[j];
                        if (cb(codes[i])) {
                            matched = true;
                            self.pending.splice(j, 1);
                            break;
                        }
                    }
                }
                
                if (matched) return;
            }
            
            self.emit('data', buf)
            
            if (buf.length === 1) {
                if (buf[0] === 3) self.emit('^C');
                if (buf[0] === 4) self.emit('^D');
            }
        });
    }
}

Charm.prototype = new EventEmitter;

Charm.prototype.destroy = function () {
    if (this.input) this.input.destroy()
};

Charm.prototype.write = function (msg) {
    this.output.write(msg);
    return this;
};

Charm.prototype.reset = function (cb) {
    this.write(encode('c'));
    return this;
};

Charm.prototype.position = function (x, y) {
    // get/set absolute coordinates
    if (typeof x === 'function') {
        var cb = x;
        this.pending.push(function (buf) {
            if (buf[0] === 27 && buf[1] === encode.ord('[')
            && buf[buf.length-1] === encode.ord('R')) {
                var pos = buf.toString()
                    .slice(2,-1)
                    .split(';')
                    .map(Number)
                ;
                cb(pos[1], pos[0]);
                return true;
            }
        });
        this.write(encode('[6n'));
    }
    else {
        this.write(encode(
            '[' + Math.floor(y) + ';' + Math.floor(x) + 'f'
        ));
    }
    return this;
};

Charm.prototype.move = function (x, y) {
    // set relative coordinates
    var bufs = [];
    
    if (y < 0) this.up(-y)
    else if (y > 0) this.down(y)
    
    if (x > 0) this.right(x)
    else if (x < 0) this.left(-x)
    
    return this;
};

Charm.prototype.up = function (y) {
    if (y === undefined) y = 1;
    this.write(encode('[' + Math.floor(y) + 'A'));
    return this;
};

Charm.prototype.down = function (y) {
    if (y === undefined) y = 1;
    this.write(encode('[' + Math.floor(y) + 'B'));
    return this;
};

Charm.prototype.right = function (x) {
    if (x === undefined) x = 1;
    this.write(encode('[' + Math.floor(x) + 'C'));
    return this;
};

Charm.prototype.left = function (x) {
    if (x === undefined) x = 1;
    this.write(encode('[' + Math.floor(x) + 'D'));
    return this;
};

Charm.prototype.column = function (x) {
    this.write(encode('[' + Math.floor(x) + 'G'));
    return this;
};

Charm.prototype.push = function (withAttributes) {
    this.write(encode(withAttributes ? '7' : '[s'));
    return this;
};

Charm.prototype.pop = function (withAttributes) {
    this.write(encode(withAttributes ? '8' : '[u'));
    return this;
};

Charm.prototype.erase = function (s) {
    if (s === 'end' || s === '$') {
        this.write(encode('[K'));
    }
    else if (s === 'start' || s === '^') {
        this.write(encode('[1K'));
    }
    else if (s === 'line') {
        this.write(encode('[2K'));
    }
    else if (s === 'down') {
        this.write(encode('[J'));
    }
    else if (s === 'up') {
        this.write(encode('[1J'));
    }
    else if (s === 'screen') {
        this.write(encode('[1J'));
    }
    else {
        this.emit('error', new Error('Unknown erase type: ' + s));
    }
    return this;
};

Charm.prototype.display = function (attr) {
    var c = {
        reset : 0,
        bright : 1,
        dim : 2,
        underscore : 4,
        blink : 5,
        reverse : 7,
        hidden : 8
    }[attr];
    if (c === undefined) {
        this.emit('error', new Error('Unknown attribute: ' + attr));
    }
    this.write(encode('[' + c + 'm'));
    return this;
};

Charm.prototype.foreground = function (color) {
    if (typeof color === 'number') {
        if (color < 0 || color >= 256) {
            this.emit('error', new Error('Color out of range: ' + color));
        }
        this.write(encode('[38;5;' + color + 'm'));
    }
    else {
        var c = {
            black : 30,
            red : 31,
            green : 32,
            yellow : 33,
            blue : 34,
            magenta : 35,
            cyan : 36,
            white : 37
        }[color.toLowerCase()];
        
        if (!c) this.emit('error', new Error('Unknown color: ' + color));
        this.write(encode('[' + c + 'm'));
    }
    return this;
};

Charm.prototype.background = function (color) {
    if (typeof color === 'number') {
        if (color < 0 || color >= 256) {
            this.emit('error', new Error('Color out of range: ' + color));
        }
        this.write(encode('[48;5;' + color + 'm'));
    }
    else {
        var c = {
          black : 40,
          red : 41,
          green : 42,
          yellow : 43,
          blue : 44,
          magenta : 45,
          cyan : 46,
          white : 47
        }[color.toLowerCase()];
        
        if (!c) this.emit('error', new Error('Unknown color: ' + color));
        this.write(encode('[' + c + 'm'));
    }
    return this;
};

Charm.prototype.cursor = function (visible) {
    this.write(encode(visible ? '[?25h' : '[?25l'));
    return this;
};

var extractCodes = exports.extractCodes = function (buf) {
    var codes = [];
    var start = -1;
    
    for (var i = 0; i < buf.length; i++) {
        if (buf[i] === 27) {
            if (start >= 0) codes.push(buf.slice(start, i));
            start = i;
        }
        else if (start >= 0 && i === buf.length - 1) {
            codes.push(buf.slice(start));
        }
    }
    
    return codes;
}
});

require.define("tty",function(require,module,exports,__dirname,__filename,process){exports.isatty = function () {};
exports.setRawMode = function () {};
});

require.define("/node_modules/tap/node_modules/difflet/node_modules/charm/lib/encode.js",function(require,module,exports,__dirname,__filename,process){var encode = module.exports = function (xs) {
    function bytes (s) {
        if (typeof s === 'string') {
            return s.split('').map(ord);
        }
        else if (Array.isArray(s)) {
            return s.reduce(function (acc, c) {
                return acc.concat(bytes(c));
            }, []);
        }
    }
    
    return new Buffer([ 0x1b ].concat(bytes(xs)));
};

var ord = encode.ord = function ord (c) {
    return c.charCodeAt(0)
};
});

require.define("/node_modules/tap/node_modules/deep-equal/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/tap/node_modules/deep-equal/index.js",function(require,module,exports,__dirname,__filename,process){var pSlice = Array.prototype.slice;
var Object_keys = typeof Object.keys === 'function'
    ? Object.keys
    : function (obj) {
        var keys = [];
        for (var key in obj) keys.push(key);
        return keys;
    }
;

var deepEqual = module.exports = function (actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b);
  }
  try {
    var ka = Object_keys(a),
        kb = Object_keys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}
});

require.define("/node_modules/tap/node_modules/buffer-equal/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/tap/node_modules/buffer-equal/index.js",function(require,module,exports,__dirname,__filename,process){var Buffer = require('buffer').Buffer; // for use with browserify

module.exports = function (a, b) {
    if (!Buffer.isBuffer(a)) return undefined;
    if (!Buffer.isBuffer(b)) return undefined;
    if (a.length !== b.length) return false;
    
    for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    
    return true;
};
});

require.define("/node_modules/testling/browser/test.js",function(require,module,exports,__dirname,__filename,process){var Test = require('tap/lib/tap-test');
var inherits = require('util').inherits;
var schoolbus = require('schoolbus');

inherits(Testling, Test);
module.exports = Testling;

function Testling (harness, name, conf) {
    Test.apply(this, arguments);
    for (var key in Test.prototype) {
        this[key] = Test.prototype[key].bind(this);
    }
    
    for (var key in Testling.prototype) {
        this[key] = Testling.prototype[key].bind(this);
    }
}

Testling.prototype.createWindow = function () {
    var bus = schoolbus.apply(null, arguments);
    bus.appendTo(document.body);
    return bus;
};

Testling.prototype.log = function (msg) {
    this.harness.emit('log', msg);
};
});

require.define("/node_modules/tap/lib/tap-test.js",function(require,module,exports,__dirname,__filename,process){// This is a very simple test framework that leverages the tap framework
// to run tests and output tap-parseable results.

module.exports = Test

var assert = require("./tap-assert")
  , inherits = require("inherits")
  , Results = require("./tap-results")

// tests are also test harnesses
inherits(Test, require("./tap-harness"))

function Test (harness, name, conf) {
  //console.error("test ctor")
  if (!(this instanceof Test)) return new Test(harness, name, conf)

  Test.super.call(this, Test)

  conf.name = name || conf.name || "(anonymous)"
  this.conf = conf

  this.harness = harness
  this.harness.add(this)
}

// it's taking too long!
Test.prototype.timeout = function () {
  // detect false alarms
  if (this._ended) return
  this.fail("Timeout!")
  this.end()
}

Test.prototype.clear = function () {
  this._started = false
  this._ended = false
  this._plan = null
  this._bailedOut = false
  this._testCount = 0
  this.results = new Results()
}

// this gets called if a test throws ever
Test.prototype.threw = function (ex) {
  //console.error("threw!", ex.stack)
  this.fail(ex.name + ": " + ex.message, { error: ex, thrown: true })
  // may emit further failing tests if the plan is not completed
  //console.error("end, because it threw")
  this.end()
}

Test.prototype.comment = function (m) {
  if (typeof m !== "string") {
    return this.fail("Test.comment argument must be a string")
  }
  this.result("\n" + m.trim())
}

Test.prototype.result = function (res) {
  this.results.add(res)
  this._testCount ++
  this.emit("result", res)
  if (this._plan === this._testCount) {
    process.nextTick(this._endNice.bind(this))
  }
}

Test.prototype._endNice = function () {
  if (!this._ended) this.end()
}

// parasitic
// Who says you can't do multiple inheritance in js?
Object.getOwnPropertyNames(assert).forEach(function (k) {
  if (k === "prototype" || k === "name") return
  var d = Object.getOwnPropertyDescriptor(assert, k)
    , v = d.value
  if (!v) return
  d.value = assertParasite(v)
  Object.defineProperty(Test.prototype, k, d)
})

function assertParasite (fn) { return function _testAssert () {
  //console.error("_testAssert", fn.name, arguments)
  if (this._bailedOut) return
  var res = fn.apply(assert, arguments)
  this.result(res)
  return res
}}

// a few tweaks on the EE emit function, because
// we want to catch all thrown errors and bubble up "bailout"
Test.prototype.emit = (function (em) { return function (t) {
  // bailouts bubble until handled
  if (t === "bailout" &&
      this.listeners(t).length === 0 &&
      this.harness) {
    return this.harness.bailout(arguments[1])
  }

  if (t === "error") return em.apply(this, arguments)
  try {
    em.apply(this, arguments)
  } catch (ex) {
    // any exceptions in a test are a failure
    //console.error("caught!", ex.stack)
    this.threw(ex)
  }
}})(Test.super.prototype.emit)
});

require.define("/node_modules/testling/node_modules/schoolbus/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/testling/node_modules/schoolbus/index.js",function(require,module,exports,__dirname,__filename,process){var EventEmitter = require('events').EventEmitter;
var json = typeof JSON === 'object' ? JSON : require('jsonify');
var proto = require('dnode-protocol');
var bus = require('postmessage');

module.exports = function (opts, vars, cb) {
    if (typeof opts === 'string') {
        opts = { uri : opts };
    }
    if (typeof cb === 'object') {
        var cb_ = cb;
        cb = vars;
        vars = cb_;
    }
    if (!vars) vars = {};
    
    var w = new Driver(opts, vars);
    if (typeof cb === 'function') w.next(cb);
    return w;
};

function Driver (opts, vars) {
    var self = this;
    self.vars = vars;
    self.element = document.createElement('iframe');
    var queue = self.queue = { next : [], remote : [] };
    
    self.client = proto(function (remote, conn) {
        conn.on('ready', function () {
            if (queue.next.length) {
                var cb = queue.next.shift();
                remote.run(String(cb), vars);
            }
            else queue.remote.push(remote);
        });
    });
    bindListeners(self);
    
    var u = opts.uri || opts.url;
    if (u) self.navigate(u);
}

Driver.prototype = new EventEmitter;

Driver.prototype.appendTo = function (elem) {
    return elem.appendChild(this.element);
};

Driver.prototype.navigate = function (uri, cb) {
    this.element.setAttribute('src', uri);
    if (typeof cb === 'function') {
        // like .next() but skip the queue
        this.once('open', function () {
            
        });
    }
};
 
Driver.prototype.next = function (cb) {
    var q = this.queue;
    if (q.remote.length) {
        q.remote.shift().run(String(cb), this.vars);
    }
    else q.next.push(cb);
    return this;
};

function bindListeners (self) {
    var session, win;
    
    bus.receiveMessage(function (ev) {
        try {
            var msg = json.parse(ev.data)
            if (msg[0] === '__testling_open') {
                session = create(self.element.contentWindow);
                self.emit('open', msg[1]);
            }
            else if (session && msg[0] === '__testling_message') {
                session.handle(msg[1]);
            }
        }
        catch (err) {}
    });
    
    function create (win) {
        var c = self.client.create();
        
        c.on('request', function (req) {
            bus.postMessage(
                json.stringify([ '__testling_message', req ]),
                '*',
                win
            );
        });
        
        c.start();
        return c;
    }
};
});

require.define("/node_modules/testling/node_modules/jsonify/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/testling/node_modules/jsonify/index.js",function(require,module,exports,__dirname,__filename,process){exports.parse = require('./lib/parse');
exports.stringify = require('./lib/stringify');
});

require.define("/node_modules/testling/node_modules/jsonify/lib/parse.js",function(require,module,exports,__dirname,__filename,process){var at, // The index of the current character
    ch, // The current character
    escapee = {
        '"':  '"',
        '\\': '\\',
        '/':  '/',
        b:    '\b',
        f:    '\f',
        n:    '\n',
        r:    '\r',
        t:    '\t'
    },
    text,

    error = function (m) {
        // Call error when something is wrong.
        throw {
            name:    'SyntaxError',
            message: m,
            at:      at,
            text:    text
        };
    },
    
    next = function (c) {
        // If a c parameter is provided, verify that it matches the current character.
        if (c && c !== ch) {
            error("Expected '" + c + "' instead of '" + ch + "'");
        }
        
        // Get the next character. When there are no more characters,
        // return the empty string.
        
        ch = text.charAt(at);
        at += 1;
        return ch;
    },
    
    number = function () {
        // Parse a number value.
        var number,
            string = '';
        
        if (ch === '-') {
            string = '-';
            next('-');
        }
        while (ch >= '0' && ch <= '9') {
            string += ch;
            next();
        }
        if (ch === '.') {
            string += '.';
            while (next() && ch >= '0' && ch <= '9') {
                string += ch;
            }
        }
        if (ch === 'e' || ch === 'E') {
            string += ch;
            next();
            if (ch === '-' || ch === '+') {
                string += ch;
                next();
            }
            while (ch >= '0' && ch <= '9') {
                string += ch;
                next();
            }
        }
        number = +string;
        if (!isFinite(number)) {
            error("Bad number");
        } else {
            return number;
        }
    },
    
    string = function () {
        // Parse a string value.
        var hex,
            i,
            string = '',
            uffff;
        
        // When parsing for string values, we must look for " and \ characters.
        if (ch === '"') {
            while (next()) {
                if (ch === '"') {
                    next();
                    return string;
                } else if (ch === '\\') {
                    next();
                    if (ch === 'u') {
                        uffff = 0;
                        for (i = 0; i < 4; i += 1) {
                            hex = parseInt(next(), 16);
                            if (!isFinite(hex)) {
                                break;
                            }
                            uffff = uffff * 16 + hex;
                        }
                        string += String.fromCharCode(uffff);
                    } else if (typeof escapee[ch] === 'string') {
                        string += escapee[ch];
                    } else {
                        break;
                    }
                } else {
                    string += ch;
                }
            }
        }
        error("Bad string");
    },

    white = function () {

// Skip whitespace.

        while (ch && ch <= ' ') {
            next();
        }
    },

    word = function () {

// true, false, or null.

        switch (ch) {
        case 't':
            next('t');
            next('r');
            next('u');
            next('e');
            return true;
        case 'f':
            next('f');
            next('a');
            next('l');
            next('s');
            next('e');
            return false;
        case 'n':
            next('n');
            next('u');
            next('l');
            next('l');
            return null;
        }
        error("Unexpected '" + ch + "'");
    },

    value,  // Place holder for the value function.

    array = function () {

// Parse an array value.

        var array = [];

        if (ch === '[') {
            next('[');
            white();
            if (ch === ']') {
                next(']');
                return array;   // empty array
            }
            while (ch) {
                array.push(value());
                white();
                if (ch === ']') {
                    next(']');
                    return array;
                }
                next(',');
                white();
            }
        }
        error("Bad array");
    },

    object = function () {

// Parse an object value.

        var key,
            object = {};

        if (ch === '{') {
            next('{');
            white();
            if (ch === '}') {
                next('}');
                return object;   // empty object
            }
            while (ch) {
                key = string();
                white();
                next(':');
                if (Object.hasOwnProperty.call(object, key)) {
                    error('Duplicate key "' + key + '"');
                }
                object[key] = value();
                white();
                if (ch === '}') {
                    next('}');
                    return object;
                }
                next(',');
                white();
            }
        }
        error("Bad object");
    };

value = function () {

// Parse a JSON value. It could be an object, an array, a string, a number,
// or a word.

    white();
    switch (ch) {
    case '{':
        return object();
    case '[':
        return array();
    case '"':
        return string();
    case '-':
        return number();
    default:
        return ch >= '0' && ch <= '9' ? number() : word();
    }
};

// Return the json_parse function. It will have access to all of the above
// functions and variables.

module.exports = function (source, reviver) {
    var result;
    
    text = source;
    at = 0;
    ch = ' ';
    result = value();
    white();
    if (ch) {
        error("Syntax error");
    }

    // If there is a reviver function, we recursively walk the new structure,
    // passing each name/value pair to the reviver function for possible
    // transformation, starting with a temporary root object that holds the result
    // in an empty key. If there is not a reviver function, we simply return the
    // result.

    return typeof reviver === 'function' ? (function walk(holder, key) {
        var k, v, value = holder[key];
        if (value && typeof value === 'object') {
            for (k in value) {
                if (Object.prototype.hasOwnProperty.call(value, k)) {
                    v = walk(value, k);
                    if (v !== undefined) {
                        value[k] = v;
                    } else {
                        delete value[k];
                    }
                }
            }
        }
        return reviver.call(holder, key, value);
    }({'': result}, '')) : result;
};
});

require.define("/node_modules/testling/node_modules/jsonify/lib/stringify.js",function(require,module,exports,__dirname,__filename,process){var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
    escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
    gap,
    indent,
    meta = {    // table of character substitutions
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
    },
    rep;

function quote(string) {
    // If the string contains no control characters, no quote characters, and no
    // backslash characters, then we can safely slap some quotes around it.
    // Otherwise we must also replace the offending characters with safe escape
    // sequences.
    
    escapable.lastIndex = 0;
    return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
        var c = meta[a];
        return typeof c === 'string' ? c :
            '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
    }) + '"' : '"' + string + '"';
}

function str(key, holder) {
    // Produce a string from holder[key].
    var i,          // The loop counter.
        k,          // The member key.
        v,          // The member value.
        length,
        mind = gap,
        partial,
        value = holder[key];
    
    // If the value has a toJSON method, call it to obtain a replacement value.
    if (value && typeof value === 'object' &&
            typeof value.toJSON === 'function') {
        value = value.toJSON(key);
    }
    
    // If we were called with a replacer function, then call the replacer to
    // obtain a replacement value.
    if (typeof rep === 'function') {
        value = rep.call(holder, key, value);
    }
    
    // What happens next depends on the value's type.
    switch (typeof value) {
        case 'string':
            return quote(value);
        
        case 'number':
            // JSON numbers must be finite. Encode non-finite numbers as null.
            return isFinite(value) ? String(value) : 'null';
        
        case 'boolean':
        case 'null':
            // If the value is a boolean or null, convert it to a string. Note:
            // typeof null does not produce 'null'. The case is included here in
            // the remote chance that this gets fixed someday.
            return String(value);
            
        case 'object':
            if (!value) return 'null';
            gap += indent;
            partial = [];
            
            // Array.isArray
            if (Object.prototype.toString.apply(value) === '[object Array]') {
                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }
                
                // Join all of the elements together, separated with commas, and
                // wrap them in brackets.
                v = partial.length === 0 ? '[]' : gap ?
                    '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' :
                    '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }
            
            // If the replacer is an array, use it to select the members to be
            // stringified.
            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    k = rep[i];
                    if (typeof k === 'string') {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }
            else {
                // Otherwise, iterate through all of the keys in the object.
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }
            
        // Join all of the member texts together, separated with commas,
        // and wrap them in braces.

        v = partial.length === 0 ? '{}' : gap ?
            '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' :
            '{' + partial.join(',') + '}';
        gap = mind;
        return v;
    }
}

module.exports = function (value, replacer, space) {
    var i;
    gap = '';
    indent = '';
    
    // If the space parameter is a number, make an indent string containing that
    // many spaces.
    if (typeof space === 'number') {
        for (i = 0; i < space; i += 1) {
            indent += ' ';
        }
    }
    // If the space parameter is a string, it will be used as the indent string.
    else if (typeof space === 'string') {
        indent = space;
    }

    // If there is a replacer, it must be a function or an array.
    // Otherwise, throw an error.
    rep = replacer;
    if (replacer && typeof replacer !== 'function'
    && (typeof replacer !== 'object' || typeof replacer.length !== 'number')) {
        throw new Error('JSON.stringify');
    }
    
    // Make a fake root object containing our value under the key of ''.
    // Return the result of stringifying the value.
    return str('', {'': value});
};
});

require.define("/node_modules/testling/node_modules/schoolbus/node_modules/dnode-protocol/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"./index.js"}});

require.define("/node_modules/testling/node_modules/schoolbus/node_modules/dnode-protocol/index.js",function(require,module,exports,__dirname,__filename,process){var traverse = require('traverse');
var EventEmitter = require('events').EventEmitter;

var json = typeof JSON === 'object' ? JSON : require('jsonify');
var objectKeys = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) keys.push(key);
    return keys;
};

function forEach (xs, f) {
    if (xs.forEach) return xs.forEach(f)
    for (var i = 0; i < xs.length; i++) {
        f.call(xs, xs[i], i);
    }
}

var exports = module.exports = function (wrapper) {
    var self = {};
    
    self.sessions = {};
    
    self.create = function () {
        var id = null;
        do {
            id = Math.floor(
                Math.random() * Math.pow(2,32)
            ).toString(16);
        } while (self.sessions[id]);
        
        var s = Session(id, wrapper);
        self.sessions[id] = s;
        return s;
    };
    
    self.destroy = function (id) {
        delete self.sessions[id];
    };
    
    return self;
};

var Session = exports.Session = function (id, wrapper) {
    var self = new EventEmitter;
    
    self.id = id;
    self.remote = {};
    
    var instance = self.instance =
        typeof(wrapper) == 'function'
            ? new wrapper(self.remote, self)
            : wrapper || {}
    ;
    
    self.localStore = new Store;
    self.remoteStore = new Store;
    
    self.localStore.on('cull', function (id) {
        self.emit('request', {
            method : 'cull',
            arguments : [id],
            callbacks : {}
        });
    });
    
    var scrubber = new Scrubber(self.localStore);
    
    self.start = function () {
        self.request('methods', [ instance ]);
    };
    
    self.request = function (method, args) {
        var scrub = scrubber.scrub(args);
        
        self.emit('request', {
            method : method,
            arguments : scrub.arguments,
            callbacks : scrub.callbacks,
            links : scrub.links
        });
    };
    
    self.parse = function (line) {
        var msg = null;
        try { msg = json.parse(line) }
        catch (err) {
            self.emit('error', new SyntaxError(
                'Error parsing JSON message: ' + json.stringify(line))
            );
            return;
        }
        
        try { self.handle(msg) }
        catch (err) { self.emit('error', err) }
    };
    
    self.handle = function (req) {
        var args = scrubber.unscrub(req, function (id) {
            if (!self.remoteStore.has(id)) {
                // create a new function only if one hasn't already been created
                // for a particular id
                self.remoteStore.add(function () {
                    self.request(id, [].slice.apply(arguments));
                }, id);
            }
            return self.remoteStore.get(id);
        });
        
        if (req.method === 'methods') {
            handleMethods(args[0]);
        }
        else if (req.method === 'error') {
            var methods = args[0];
            self.emit('remoteError', methods);
        }
        else if (req.method === 'cull') {
            forEach(args, function (id) {
                self.remoteStore.cull(args);
            });
        }
        else if (typeof req.method === 'string') {
            if (self.instance.propertyIsEnumerable(req.method)) {
                apply(self.instance[req.method], self.instance, args);
            }
            else {
                self.emit('error', new Error(
                    'Request for non-enumerable method: ' + req.method
                ));
            }
        }
        else if (typeof req.method == 'number') {
            apply(self.localStore.get(req.method), self.instance, args);
        }
    }
    
    function handleMethods (methods) {
        if (typeof methods != 'object') {
            methods = {};
        }
        
        // copy since assignment discards the previous refs
        forEach(objectKeys(self.remote), function (key) {
            delete self.remote[key];
        });
        
        forEach(objectKeys(methods), function (key) {
            self.remote[key] = methods[key];
        });
        
        self.emit('remote', self.remote);
        self.emit('ready');
    }
    
    function apply(f, obj, args) {
        try { f.apply(obj, args) }
        catch (err) { self.emit('error', err) }
    }
    
    return self;
};

// scrub callbacks out of requests in order to call them again later
var Scrubber = exports.Scrubber = function (store) {
    var self = {};
    store = store || new Store;
    self.callbacks = store.items;
    
    // Take the functions out and note them for future use
    self.scrub = function (obj) {
        var paths = {};
        var links = [];
        
        var args = traverse(obj).map(function (node) {
            if (typeof(node) == 'function') {
                var i = store.indexOf(node);
                if (i >= 0 && !(i in paths)) {
                    // Keep previous function IDs only for the first function
                    // found. This is somewhat suboptimal but the alternatives
                    // are worse.
                    paths[i] = this.path;
                }
                else {
                    var id = store.add(node);
                    paths[id] = this.path;
                }
                
                this.update('[Function]');
            }
            else if (this.circular) {
                links.push({ from : this.circular.path, to : this.path });
                this.update('[Circular]');
            }
        });
        
        return {
            arguments : args,
            callbacks : paths,
            links : links
        };
    };
    
    // Replace callbacks. The supplied function should take a callback id and
    // return a callback of its own.
    self.unscrub = function (msg, f) {
        var args = msg.arguments || [];
        forEach(objectKeys(msg.callbacks || {}), function (strId) {
            var id = parseInt(strId,10);
            var path = msg.callbacks[id];
            args = setAt(args, path, f(id));
        });
        
        forEach(msg.links || [], function (link) {
            var value = getAt(args, link.from);
            args = setAt(args, link.to, value);
        });
        
        return args;
    };
    
    function setAt (ref, path, value) {
        var node = ref;
        for (var i = 0; i < path.length - 1; i++) {
            var key = path[i];
            if (Object.propertyIsEnumerable.call(node, key)) {
                node = node[key];
            }
            else return undefined;
        };
        var last = path.slice(-1)[0];
        if (last === undefined) {
            return value;
        }
        else {
            node[last] = value;
            return ref;
        }
    }
    
    function getAt (node, path) {
        for (var i = 0; i < path.length; i++) {
            var key = path[i];
            if (Object.propertyIsEnumerable.call(node, key)) {
                node = node[key];
            }
            else return undefined;
        }
        return node;
    }
    
    return self;
}

var Store = exports.Store = function() {
    var self = new EventEmitter;
    var items = self.items = [];
    
    self.has = function (id) {
        return items[id] != undefined;
    };
    
    self.get = function (id) {
        if (!self.has(id)) return null;
        return wrap(items[id]);
    };
    
    self.add = function (fn, id) {
        if (id == undefined) id = items.length;
        items[id] = fn;
        return id;
    };
    
    self.cull = function (arg) {
        if (typeof arg == 'function') {
            arg = items.indexOf(arg);
        }
        delete items[arg];
        return arg;
    };
    
    self.indexOf = function (fn) {
        if (items.indexOf) return items.indexOf(fn);
        for (var i = 0; i < items.length; i++) {
            if (items[i] === fn) return i;
        }
        return -1;
    };
    
    function wrap (fn) {
        return function() {
            fn.apply(this, arguments);
            autoCull(fn);
        };
    }
    
    function autoCull (fn) {
        if (typeof fn.times == 'number') {
            fn.times--;
            if (fn.times == 0) {
                var id = self.cull(fn);
                self.emit('cull', id);
            }
        }
    }
    
    return self;
};

var parseArgs = exports.parseArgs = function (argv) {
    var params = {};
    
    forEach([].slice.call(argv), function (arg) {
        if (typeof arg === 'string') {
            if (arg.match(/^\d+$/)) {
                params.port = parseInt(arg, 10);
            }
            else if (arg.match('^/')) {
                params.path = arg;
            }
            else {
                params.host = arg;
            }
        }
        else if (typeof arg === 'number') {
            params.port = arg;
        }
        else if (typeof arg === 'function') {
            params.block = arg;
        }
        else if (typeof arg === 'object') {
            if (arg && typeof arg.listen === 'function') {
                // servers can .listen()
                params.server = arg;
            }
            else if (arg && typeof arg.write === 'function') {
                // streams can .write()
                params.stream = arg;
            }
            else {
                // merge vanilla objects into params
                forEach(objectKeys(arg), function (key) {
                    params[key] = key === 'port'
                        ? parseInt(arg[key], 10)
                        : arg[key]
                    ;
                });
            }
        }
        else if (typeof arg === 'undefined') {
            // ignore
        }
        else {
            throw new Error('Not sure what to do about '
                + typeof arg + ' objects');
        }
    });
    
    return params;
};
});

require.define("/node_modules/testling/node_modules/schoolbus/node_modules/dnode-protocol/node_modules/traverse/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/testling/node_modules/schoolbus/node_modules/dnode-protocol/node_modules/traverse/index.js",function(require,module,exports,__dirname,__filename,process){var traverse = module.exports = function (obj) {
    return new Traverse(obj);
};

function Traverse (obj) {
    this.value = obj;
}

Traverse.prototype.get = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) {
            node = undefined;
            break;
        }
        node = node[key];
    }
    return node;
};

Traverse.prototype.has = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) {
            return false;
        }
        node = node[key];
    }
    return true;
};

Traverse.prototype.set = function (ps, value) {
    var node = this.value;
    for (var i = 0; i < ps.length - 1; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) node[key] = {};
        node = node[key];
    }
    node[ps[i]] = value;
    return value;
};

Traverse.prototype.map = function (cb) {
    return walk(this.value, cb, true);
};

Traverse.prototype.forEach = function (cb) {
    this.value = walk(this.value, cb, false);
    return this.value;
};

Traverse.prototype.reduce = function (cb, init) {
    var skip = arguments.length === 1;
    var acc = skip ? this.value : init;
    this.forEach(function (x) {
        if (!this.isRoot || !skip) {
            acc = cb.call(this, acc, x);
        }
    });
    return acc;
};

Traverse.prototype.paths = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.path); 
    });
    return acc;
};

Traverse.prototype.nodes = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.node);
    });
    return acc;
};

Traverse.prototype.clone = function () {
    var parents = [], nodes = [];
    
    return (function clone (src) {
        for (var i = 0; i < parents.length; i++) {
            if (parents[i] === src) {
                return nodes[i];
            }
        }
        
        if (typeof src === 'object' && src !== null) {
            var dst = copy(src);
            
            parents.push(src);
            nodes.push(dst);
            
            forEach(objectKeys(src), function (key) {
                dst[key] = clone(src[key]);
            });
            
            parents.pop();
            nodes.pop();
            return dst;
        }
        else {
            return src;
        }
    })(this.value);
};

function walk (root, cb, immutable) {
    var path = [];
    var parents = [];
    var alive = true;
    
    return (function walker (node_) {
        var node = immutable ? copy(node_) : node_;
        var modifiers = {};
        
        var keepGoing = true;
        
        var state = {
            node : node,
            node_ : node_,
            path : [].concat(path),
            parent : parents[parents.length - 1],
            parents : parents,
            key : path.slice(-1)[0],
            isRoot : path.length === 0,
            level : path.length,
            circular : null,
            update : function (x, stopHere) {
                if (!state.isRoot) {
                    state.parent.node[state.key] = x;
                }
                state.node = x;
                if (stopHere) keepGoing = false;
            },
            'delete' : function (stopHere) {
                delete state.parent.node[state.key];
                if (stopHere) keepGoing = false;
            },
            remove : function (stopHere) {
                if (isArray(state.parent.node)) {
                    state.parent.node.splice(state.key, 1);
                }
                else {
                    delete state.parent.node[state.key];
                }
                if (stopHere) keepGoing = false;
            },
            keys : null,
            before : function (f) { modifiers.before = f },
            after : function (f) { modifiers.after = f },
            pre : function (f) { modifiers.pre = f },
            post : function (f) { modifiers.post = f },
            stop : function () { alive = false },
            block : function () { keepGoing = false }
        };
        
        if (!alive) return state;
        
        function updateState() {
            if (typeof state.node === 'object' && state.node !== null) {
                if (!state.keys || state.node_ !== state.node) {
                    state.keys = objectKeys(state.node)
                }
                
                state.isLeaf = state.keys.length == 0;
                
                for (var i = 0; i < parents.length; i++) {
                    if (parents[i].node_ === node_) {
                        state.circular = parents[i];
                        break;
                    }
                }
            }
            else {
                state.isLeaf = true;
                state.keys = null;
            }
            
            state.notLeaf = !state.isLeaf;
            state.notRoot = !state.isRoot;
        }
        
        updateState();
        
        // use return values to update if defined
        var ret = cb.call(state, state.node);
        if (ret !== undefined && state.update) state.update(ret);
        
        if (modifiers.before) modifiers.before.call(state, state.node);
        
        if (!keepGoing) return state;
        
        if (typeof state.node == 'object'
        && state.node !== null && !state.circular) {
            parents.push(state);
            
            updateState();
            
            forEach(state.keys, function (key, i) {
                path.push(key);
                
                if (modifiers.pre) modifiers.pre.call(state, state.node[key], key);
                
                var child = walker(state.node[key]);
                if (immutable && Object.hasOwnProperty.call(state.node, key)) {
                    state.node[key] = child.node;
                }
                
                child.isLast = i == state.keys.length - 1;
                child.isFirst = i == 0;
                
                if (modifiers.post) modifiers.post.call(state, child);
                
                path.pop();
            });
            parents.pop();
        }
        
        if (modifiers.after) modifiers.after.call(state, state.node);
        
        return state;
    })(root).node;
}

function copy (src) {
    if (typeof src === 'object' && src !== null) {
        var dst;
        
        if (isArray(src)) {
            dst = [];
        }
        else if (isDate(src)) {
            dst = new Date(src);
        }
        else if (isRegExp(src)) {
            dst = new RegExp(src);
        }
        else if (isError(src)) {
            dst = { message: src.message };
        }
        else if (isBoolean(src)) {
            dst = new Boolean(src);
        }
        else if (isNumber(src)) {
            dst = new Number(src);
        }
        else if (isString(src)) {
            dst = new String(src);
        }
        else if (Object.create && Object.getPrototypeOf) {
            dst = Object.create(Object.getPrototypeOf(src));
        }
        else if (src.constructor === Object) {
            dst = {};
        }
        else {
            var proto =
                (src.constructor && src.constructor.prototype)
                || src.__proto__
                || {}
            ;
            var T = function () {};
            T.prototype = proto;
            dst = new T;
        }
        
        forEach(objectKeys(src), function (key) {
            dst[key] = src[key];
        });
        return dst;
    }
    else return src;
}

var objectKeys = Object.keys || function keys (obj) {
    var res = [];
    for (var key in obj) res.push(key)
    return res;
};

function toS (obj) { return Object.prototype.toString.call(obj) }
function isDate (obj) { return toS(obj) === '[object Date]' }
function isRegExp (obj) { return toS(obj) === '[object RegExp]' }
function isError (obj) { return toS(obj) === '[object Error]' }
function isBoolean (obj) { return toS(obj) === '[object Boolean]' }
function isNumber (obj) { return toS(obj) === '[object Number]' }
function isString (obj) { return toS(obj) === '[object String]' }

var isArray = Array.isArray || function isArray (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

var forEach = function (xs, fn) {
    if (xs.forEach) return xs.forEach(fn)
    else for (var i = 0; i < xs.length; i++) {
        fn(xs[i], i, xs);
    }
};

forEach(objectKeys(Traverse.prototype), function (key) {
    traverse[key] = function (obj) {
        var args = [].slice.call(arguments, 1);
        var t = new Traverse(obj);
        return t[key].apply(t, args);
    };
});
});

require.define("/node_modules/testling/node_modules/schoolbus/node_modules/postmessage/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"./ender-postmessage.js"}});

require.define("/node_modules/testling/node_modules/schoolbus/node_modules/postmessage/ender-postmessage.js",function(require,module,exports,__dirname,__filename,process){/*
 * ender postMessage - v0.1.3 - 5/1/2012
 * by Thomas Sturm http://www.sturm.to
 * Dual licensed under the MIT and GPL licenses.
 *
 * based on 
 *
 * jQuery postMessage - v0.5 - 9/11/2009
 * http://benalman.com/projects/jquery-postmessage-plugin/
 * Copyright (c) 2009 "Cowboy" Ben Alman
 * Dual licensed under the MIT and GPL licenses.
 * http://benalman.com/about/license/
 */

// Release History
// ender postMessage
// 0.1.3 - (5/1/2012) compatible with browserify
// 0.1.2 - (5/26/2011) Initial Fork and Release
//
// jQuery postMessage
// 0.5 - (9/11/2009) Improved cache-busting
// 0.4 - (8/25/2009) Initial release

!function (window) {
     // A few vars used in non-awesome browsers
     var interval_id,
	  last_hash,
	  original_hash,
	  cache_bust = 1,
		
	  // A var used in awesome browsers.
	  rm_callback,
		
	  // A few convenient shortcuts.
	  window = this,
	  FALSE = !1,
		
	  // Reused internal strings.
	  postMessage = 'postMessage',
	  addEventListener = 'addEventListener',

      has_postMessage = window[postMessage];
     
      fn = {};
	
	  // Method: ender.postMessage
	  // 
	  // This method will call window.postMessage if available, setting the
	  // targetOrigin parameter to the base of the target_url parameter for maximum
	  // security in browsers that support it. If window.postMessage is not available,
	  // the target window's location.hash will be used to pass the message. 
	  //
	  // Please Note: The ender version does not support the jQuery object serialization 
	  // for postMessage
	  // 
	  // Usage:
	  // 
	  // > ender.postMessage( message, target_url [, target ] );
	  // 
	  // Arguments:
	  // 
	  //  message - (String) A message to be passed to the other frame.
	  //  target_url - (String) The URL of the other frame this window is
	  //    attempting to communicate with. This must be the exact URL (including
	  //    any query string) of the other window for this script to work in
	  //    browsers that don't support window.postMessage.
	  //  target - (Object) A reference to the other frame this window is
	  //    attempting to communicate with. If omitted, defaults to `parent`.
	  // 
	  // Returns:
	  // 
	  //  Nothing.
	  
	  fn.postMessage = function( message, target_url, target ) {
		if ( !target_url ) { return; }
		
		// Default to parent if unspecified.
		target = target || parent;
		
		if ( has_postMessage ) {
		  // The browser supports window.postMessage, so call it with a targetOrigin
		  // set appropriately, based on the target_url parameter.
		  target[postMessage]( message, target_url.replace( /([^:]+:\/\/[^\/]+).*/, '$1' ) );
		  
		} else if ( target_url ) {
		  // The browser does not support window.postMessage, so set the location
		  // of the target to target_url#message. A bit ugly, but it works! A cache
		  // bust parameter is added to ensure that repeat messages trigger the
		  // callback.
		  target.location = target_url.replace( /#.*$/, '' ) + '#' + (+new Date) + (cache_bust++) + '&' + message;
		}
	  };
	  
	  // Method: ender.receiveMessage
	  // 
	  // Register a single callback for either a window.postMessage call, if
	  // supported, or if unsupported, for any change in the current window
	  // location.hash. If window.postMessage is supported and source_origin is
	  // specified, the source window will be checked against this for maximum
	  // security. If window.postMessage is unsupported, a polling loop will be
	  // started to watch for changes to the location.hash.
	  // 
	  // Note that for simplicity's sake, only a single callback can be registered
	  // at one time. Passing no params will unbind this event (or stop the polling
	  // loop), and calling this method a second time with another callback will
	  // unbind the event (or stop the polling loop) first, before binding the new
	  // callback.
	  // 
	  // Also note that if window.postMessage is available, the optional
	  // source_origin param will be used to test the event.origin property. From
	  // the MDC window.postMessage docs: This string is the concatenation of the
	  // protocol and "://", the host name if one exists, and ":" followed by a port
	  // number if a port is present and differs from the default port for the given
	  // protocol. Examples of typical origins are https://example.org (implying
	  // port 443), http://example.net (implying port 80), and http://example.com:8080.
	  // 
	  // Usage:
	  // 
	  // > ender.receiveMessage( callback [, source_origin ] [, delay ] );
	  // 
	  // Arguments:
	  // 
	  //  callback - (Function) This callback will execute whenever a <ender.postMessage>
	  //    message is received, provided the source_origin matches. If callback is
	  //    omitted, any existing receiveMessage event bind or polling loop will be
	  //    canceled.
	  //  source_origin - (String) If window.postMessage is available and this value
	  //    is not equal to the event.origin property, the callback will not be
	  //    called.
	  //  source_origin - (Function) If window.postMessage is available and this
	  //    function returns false when passed the event.origin property, the
	  //    callback will not be called.
	  //  delay - (Number) An optional zero-or-greater delay in milliseconds at
	  //    which the polling loop will execute (for browser that don't support
	  //    window.postMessage). If omitted, defaults to 100.
	  // 
	  // Returns:
	  // 
	  //  Nothing!
	  
	  fn.receiveMessage = function( callback, source_origin, delay ) {
		if ( has_postMessage ) {
		  // Since the browser supports window.postMessage, the callback will be
		  // bound to the actual event associated with window.postMessage.
		  
		  if ( callback ) {
			// Unbind an existing callback if it exists.
			rm_callback && fn.receiveMessage();
			
			// Bind the callback. A reference to the callback is stored for ease of
			// unbinding.
			rm_callback = function(e) {
			  if ( ( typeof source_origin === 'string' && e.origin !== source_origin )
				|| ( typeof source_origin === 'function' && source_origin( e.origin ) === FALSE ) ) {
				return FALSE;
			  }
			  callback( e );
			};
		  }
		  
		  if ( window[addEventListener] ) {
			window[ callback ? addEventListener : 'removeEventListener' ]( 'message', rm_callback, FALSE );
		  } else {
			window[ callback ? 'attachEvent' : 'detachEvent' ]( 'onmessage', rm_callback );
		  }
		  
		} else {
		  // Since the browser sucks, a polling loop will be started, and the
		  // callback will be called whenever the location.hash changes.
		  
		  interval_id && clearInterval( interval_id );
		  interval_id = null;
		  
		  if ( callback ) {
			delay = typeof source_origin === 'number'
			  ? source_origin
			  : typeof delay === 'number'
				? delay
				: 100;
			
			original_hash = document.location.hash;
			
			interval_id = setInterval(function(){
			  var hash = document.location.hash,
				re = /^#?\d+&/;
			  if ( hash !== last_hash && hash !== original_hash && re.test( hash ) ) {
				last_hash = hash;
				if ( original_hash ) {
					document.location.hash = original_hash; 
				} else {
					document.location.hash = ''; 
				}
				callback({ data: hash.replace( re, '' ) });
			  }
			}, delay );
		  }
		}
	  };
	  module.exports = {postMessage: fn.postMessage, receiveMessage: fn.receiveMessage};
}(window);
});

require.define("/node_modules/testling/browser/output.js",function(require,module,exports,__dirname,__filename,process){var Stream = require('stream');
var render = require('./render');
var JSONStream = require('JSONStream');

var es = require('event-stream');
var stream = module.exports = (function () {
    var s = new Stream;
    s.writable = true;
    s.readable = true;
    
    s.write = function (buf) { s.emit('data', buf) };
    
    s.end = function (buf) {
        if (buf !== undefined) s.write(buf);
        s.emit('end');
    };
    return s;
})();
stream.pipe(render);});

require.define("/node_modules/testling/browser/render.js",function(require,module,exports,__dirname,__filename,process){var Stream = require('stream');
var domready = require('domready');
var json = typeof JSON === 'object' ? JSON : require('jsonify');

var stream = module.exports = new Stream;
stream.writable = true;

var ready = false;
var buffered = [];
domready(function () {
    ready = true;
    buffered.forEach(function (msg) {
        stream.write(msg);
    });
    buffered = [];
});

stream.write = function (msg) {
    if (!ready) {
        buffered.push(msg);
        return;
    }
    
    var div = document.createElement('div');
    var txt = document.createTextNode(json.stringify(msg));
    div.appendChild(txt);
    document.body.appendChild(div);
};

stream.end = function (msg) {
    if (msg !== undefined) stream.write(msg);
    stream.writable = false;
};
});

require.define("/node_modules/testling/node_modules/domready/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"./ready.js"}});

require.define("/node_modules/testling/node_modules/domready/ready.js",function(require,module,exports,__dirname,__filename,process){/*!
  * domready (c) Dustin Diaz 2012 - License MIT
  */
!function (name, definition) {
  if (typeof module != 'undefined') module.exports = definition()
  else if (typeof define == 'function' && typeof define.amd == 'object') define(definition)
  else this[name] = definition()
}('domready', function (ready) {

  var fns = [], fn, f = false
    , doc = document
    , testEl = doc.documentElement
    , hack = testEl.doScroll
    , domContentLoaded = 'DOMContentLoaded'
    , addEventListener = 'addEventListener'
    , onreadystatechange = 'onreadystatechange'
    , readyState = 'readyState'
    , loaded = /^loade|c/.test(doc[readyState])

  function flush(f) {
    loaded = 1
    while (f = fns.shift()) f()
  }

  doc[addEventListener] && doc[addEventListener](domContentLoaded, fn = function () {
    doc.removeEventListener(domContentLoaded, fn, f)
    flush()
  }, f)


  hack && doc.attachEvent(onreadystatechange, fn = function () {
    if (/^c/.test(doc[readyState])) {
      doc.detachEvent(onreadystatechange, fn)
      flush()
    }
  })

  return (ready = hack ?
    function (fn) {
      self != top ?
        loaded ? fn() : fns.push(fn) :
        function () {
          try {
            testEl.doScroll('left')
          } catch (e) {
            return setTimeout(function() { ready(fn) }, 50)
          }
          fn()
        }()
    } :
    function (fn) {
      loaded ? fn() : fns.push(fn)
    })
})});

require.define("/node_modules/testling/node_modules/JSONStream/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {}});

require.define("/node_modules/testling/node_modules/JSONStream/index.js",function(require,module,exports,__dirname,__filename,process){
var Parser = require('jsonparse')
  , Stream = require('stream').Stream

/*

  the value of this.stack that creationix's jsonparse has is weird.
  
  it makes this code ugly, but his problem is way harder that mine,
  so i'll forgive him.

*/

exports.parse = function (path) {
  
  var stream = new Stream()
  var parser = new Parser()
  var count = 0
  if(!path.length)
    path = null
  parser.onValue = function () {
    if(!this.root && this.stack.length == 1){
      stream.root = this.value
      }
    if(!path || this.stack.length !== path.length)
      return
    var _path = []
    for( var i = 0; i < (path.length - 1); i++) {
      var key = path[i]
      var c = this.stack[1 + (+i)]
      
      if(!c) {
        return
      }
      var m = check(key, c.key)
      _path.push(c.key)
        
       if(!m)
        return
      
    }
    var c = this
 
    var key = path[path.length - 1]
      var m = check(key, c.key)
     if(!m)
      return
      _path.push(c.key)

  count ++
  stream.emit('data', this.value[this.key])
  }


  parser.onError = function (err) {
    stream.emit('error', err)
  }
  stream.readable = true
  stream.writable = true
  stream.write = function (chunk) {
    if('string' === typeof chunk) {
      if ('undefined' === typeof Buffer) {
        var buf = new Array(chunk.length)
        for (var i = 0; i < chunk.length; i++) buf[i] = chunk.charCodeAt(i)
        chunk = new Int32Array(buf)
      } else {
        chunk = new Buffer(chunk)
      }
    }
    parser.write(chunk)
  }
  stream.end = function (data) {
    if(data)
      stream.write(data)
    if(!count && !path)
      stream.emit('data', stream.root)
    stream.emit('end')
  }
  return stream
}

function check (x, y) {
  if ('string' === typeof x)
    return y == x
  else if (x && 'function' === typeof x.exec)
    return x.exec(y)
  else if ('boolean' === typeof x)
    return x
  else if ('function' === typeof x)
    return x(y)
  return false
}

exports.stringify = function (op, sep, cl) {
  if (op === false){
    op = ''
    sep = '\n'
    cl = ''
  } else if (op == null) {
  
    op = '[\n'
    sep = '\n,\n'
    cl = '\n]\n'
  
  }

  //else, what ever you like
  
  var stream = new Stream ()
    , first = true
    , ended = false
    , anyData = false
  stream.write = function (data) {
    anyData = true
    var json = JSON.stringify(data)
    if(first) { first = false ; stream.emit('data', op + json)}
    else stream.emit('data', sep + json)
  }
  stream.end = function (data) {
    if(ended)
      return
    ended = true
    if(data) stream.write(data)
    if(!anyData) stream.emit('data', op)
    stream.emit('data', cl)
    
    stream.emit('end')
  }
  stream.writable = true
  stream.readable = true

  return stream
}

exports.stringifyObject = function (op, sep, cl) {
  if (op === false){
    op = ''
    sep = '\n'
    cl = ''
  } else if (op == null) {
  
    op = '{\n'
    sep = '\n,\n'
    cl = '\n}\n'
  
  }

  //else, what ever you like
  
  var stream = new Stream ()
    , first = true
    , ended = false
    , anyData = false
  stream.write = function (data) {
    anyData = true
    var json = JSON.stringify(data[0]) + ':' + JSON.stringify(data[1])
    if(first) { first = false ; stream.emit('data', op + json)}
    else stream.emit('data', sep + json)
  }
  stream.end = function (data) {
    if(ended) return
    ended = true
    if(data) stream.write(data)
    if(!anyData) stream.emit('data', op)
    stream.emit('data', cl)
    
    stream.emit('end')
  }
  stream.writable = true
  stream.readable = true

  return stream
}
});

require.define("/node_modules/testling/node_modules/JSONStream/node_modules/jsonparse/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"jsonparse.js"}});

require.define("/node_modules/testling/node_modules/JSONStream/node_modules/jsonparse/jsonparse.js",function(require,module,exports,__dirname,__filename,process){/*global Buffer*/
// Named constants with unique integer values
var C = {};
// Tokens
var LEFT_BRACE    = C.LEFT_BRACE    = 0x1;
var RIGHT_BRACE   = C.RIGHT_BRACE   = 0x2;
var LEFT_BRACKET  = C.LEFT_BRACKET  = 0x3;
var RIGHT_BRACKET = C.RIGHT_BRACKET = 0x4;
var COLON         = C.COLON         = 0x5;
var COMMA         = C.COMMA         = 0x6;
var TRUE          = C.TRUE          = 0x7;
var FALSE         = C.FALSE         = 0x8;
var NULL          = C.NULL          = 0x9;
var STRING        = C.STRING        = 0xa;
var NUMBER        = C.NUMBER        = 0xb;
// Tokenizer States
var START   = C.START   = 0x11;
var TRUE1   = C.TRUE1   = 0x21;
var TRUE2   = C.TRUE2   = 0x22;
var TRUE3   = C.TRUE3   = 0x23;
var FALSE1  = C.FALSE1  = 0x31;
var FALSE2  = C.FALSE2  = 0x32;
var FALSE3  = C.FALSE3  = 0x33;
var FALSE4  = C.FALSE4  = 0x34;
var NULL1   = C.NULL1   = 0x41;
var NULL2   = C.NULL3   = 0x42;
var NULL3   = C.NULL2   = 0x43;
var NUMBER1 = C.NUMBER1 = 0x51;
var NUMBER2 = C.NUMBER2 = 0x52;
var NUMBER3 = C.NUMBER3 = 0x53;
var NUMBER4 = C.NUMBER4 = 0x54;
var NUMBER5 = C.NUMBER5 = 0x55;
var NUMBER6 = C.NUMBER6 = 0x56;
var NUMBER7 = C.NUMBER7 = 0x57;
var NUMBER8 = C.NUMBER8 = 0x58;
var STRING1 = C.STRING1 = 0x61;
var STRING2 = C.STRING2 = 0x62;
var STRING3 = C.STRING3 = 0x63;
var STRING4 = C.STRING4 = 0x64;
var STRING5 = C.STRING5 = 0x65;
var STRING6 = C.STRING6 = 0x66;
// Parser States
var VALUE   = C.VALUE   = 0x71;
var KEY     = C.KEY     = 0x72;
// Parser Modes
var OBJECT  = C.OBJECT  = 0x81;
var ARRAY   = C.ARRAY   = 0x82;

// Slow code to string converter (only used when throwing syntax errors)
function toknam(code) {
  var keys = Object.keys(C);
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    if (C[key] === code) { return key; }
  }
  return code && ("0x" + code.toString(16));
}


function Parser() {
  this.tState = START;
  this.value = undefined;

  this.string = undefined; // string data
  this.unicode = undefined; // unicode escapes

  // For number parsing
  this.negative = undefined;
  this.magnatude = undefined;
  this.position = undefined;
  this.exponent = undefined;
  this.negativeExponent = undefined;
  
  this.key = undefined;
  this.mode = undefined;
  this.stack = [];
  this.state = VALUE;
}
var proto = Parser.prototype;
proto.charError = function (buffer, i) {
  this.onError(new Error("Unexpected " + JSON.stringify(String.fromCharCode(buffer[i])) + " at position " + i + " in state " + toknam(this.tState)));
};
proto.onError = function (err) { throw err; };
proto.write = function (buffer) {
  //process.stdout.write("Input: ");
  //console.dir(buffer.toString());
  var n;
  for (var i = 0, l = buffer.length; i < l; i++) {
    switch (this.tState) {
    case START:
      n = buffer[i];
      switch (n) {
      case 0x7b: this.onToken(LEFT_BRACE, "{"); break; // {
      case 0x7d: this.onToken(RIGHT_BRACE, "}"); break; // }
      case 0x5b: this.onToken(LEFT_BRACKET, "["); break; // [
      case 0x5d: this.onToken(RIGHT_BRACKET, "]"); break; // ]
      case 0x3a: this.onToken(COLON, ":"); break; // :
      case 0x2c: this.onToken(COMMA, ","); break; // ,
      case 0x74: this.tState = TRUE1; break; // t
      case 0x66: this.tState = FALSE1; break; // f
      case 0x6e: this.tState = NULL1; break; // n
      case 0x22: this.string = ""; this.tState = STRING1; break; // "
      case 0x2d: this.negative = true; this.tState = NUMBER1; break; // -
      case 0x30: this.magnatude = 0; this.tState = NUMBER2; break; // 0
      default:
        if (n > 0x30 && n < 0x40) { // 1-9
          this.magnatude = n - 0x30; this.tState = NUMBER3;
        } else if (n === 0x20 || n === 0x09 || n === 0x0a || n === 0x0d) {
          // whitespace
        } else { this.charError(buffer, i); }
        break;
      }
      break;
    case STRING1: // After open quote
      n = buffer[i];
      // TODO: Handle native utf8 characters, this code assumes ASCII input
      if (n === 0x22) { this.tState = START; this.onToken(STRING, this.string); this.string = undefined; }
      else if (n === 0x5c) { this.tState = STRING2; }
      else if (n >= 0x20) { this.string += String.fromCharCode(n); }
      else { this.charError(buffer, i); }
      break;
    case STRING2: // After backslash
      n = buffer[i];
      switch (n) {
      case 0x22: this.string += "\""; this.tState = STRING1; break;
      case 0x5c: this.string += "\\"; this.tState = STRING1; break;
      case 0x2f: this.string += "\/"; this.tState = STRING1; break;
      case 0x62: this.string += "\b"; this.tState = STRING1; break;
      case 0x66: this.string += "\f"; this.tState = STRING1; break;
      case 0x6e: this.string += "\n"; this.tState = STRING1; break;
      case 0x72: this.string += "\r"; this.tState = STRING1; break;
      case 0x74: this.string += "\t"; this.tState = STRING1; break;
      case 0x75: this.unicode = ""; this.tState = STRING3; break;
      default: this.charError(buffer, i); break;
      }
      break;
    case STRING3: case STRING4: case STRING5: case STRING6: // unicode hex codes
      n = buffer[i];
      // 0-9 A-F a-f
      if ((n >= 0x30 && n < 0x40) || (n > 0x40 && n <= 0x46) || (n > 0x60 && n <= 0x66)) {
        this.unicode += String.fromCharCode(n);
        if (this.tState++ === STRING6) {
          this.string += String.fromCharCode(parseInt(this.unicode, 16));
          this.unicode = undefined;
          this.tState = STRING1; 
        }
      } else {
        this.charError(buffer, i);
      }
      break;
    case NUMBER1: // after minus
      n = buffer[i];
      if (n === 0x30) { this.magnatude = 0; this.tState = NUMBER2; }
      else if (n > 0x30 && n < 0x40) { this.magnatude = n - 0x30; this.tState = NUMBER3; }
      else { this.charError(buffer, i); }
      break;
    case NUMBER2: // * After initial zero
      switch (buffer[i]) {
      case 0x2e: // .
        this.position = 0.1; this.tState = NUMBER4; break;
      case 0x65: case 0x45: // e/E
        this.exponent = 0; this.tState = NUMBER6; break;
      default:
        this.tState = START;
        this.onToken(NUMBER, 0);
        this.magnatude = undefined;
        this.negative = undefined;
        i--;
        break;
      }
      break;
    case NUMBER3: // * After digit (before period)
      n = buffer[i];
      switch (n) {
      case 0x2e: // .
        this.position = 0.1; this.tState = NUMBER4; break;
      case 0x65: case 0x45: // e/E
        this.exponent = 0; this.tState = NUMBER6; break;
      default: 
        if (n >= 0x30 && n < 0x40) { this.magnatude = this.magnatude * 10 + n - 0x30; }
        else {
          this.tState = START; 
          if (this.negative) {
            this.magnatude = -this.magnatude;
            this.negative = undefined;
          }
          this.onToken(NUMBER, this.magnatude); 
          this.magnatude = undefined;
          i--;
        }
        break;
      }
      break;
    case NUMBER4: // After period
      n = buffer[i];
      if (n >= 0x30 && n < 0x40) { // 0-9
        this.magnatude += this.position * (n - 0x30);
        this.position /= 10;
        this.tState = NUMBER5; 
      } else { this.charError(buffer, i); }
      break;
    case NUMBER5: // * After digit (after period)
      n = buffer[i];
      if (n >= 0x30 && n < 0x40) { // 0-9
        this.magnatude += this.position * (n - 0x30);
        this.position /= 10;
      }
      else if (n === 0x65 || n === 0x45) { this.exponent = 0; this.tState = NUMBER6; } // E/e
      else {
        this.tState = START; 
        if (this.negative) {
          this.magnatude = -this.magnatude;
          this.negative = undefined;
        }
        this.onToken(NUMBER, this.negative ? -this.magnatude : this.magnatude); 
        this.magnatude = undefined;
        this.position = undefined;
        i--; 
      }
      break;
    case NUMBER6: // After E
      n = buffer[i];
      if (n === 0x2b || n === 0x2d) { // +/-
        if (n === 0x2d) { this.negativeExponent = true; }
        this.tState = NUMBER7;
      }
      else if (n >= 0x30 && n < 0x40) {
        this.exponent = this.exponent * 10 + (n - 0x30);
        this.tState = NUMBER8;
      }
      else { this.charError(buffer, i); }  
      break;
    case NUMBER7: // After +/-
      n = buffer[i];
      if (n >= 0x30 && n < 0x40) { // 0-9
        this.exponent = this.exponent * 10 + (n - 0x30);
        this.state = NUMBER8;
      }
      else { this.charError(buffer, i); }  
      break;
    case NUMBER8: // * After digit (after +/-)
      n = buffer[i];
      if (n >= 0x30 && n < 0x40) { // 0-9
        this.exponent = this.exponent * 10 + (n - 0x30);
      }
      else {
        if (this.negativeExponent) {
          this.exponent = -this.exponent;
          this.negativeExponent = undefined;
        }
        this.magnatude *= Math.pow(10, this.exponent);
        this.exponent = undefined;
        if (this.negative) { 
          this.magnatude = -this.magnatude;
          this.negative = undefined;
        }
        this.tState = START;
        this.onToken(NUMBER, this.magnatude);
        this.magnatude = undefined;
        i--; 
      }  
      break;
    case TRUE1: // r
      if (buffer[i] === 0x72) { this.tState = TRUE2; }
      else { this.charError(buffer, i); }
      break;
    case TRUE2: // u
      if (buffer[i] === 0x75) { this.tState = TRUE3; }
      else { this.charError(buffer, i); }
      break;
    case TRUE3: // e
      if (buffer[i] === 0x65) { this.tState = START; this.onToken(TRUE, true); }
      else { this.charError(buffer, i); }
      break;
    case FALSE1: // a
      if (buffer[i] === 0x61) { this.tState = FALSE2; }
      else { this.charError(buffer, i); }
      break;
    case FALSE2: // l
      if (buffer[i] === 0x6c) { this.tState = FALSE3; }
      else { this.charError(buffer, i); }
      break;
    case FALSE3: // s
      if (buffer[i] === 0x73) { this.tState = FALSE4; }
      else { this.charError(buffer, i); }
      break;
    case FALSE4: // e
      if (buffer[i] === 0x65) { this.tState = START; this.onToken(FALSE, false); }
      else { this.charError(buffer, i); }
      break;
    case NULL1: // u
      if (buffer[i] === 0x75) { this.tState = NULL2; }
      else { this.charError(buffer, i); }
      break;
    case NULL2: // l
      if (buffer[i] === 0x6c) { this.tState = NULL3; }
      else { this.charError(buffer, i); }
      break;
    case NULL3: // l
      if (buffer[i] === 0x6c) { this.tState = START; this.onToken(NULL, null); }
      else { this.charError(buffer, i); }
      break;
    }
  }
};
proto.onToken = function (token, value) {
  // Override this to get events
};

proto.parseError = function (token, value) {
  this.onError(new Error("Unexpected " + toknam(token) + (value ? ("(" + JSON.stringify(value) + ")") : "") + " in state " + toknam(this.state)));
};
proto.onError = function (err) { throw err; };
proto.push = function () {
  this.stack.push({value: this.value, key: this.key, mode: this.mode});
};
proto.pop = function () {
  var value = this.value;
  var parent = this.stack.pop();
  this.value = parent.value;
  this.key = parent.key;
  this.mode = parent.mode;
  this.emit(value);
  if (!this.mode) { this.state = VALUE; }
};
proto.emit = function (value) {
  if (this.mode) { this.state = COMMA; }
  this.onValue(value);
};
proto.onValue = function (value) {
  // Override me
};  
proto.onToken = function (token, value) {
  //console.log("OnToken: state=%s token=%s %s", toknam(this.state), toknam(token), value?JSON.stringify(value):"");
  switch (this.state) {
  case VALUE:
    switch (token) {
    case STRING: case NUMBER: case TRUE: case FALSE: case NULL:
      if (this.value) {
        this.value[this.key] = value;
      }
      this.emit(value);
    break;  
    case LEFT_BRACE:
      this.push();
      if (this.value) {
        this.value = this.value[this.key] = {};
      } else {
        this.value = {};
      }
      this.key = undefined;
      this.state = KEY;
      this.mode = OBJECT;
      break;
    case LEFT_BRACKET:
      this.push();
      if (this.value) {
        this.value = this.value[this.key] = [];
      } else {
        this.value = [];
      }
      this.key = 0;
      this.mode = ARRAY;
      this.state = VALUE;
      break;
    case RIGHT_BRACE:
      if (this.mode === OBJECT) {
        this.pop();
      } else {
        this.parseError(token, value);
      }
      break;
    case RIGHT_BRACKET:
      if (this.mode === ARRAY) {
        this.pop();
      } else {
        this.parseError(token, value);
      }
      break;
    default:
      this.parseError(token, value); break;
    }
    break;
  case KEY:
    if (token === STRING) {
      this.key = value;
      this.state = COLON;
    } else if (token === RIGHT_BRACE) {
      this.pop();
    } else {
      this.parseError(token, value);
    }
    break;
  case COLON:
    if (token === COLON) { this.state = VALUE; }
    else { this.parseError(token, value); }
    break;
  case COMMA:
    if (token === COMMA) { 
      if (this.mode === ARRAY) { this.key++; this.state = VALUE; }
      else if (this.mode === OBJECT) { this.state = KEY; }

    } else if (token === RIGHT_BRACKET && this.mode === ARRAY || token === RIGHT_BRACE && this.mode === OBJECT) {
      this.pop();
    } else {
      this.parseError(token, value);
    }
    break;
  default:
    this.parseError(token, value);
  }
};

module.exports = Parser;
});

require.define("/node_modules/testling/node_modules/event-stream/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {}});

require.define("/node_modules/testling/node_modules/event-stream/index.js",function(require,module,exports,__dirname,__filename,process){//filter will reemit the data if cb(err,pass) pass is truthy
// reduce is more tricky
// maybe we want to group the reductions or emit progress updates occasionally
// the most basic reduce just emits one 'data' event after it has recieved 'end'


var Stream = require('stream').Stream
  , es = exports

es.Stream = Stream //re-export Stream from core

// through
//
// a stream that does nothing but re-emit the input.
// useful for aggregating a series of changing but not ending streams into one stream)

es.through = function (write, end) {
  write = write || function (data) { this.emit('data', data) }
  end = (
    'sync'== end || !end
  //use sync end. (default)
  ? function () { this.emit('end') }
  : 'async' == end || end === true 
  //use async end.
  //must eventually call drain if paused.
  //else will not end.
  ? function () {
      if(!this.paused)
        return this.emit('end')
     var self = this
     this.once('drain', function () {
        self.emit('end')
      })
    }
  //use custom end function
  : end 
  )
  var ended = false
  var stream = new Stream()
  stream.readable = stream.writable = true
  
  stream.write = function (data) {
    write.call(this, data)
    return !stream.paused
  }

  stream.on('end', function () {
    stream.readable = false
    if(!stream.writable)
      stream.destroy()
  })

  stream.end = function (data) {
    if(ended) return
    ended = true
    if(arguments.length) stream.write(data)
    this.writable = false
    end.call(this)
    if(!this.readable)
      this.destroy()
  }
  /*
    destroy is called on a writable stream when the upstream closes.
    it's basically END but something has gone wrong.
    I'm gonna emit 'close' and change then otherwise act as 'end'
  */
  stream.destroy = function () {
    ended = true
    stream.writable = stream.readable = false
    stream.emit('close')
  }
  stream.pause = function () {
    stream.paused = true
  }
  stream.resume = function () {
    if(stream.paused)
      stream.emit('drain')
    stream.paused = false
  }
  return stream
}

// buffered
//
// same as a through stream, but won't emit a chunk until the next tick.
// does not support any pausing. intended for testing purposes.

// XXX: rewrite this. this is crap. but do I actually use it? maybe just throw it away?
// okay, it's used in snob. so... throw this out and let snob use a legacy version. (fix later/never)


// merge / concat
//
// combine multiple streams into a single stream.
// will emit end only once
es.concat = //actually this should be called concat
es.merge = function (/*streams...*/) {
  var toMerge = [].slice.call(arguments)
  var stream = new Stream()
  var endCount = 0
  stream.writable = stream.readable = true

  toMerge.forEach(function (e) {
    e.pipe(stream, {end: false})
    var ended = false
    e.on('end', function () {
      if(ended) return
      ended = true
      endCount ++
      if(endCount == toMerge.length)
        stream.emit('end') 
    })
  })
  stream.write = function (data) {
    this.emit('data', data)
  }

  return stream
}


// writable stream, collects all events into an array 
// and calls back when 'end' occurs
// mainly I'm using this to test the other functions

es.writeArray = function (done) {
  if ('function' !== typeof done)
    throw new Error('function writeArray (done): done must be function')

  var a = new Stream ()
    , array = []
  a.write = function (l) {
    array.push(l)
  }
  a.end = function () {
    done(null, array)
  }
  a.writable = true
  a.readable = false
  return a
}

//return a Stream that reads the properties of an object
//respecting pause() and resume()

es.readArray = function (array) {
  var stream = new Stream()
    , i = 0
    , paused = false
 
  stream.readable = true  
  stream.writable = false
 
  if(!Array.isArray(array))
    throw new Error('event-stream.read expects an array')
  
  stream.resume = function () {
    paused = false
    var l = array.length
    while(i < l && !paused) {
      stream.emit('data', array[i++])
    }
    if(i == l)
      stream.emit('end'), stream.readable = false
  }
  process.nextTick(stream.resume)
  stream.pause = function () {
     paused = true
  }
  return stream
}

//
// readable (asyncFunction)
// return a stream that calls an async function while the stream is not paused.
//
// the function must take: (count, callback) {...
//
es.readable = function (func, continueOnError) {
  var stream = new Stream()
    , i = 0
    , paused = false
    , ended = false
    , reading = false

  stream.readable = true  
  stream.writable = false
 
  if('function' !== typeof func)
    throw new Error('event-stream.readable expects async function')
  
  stream.on('end', function () { ended = true })
  
  function get (err, data) {
    
    if(err) {
      stream.emit('error', err)
      if(!continueOnError) stream.emit('end')
    } else if (arguments.length > 1)
      stream.emit('data', data)

    process.nextTick(function () {
      if(ended || paused || reading) return
      try {
        reading = true
        func.call(stream, i++, function () {
          reading = false
          get.apply(null, arguments)
        })
      } catch (err) {
        stream.emit('error', err)    
      }
    })
  
  }
  stream.resume = function () {
    paused = false
    get()
  }
  process.nextTick(get)
  stream.pause = function () {
     paused = true
  }
  stream.destroy = function () {
    stream.emit('close')
    stream.emit('end')
    ended = true
  }
  return stream
}


//create an event stream and apply function to each .write
//emitting each response as data
//unless it's an empty callback

es.map = function (mapper) {
  var stream = new Stream()
    , inputs = 0
    , outputs = 0
    , ended = false
    , paused = false
    , destroyed = false

  stream.writable = true
  stream.readable = true
   
  stream.write = function () {
    if(ended) throw new Error('map stream is not writable')
    inputs ++
    var args = [].slice.call(arguments)
      , r
      , inNext = false 
    //pipe only allows one argument. so, do not 
    function next (err) {
      if(destroyed) return
      inNext = true
      outputs ++
      var args = [].slice.call(arguments)
      if(err) {
        args.unshift('error')
        return inNext = false, stream.emit.apply(stream, args)
      }
      args.shift() //drop err
      if (args.length){
        args.unshift('data')
        r = stream.emit.apply(stream, args)
      }
      if(inputs == outputs) {
        if(paused) paused = false, stream.emit('drain') //written all the incoming events
        if(ended)
          stream.end()
      }
      inNext = false
    }
    args.push(next)
    
    try {
      //catch sync errors and handle them like async errors
      var written = mapper.apply(null, args)
      if(written === false) paused = true
      return written
    } catch (err) {
      //if the callback has been called syncronously, and the error
      //has occured in an listener, throw it again.
      if(inNext)
        throw err
      next(err)
      return true
    }
  }

  stream.end = function () {
    var args = [].slice.call(arguments)
    //if end was called with args, write it, 
    ended = true //write will emit 'end' if ended is true
    if(args.length)
      return stream.write.apply(emitter, args)
    else if (inputs == outputs) //wait for processing
      stream.emit('end')
  }

  stream.destroy = function () {
    ended = destroyed = true
    stream.writable = stream.readable = paused = false
  }

  return stream
}


//
// map sync
//

es.mapSync = function (sync) { 
  return es.through(function write(data) {
    var mappedData = sync(data)
    if (typeof mappedData !== 'undefined')
      this.emit('data', mappedData)
  })
}

//
// log just print out what is coming through the stream, for debugging
//

es.log = function (name) {
  return es.through(function (data) {
    var args = [].slice.call(arguments)
    if(name) console.error(name, data)
    else     console.error(data)
    this.emit('data', data)
  })
}

//
// combine multiple streams together so that they act as a single stream
//

es.pipe = es.connect = function () {

  var streams = [].slice.call(arguments)
    , first = streams[0]
    , last = streams[streams.length - 1]
    , thepipe = es.duplex(first, last)

  if(streams.length == 1)
    return streams[0]
  else if (!streams.length)
    throw new Error('connect called with empty args')

  //pipe all the streams together

  function recurse (streams) {
    if(streams.length < 2)
      return
    streams[0].pipe(streams[1])
    recurse(streams.slice(1))  
  }
  
  recurse(streams)
 
  function onerror () {
    var args = [].slice.call(arguments)
    args.unshift('error')
    thepipe.emit.apply(thepipe, args)
  }
  
  streams.forEach(function (stream) {
    stream.on('error', onerror)
  })

  return thepipe
}

//
// child -- pipe through a child process
//

es.child = function (child) {

  return es.duplex(child.stdin, child.stdout)

}

//
// duplex -- pipe into one stream and out another
//

es.duplex = function (writer, reader) {
  var thepipe = new Stream()

  thepipe.__defineGetter__('writable', function () { return writer.writable })
  thepipe.__defineGetter__('readable', function () { return reader.readable })

  ;['write', 'end', 'close'].forEach(function (func) {
    thepipe[func] = function () {
      return writer[func].apply(writer, arguments)
    }
  })

  ;['resume', 'pause'].forEach(function (func) {
    thepipe[func] = function () { 
      thepipe.emit(func)
      if(reader[func])
        return reader[func].apply(reader, arguments)
      else
        reader.emit(func)
    }
  })

  ;['data', 'close'].forEach(function (event) {
    reader.on(event, function () {
      var args = [].slice.call(arguments)
      args.unshift(event)
      thepipe.emit.apply(thepipe, args)
    })
  })
  //only emit end once
  var ended = false
  reader.on('end', function () {
    if(ended) return
    ended = true
    var args = [].slice.call(arguments)
    args.unshift('end')
    thepipe.emit.apply(thepipe, args)
  })

  thepipe.destroy = function () {
    if(reader.destroy)
      reader.destroy()
    if(writer.destroy)
      writer.destroy()
  }

  return thepipe
}

es.split = function (matcher) {
  var soFar = ''
  if (!matcher)
    matcher = '\n'

  return es.through(function (buffer) { 
    var stream = this
      , pieces = (soFar + buffer).split(matcher)
    soFar = pieces.pop()

    pieces.forEach(function (piece) {
      stream.emit('data', piece)
    })

    return true
  },
  function () {
    if(soFar)
      this.emit('data', soFar)  
    this.emit('end')
  })
}

//
// gate 
//
// while the gate is shut(), buffer incoming. 
// 
// if gate is open() stream like normal.
//
// currently, when opened, this will emit all data unless it is shut again
// if downstream pauses it will still write, i'd like to make it respect pause, 
// but i'll need a test case first.

es.gate = function (shut) {

  var stream = new Stream()
    , queue = []
    , ended = false

    shut = (shut === false ? false : true) //default to shut

  stream.writable = true
  stream.readable = true

  stream.isShut = function () { return shut }
  stream.shut   = function () { shut = true }
  stream.open   = function () { shut = false; maybe() }
  
  function maybe () {
    while(queue.length && !shut) {
      var args = queue.shift()
      args.unshift('data')
      stream.emit.apply(stream, args)
    }
    stream.emit('drain')
    if(ended && !shut) 
      stream.emit('end')
  }
  
  stream.write = function () {
    var args = [].slice.call(arguments)
  
    queue.push(args)
    if (shut) return false //pause up stream pipes  

    maybe()
  }

  stream.end = function () {
    ended = true
    if (!queue.length)
      stream.emit('end')
  }

  return stream
}

//
// parse
//

es.parse = function () { 
  return es.through(function (data) {
    var obj
    try {
      if(data) //ignore empty lines
        obj = JSON.parse(data.toString())
    } catch (err) {
      return console.error(err, 'attemping to parse:', data)
    }
    this.emit('data', obj)
  })
}
//
// stringify
//

es.stringify = function () { 
  return es.mapSync(function (e){
    return JSON.stringify(e) + '\n'
  }) 
}

//
// replace a string within a stream.
//
// warn: just concatenates the string and then does str.split().join(). 
// probably not optimal.
// for smallish responses, who cares?
// I need this for shadow-npm so it's only relatively small json files.

es.replace = function (from, to) {
  return es.connect(es.split(from), es.join(to))
} 

//
// join chunks with a joiner. just like Array#join
// also accepts a callback that is passed the chunks appended together
// this is still supported for legacy reasons.
// 

es.join = function (str) {
  
  //legacy api
  if('function' === typeof str)
    return es.wait(str)

  var stream = new Stream()
  var first = true
  stream.readable = stream.writable = true
  stream.write = function (data) {
    if(!first)
      stream.emit('data', str)
    first = false
    stream.emit('data', data)
    return true
  }
  stream.end = function (data) {
    if(data)
      this.write(data)
    this.emit('end')
  }
  return stream
}


//
// wait. callback when 'end' is emitted, with all chunks appended as string.
//

es.wait = function (callback) {
  var stream = new Stream()
  var body = ''
  stream.readable = true
  stream.writable = true
  stream.write = function (data) { body += data }
  stream.end = function (data) {
    if(data)
      body += data
    if(callback)
      callback(null, body)
    stream.emit('data', body)
    stream.emit('end')
  }
  return stream
}

//
// helper to make your module into a unix pipe
// simply add 
// 
// if(!module.parent)
//  require('event-stream').pipable(asyncFunctionOrStreams)
// 
// asyncFunctionOrStreams may be one or more Streams or if it is a function, 
// it will be automatically wrapped in es.map
//
// then pipe stuff into from the command line!
// 
// curl registry.npmjs.org/event-stream | node hello-pipeable.js | grep whatever
//
// etc!
//
// also, start pipeable running as a server!
//
// > node hello-pipeable.js --port 44444
// 

var setup = function (args) {
  return args.map(function (f) {
    var x = f()
      if('function' === typeof x)
        return es.map(x)
      return x
    })
}

es.pipeable = function () {
  if(process.title != 'node')
    return console.error('cannot use es.pipeable in the browser')
  //(require) inside brackets to fool browserify, because this does not make sense in the browser.
  var opts = (require)('optimist').argv
  var args = [].slice.call(arguments)
  
  if(opts.h || opts.help) {
    var name = process.argv[1]
    console.error([
      'Usage:',
      '',
      'node ' + name + ' [options]',
      '  --port PORT        turn this stream into a server',
      '  --host HOST        host of server (localhost is default)',
      '  --protocol         protocol http|net will require(protocol).createServer(...',
      '  --help             display this message',
      '',
      ' if --port is not set, will stream input from stdin',
      '',
      'also, pipe from or to files:',
      '',
      ' node '+name+ ' < file    #pipe from file into this stream',
      ' node '+name+ ' < infile > outfile    #pipe from file into this stream',     
      '',
    ].join('\n'))
  
  } else if (!opts.port) {
    var streams = setup(args)
    streams.unshift(es.split())
    //streams.unshift()
    streams.push(process.stdout)
    var c = es.connect.apply(null, streams)
    process.openStdin().pipe(c) //there
    return c

  } else {
  
    opts.host = opts.host || 'localhost'
    opts.protocol = opts.protocol || 'http'
    
    var protocol = (require)(opts.protocol)
        
    var server = protocol.createServer(function (instream, outstream) {  
      var streams = setup(args)
      streams.unshift(es.split())
      streams.unshift(instream)
      streams.push(outstream || instream)
      es.pipe.apply(null, streams)
    })
    
    server.listen(opts.port, opts.host)

    console.error(process.argv[1] +' is listening for "' + opts.protocol + '" on ' + opts.host + ':' + opts.port)  
  }
}
});

require.define("/node_modules/event-stream/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {}});

require.define("/node_modules/event-stream/index.js",function(require,module,exports,__dirname,__filename,process){//filter will reemit the data if cb(err,pass) pass is truthy
// reduce is more tricky
// maybe we want to group the reductions or emit progress updates occasionally
// the most basic reduce just emits one 'data' event after it has recieved 'end'


var Stream = require('stream').Stream
  , es = exports

es.Stream = Stream //re-export Stream from core

// through
//
// a stream that does nothing but re-emit the input.
// useful for aggregating a series of changing but not ending streams into one stream)

es.through = function (write, end) {
  write = write || function (data) { this.emit('data', data) }
  end = (
    'sync'== end || !end
  //use sync end. (default)
  ? function () { this.emit('end') }
  : 'async' == end || end === true 
  //use async end.
  //must eventually call drain if paused.
  //else will not end.
  ? function () {
      if(!this.paused)
        return this.emit('end')
     var self = this
     this.once('drain', function () {
        self.emit('end')
      })
    }
  //use custom end function
  : end 
  )
  var ended = false, destroyed = false
  var stream = new Stream()
  stream.readable = stream.writable = true
  stream.paused = false  
  stream.write = function (data) {
    write.call(this, data)
    return !stream.paused
  }
  //this will be registered as the first 'end' listener
  //must call destroy next tick, to make sure we're after any
  //stream piped from here. 
  stream.on('end', function () {
    stream.readable = false
    if(!stream.writable)
      process.nextTick(function () {
        stream.destroy()
      })
  })

  stream.end = function (data) {
    if(ended) throw new Error('cannot call end twice')
    ended = true
    if(arguments.length) stream.write(data)
    this.writable = false
    end.call(this)
    if(!this.readable)
      this.destroy()
  }
  /*
    destroy is called on a writable stream when the upstream closes.
    it's basically END but something has gone wrong.
    I'm gonna emit 'close' and change then otherwise act as 'end'
  */
  stream.destroy = function () {
    if(destroyed) return
    destroyed = true
    ended = true
    stream.writable = stream.readable = false
    stream.emit('close')
  }
  stream.pause = function () {
    stream.paused = true
  }
  stream.resume = function () {
    if(stream.paused) {
      stream.paused = false
      stream.emit('drain')
    }
  }
  return stream
}

// buffered
//
// same as a through stream, but won't emit a chunk until the next tick.
// does not support any pausing. intended for testing purposes.

// XXX: rewrite this. this is crap. but do I actually use it? maybe just throw it away?
// okay, it's used in snob. so... throw this out and let snob use a legacy version. (fix later/never)


// merge / concat
//
// combine multiple streams into a single stream.
// will emit end only once
es.concat = //actually this should be called concat
es.merge = function (/*streams...*/) {
  var toMerge = [].slice.call(arguments)
  var stream = new Stream()
  var endCount = 0
  stream.writable = stream.readable = true

  toMerge.forEach(function (e) {
    e.pipe(stream, {end: false})
    var ended = false
    e.on('end', function () {
      if(ended) return
      ended = true
      endCount ++
      if(endCount == toMerge.length)
        stream.emit('end') 
    })
  })
  stream.write = function (data) {
    this.emit('data', data)
  }
  stream.destroy = function () {
    merge.forEach(function (e) {
      if(e.destroy) e.destroy()
    })
  }
  return stream
}


// writable stream, collects all events into an array 
// and calls back when 'end' occurs
// mainly I'm using this to test the other functions

es.writeArray = function (done) {
  if ('function' !== typeof done)
    throw new Error('function writeArray (done): done must be function')

  var a = new Stream ()
    , array = [], isDone = false
  a.write = function (l) {
    array.push(l)
  }
  a.end = function () {
    isDone = true
    done(null, array)
  }
  a.writable = true
  a.readable = false
  a.destroy = function () {
    a.writable = a.readable = false
    if(isDone) return
    done(new Error('destroyed befor end'), array)
  }
  return a
}

//return a Stream that reads the properties of an object
//respecting pause() and resume()

es.readArray = function (array) {
  var stream = new Stream()
    , i = 0
    , paused = false
    , ended = false
 
  stream.readable = true  
  stream.writable = false
 
  if(!Array.isArray(array))
    throw new Error('event-stream.read expects an array')
  
  stream.resume = function () {
    if(ended) return
    paused = false
    var l = array.length
    while(i < l && !paused && !ended) {
      stream.emit('data', array[i++])
    }
    if(i == l && !ended)
      ended = true, stream.readable = false, stream.emit('end')
  }
  process.nextTick(stream.resume)
  stream.pause = function () {
     paused = true
  }
  stream.destroy = function () {
    ended = true
    stream.emit('close')
  }
  return stream
}

//
// readable (asyncFunction)
// return a stream that calls an async function while the stream is not paused.
//
// the function must take: (count, callback) {...
//
es.readable = function (func, continueOnError) {
  var stream = new Stream()
    , i = 0
    , paused = false
    , ended = false
    , reading = false

  stream.readable = true  
  stream.writable = false
 
  if('function' !== typeof func)
    throw new Error('event-stream.readable expects async function')
  
  stream.on('end', function () { ended = true })
  
  function get (err, data) {
    
    if(err) {
      stream.emit('error', err)
      if(!continueOnError) stream.emit('end')
    } else if (arguments.length > 1)
      stream.emit('data', data)

    process.nextTick(function () {
      if(ended || paused || reading) return
      try {
        reading = true
        func.call(stream, i++, function () {
          reading = false
          get.apply(null, arguments)
        })
      } catch (err) {
        stream.emit('error', err)    
      }
    })
  
  }
  stream.resume = function () {
    paused = false
    get()
  }
  process.nextTick(get)
  stream.pause = function () {
     paused = true
  }
  stream.destroy = function () {
    stream.emit('close')
    stream.emit('end')
    ended = true
  }
  return stream
}


//create an event stream and apply function to each .write
//emitting each response as data
//unless it's an empty callback

es.map = function (mapper) {
  var stream = new Stream()
    , inputs = 0
    , outputs = 0
    , ended = false
    , paused = false
    , destroyed = false

  stream.writable = true
  stream.readable = true
   
  stream.write = function () {
    if(ended) throw new Error('map stream is not writable')
    inputs ++
    var args = [].slice.call(arguments)
      , r
      , inNext = false 
    //pipe only allows one argument. so, do not 
    function next (err) {
      if(destroyed) return
      inNext = true
      outputs ++
      var args = [].slice.call(arguments)
      if(err) {
        args.unshift('error')
        return inNext = false, stream.emit.apply(stream, args)
      }
      args.shift() //drop err
      if (args.length){
        args.unshift('data')
        r = stream.emit.apply(stream, args)
      }
      if(inputs == outputs) {
        if(paused) paused = false, stream.emit('drain') //written all the incoming events
        if(ended)
          stream.end()
      }
      inNext = false
    }
    args.push(next)
    
    try {
      //catch sync errors and handle them like async errors
      var written = mapper.apply(null, args)
      if(written === false) paused = true
      return written
    } catch (err) {
      //if the callback has been called syncronously, and the error
      //has occured in an listener, throw it again.
      if(inNext)
        throw err
      next(err)
      return true
    }
  }

  stream.end = function () {
    var args = [].slice.call(arguments)
    //if end was called with args, write it, 
    ended = true //write will emit 'end' if ended is true
    if(args.length)
      return stream.write.apply(emitter, args)
    else if (inputs == outputs) //wait for processing
      stream.emit('end')
  }

  stream.destroy = function () {
    ended = destroyed = true
    stream.writable = stream.readable = paused = false
  }

  return stream
}


//
// map sync
//

es.mapSync = function (sync) { 
  return es.through(function write(data) {
    var mappedData = sync(data)
    if (typeof mappedData !== 'undefined')
      this.emit('data', mappedData)
  })
}

//
// log just print out what is coming through the stream, for debugging
//

es.log = function (name) {
  return es.through(function (data) {
    var args = [].slice.call(arguments)
    if(name) console.error(name, data)
    else     console.error(data)
    this.emit('data', data)
  })
}

//
// combine multiple streams together so that they act as a single stream
//

es.pipe = es.connect = function () {

  var streams = [].slice.call(arguments)
    , first = streams[0]
    , last = streams[streams.length - 1]
    , thepipe = es.duplex(first, last)

  if(streams.length == 1)
    return streams[0]
  else if (!streams.length)
    throw new Error('connect called with empty args')

  //pipe all the streams together

  function recurse (streams) {
    if(streams.length < 2)
      return
    streams[0].pipe(streams[1])
    recurse(streams.slice(1))  
  }
  
  recurse(streams)
 
  function onerror () {
    var args = [].slice.call(arguments)
    args.unshift('error')
    thepipe.emit.apply(thepipe, args)
  }
  
  streams.forEach(function (stream) {
    stream.on('error', onerror)
  })

  return thepipe
}

//
// child -- pipe through a child process
//

es.child = function (child) {

  return es.duplex(child.stdin, child.stdout)

}

//
// duplex -- pipe into one stream and out another
//

es.duplex = function (writer, reader) {
  var thepipe = new Stream()

  thepipe.__defineGetter__('writable', function () { return writer.writable })
  thepipe.__defineGetter__('readable', function () { return reader.readable })
  ;['write', 'end', 'destroy'].forEach(function (func) {
    thepipe[func] = function () {
      return writer[func].apply(writer, arguments)
    }
  })

  ;['resume', 'pause'].forEach(function (func) {
    thepipe[func] = function () { 
      thepipe.emit(func)
      if(reader[func])
        return reader[func].apply(reader, arguments)
      else
        reader.emit(func)
    }
  })

  ;['data', 'close'].forEach(function (event) {
    reader.on(event, function () {
      var args = [].slice.call(arguments)
      args.unshift(event)
      thepipe.emit.apply(thepipe, args)
    })
  })
  //only emit end once
  var ended = false
  reader.on('end', function () {
    if(ended) return
    ended = true
    var args = [].slice.call(arguments)
    args.unshift('end')
    thepipe.emit.apply(thepipe, args)
  })

  return thepipe
}

es.split = function (matcher) {
  var soFar = ''
  if (!matcher)
    matcher = '\n'

  return es.through(function (buffer) { 
    var stream = this
      , pieces = (soFar + buffer).split(matcher)
    soFar = pieces.pop()

    pieces.forEach(function (piece) {
      stream.emit('data', piece)
    })

    return true
  },
  function () {
    if(soFar)
      this.emit('data', soFar)  
    this.emit('end')
  })
}

//
// gate 
//
// while the gate is shut(), buffer incoming. 
// 
// if gate is open() stream like normal.
//
// currently, when opened, this will emit all data unless it is shut again
// if downstream pauses it will still write, i'd like to make it respect pause, 
// but i'll need a test case first.

es.gate = function (shut) {

  var stream = new Stream()
    , queue = []
    , ended = false

    shut = (shut === false ? false : true) //default to shut

  stream.writable = true
  stream.readable = true

  stream.isShut = function () { return shut }
  stream.shut   = function () { shut = true }
  stream.open   = function () { shut = false; maybe() }
  
  function maybe () {
    while(queue.length && !shut) {
      var args = queue.shift()
      args.unshift('data')
      stream.emit.apply(stream, args)
    }
    stream.emit('drain')
    if(ended && !shut) 
      stream.emit('end')
  }
  
  stream.write = function () {
    var args = [].slice.call(arguments)
  
    queue.push(args)
    if (shut) return false //pause up stream pipes  

    maybe()
  }

  stream.end = function () {
    ended = true
    if (!queue.length)
      stream.emit('end')
  }

  return stream
}

//
// parse
//

es.parse = function () { 
  return es.through(function (data) {
    var obj
    try {
      if(data) //ignore empty lines
        obj = JSON.parse(data.toString())
    } catch (err) {
      return console.error(err, 'attemping to parse:', data)
    }
    this.emit('data', obj)
  })
}
//
// stringify
//

es.stringify = function () { 
  return es.mapSync(function (e){
    return JSON.stringify(e) + '\n'
  }) 
}

//
// replace a string within a stream.
//
// warn: just concatenates the string and then does str.split().join(). 
// probably not optimal.
// for smallish responses, who cares?
// I need this for shadow-npm so it's only relatively small json files.

es.replace = function (from, to) {
  return es.connect(es.split(from), es.join(to))
} 

//
// join chunks with a joiner. just like Array#join
// also accepts a callback that is passed the chunks appended together
// this is still supported for legacy reasons.
// 

es.join = function (str) {
  
  //legacy api
  if('function' === typeof str)
    return es.wait(str)

  var first = true
  return es.through(function (data) {
    if(!first)
      this.emit('data', str)
    first = false
    this.emit('data', data)
    return true
  })
}


//
// wait. callback when 'end' is emitted, with all chunks appended as string.
//

es.wait = function (callback) {
  var stream = new Stream()
  var body = ''
  return es.through(function (data) { body += data },
    function () {
      stream.emit('data', body)
      stream.emit('end')
      if(callback) callback(null, body)
    })
}

//
// helper to make your module into a unix pipe
// simply add 
// 
// if(!module.parent)
//  require('event-stream').pipable(asyncFunctionOrStreams)
// 
// asyncFunctionOrStreams may be one or more Streams or if it is a function, 
// it will be automatically wrapped in es.map
//
// then pipe stuff into from the command line!
// 
// curl registry.npmjs.org/event-stream | node hello-pipeable.js | grep whatever
//
// etc!
//
// also, start pipeable running as a server!
//
// > node hello-pipeable.js --port 44444
// 

var setup = function (args) {
  return args.map(function (f) {
    var x = f()
      if('function' === typeof x)
        return es.map(x)
      return x
    })
}

es.pipeable = function () {
  if(process.title != 'node')
    return console.error('cannot use es.pipeable in the browser')
  //(require) inside brackets to fool browserify, because this does not make sense in the browser.
  var opts = (require)('optimist').argv
  var args = [].slice.call(arguments)
  
  if(opts.h || opts.help) {
    var name = process.argv[1]
    console.error([
      'Usage:',
      '',
      'node ' + name + ' [options]',
      '  --port PORT        turn this stream into a server',
      '  --host HOST        host of server (localhost is default)',
      '  --protocol         protocol http|net will require(protocol).createServer(...',
      '  --help             display this message',
      '',
      ' if --port is not set, will stream input from stdin',
      '',
      'also, pipe from or to files:',
      '',
      ' node '+name+ ' < file    #pipe from file into this stream',
      ' node '+name+ ' < infile > outfile    #pipe from file into this stream',     
      '',
    ].join('\n'))
  
  } else if (!opts.port) {
    var streams = setup(args)
    streams.unshift(es.split())
    //streams.unshift()
    streams.push(process.stdout)
    var c = es.connect.apply(null, streams)
    process.openStdin().pipe(c) //there
    return c

  } else {
  
    opts.host = opts.host || 'localhost'
    opts.protocol = opts.protocol || 'http'
    
    var protocol = (require)(opts.protocol)
        
    var server = protocol.createServer(function (instream, outstream) {  
      var streams = setup(args)
      streams.unshift(es.split())
      streams.unshift(instream)
      streams.push(outstream || instream)
      es.pipe.apply(null, streams)
    })
    
    server.listen(opts.port, opts.host)

    console.error(process.argv[1] +' is listening for "' + opts.protocol + '" on ' + opts.host + ':' + opts.port)  
  }
}
});

require.define("/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index"}});

require.define("/index.js",function(require,module,exports,__dirname,__filename,process){"use strict";

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
    return slice.call(arguments).reduce(combineFunctionsAsync)
}

function combineFunctionsAsync(memo, outer) {
    return partial(applyInOrderAsync, memo, outer)
}

function applyInOrderAsync(memo, outer) {
    var args = slice.call(arguments, 2)
        , callbackIndex = args.length - 1
        , inner = args[callbackIndex]

    args[callbackIndex] = partial(applyOuter, outer, inner)

    memo.apply(this, args)
}

function applyOuter(outer, inner) {
    var args = slice.call(arguments, 2).concat(inner)

    outer.apply(this, args)
}});

require.define("/node_modules/ap/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"./index.js"}});

require.define("/node_modules/ap/index.js",function(require,module,exports,__dirname,__filename,process){exports = module.exports = ap;
function ap (args, fn) {
    return function () {
        return fn.apply(this, args.concat.apply(args, arguments));
    };
}

exports.pa = pa;
function pa (args, fn) {
    return function () {
        return fn.apply(this, [].slice.call(arguments).concat(args));
    };
}

exports.apa = apa;
function apa (left, right, fn) {
    return function () {
        return fn.apply(this,
            left.concat.apply(left, arguments).concat(right)
        );
    };
}

exports.partial = partial;
function partial (fn) {
    var args = [].slice.call(arguments, 1);
    return ap(args, fn);
}

exports.partialRight = partialRight;
function partialRight (fn) {
    var args = [].slice.call(arguments, 1);
    return pa(args, fn);
}

exports.curry = curry;
function curry (fn) {
    return partial(partial, fn);
}

exports.curryRight = function curryRight (fn) {
    return partial(partialRight, fn);
}
});

require.define("/node_modules/sinon/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"./lib/sinon.js"}});

require.define("/node_modules/sinon/lib/sinon.js",function(require,module,exports,__dirname,__filename,process){/*jslint eqeqeq: false, onevar: false, forin: true, nomen: false, regexp: false, plusplus: false*/
/*global module, require, __dirname, document*/
/**
 * Sinon core utilities. For internal use only.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2011 Christian Johansen
 */
"use strict";

var sinon = (function (buster) {
    var div = typeof document != "undefined" && document.createElement("div");
    var hasOwn = Object.prototype.hasOwnProperty;

    function isDOMNode(obj) {
        var success = false;

        try {
            obj.appendChild(div);
            success = div.parentNode == obj;
        } catch (e) {
            return false;
        } finally {
            try {
                obj.removeChild(div);
            } catch (e) {
                // Remove failed, not much we can do about that
            }
        }

        return success;
    }

    function isElement(obj) {
        return div && obj && obj.nodeType === 1 && isDOMNode(obj);
    }

    function isFunction(obj) {
        return !!(obj && obj.constructor && obj.call && obj.apply);
    }

    function mirrorProperties(target, source) {
        for (var prop in source) {
            if (!hasOwn.call(target, prop)) {
                target[prop] = source[prop];
            }
        }
    }

    var sinon = {
        wrapMethod: function wrapMethod(object, property, method) {
            if (!object) {
                throw new TypeError("Should wrap property of object");
            }

            if (typeof method != "function") {
                throw new TypeError("Method wrapper should be function");
            }

            var wrappedMethod = object[property];

            if (!isFunction(wrappedMethod)) {
                throw new TypeError("Attempted to wrap " + (typeof wrappedMethod) + " property " +
                                    property + " as function");
            }

            if (wrappedMethod.restore && wrappedMethod.restore.sinon) {
                throw new TypeError("Attempted to wrap " + property + " which is already wrapped");
            }

            if (wrappedMethod.calledBefore) {
                var verb = !!wrappedMethod.returns ? "stubbed" : "spied on";
                throw new TypeError("Attempted to wrap " + property + " which is already " + verb);
            }

            // IE 8 does not support hasOwnProperty on the window object.
            var owned = hasOwn.call(object, property);
            object[property] = method;
            method.displayName = property;

            method.restore = function () {
                // For prototype properties try to reset by delete first.
                // If this fails (ex: localStorage on mobile safari) then force a reset
                // via direct assignment.
                if (!owned) {
                    delete object[property];
                }
                if (object[property] === method) {
                    object[property] = wrappedMethod;
                }
            };

            method.restore.sinon = true;
            mirrorProperties(method, wrappedMethod);

            return method;
        },

        extend: function extend(target) {
            for (var i = 1, l = arguments.length; i < l; i += 1) {
                for (var prop in arguments[i]) {
                    if (arguments[i].hasOwnProperty(prop)) {
                        target[prop] = arguments[i][prop];
                    }

                    // DONT ENUM bug, only care about toString
                    if (arguments[i].hasOwnProperty("toString") &&
                        arguments[i].toString != target.toString) {
                        target.toString = arguments[i].toString;
                    }
                }
            }

            return target;
        },

        create: function create(proto) {
            var F = function () {};
            F.prototype = proto;
            return new F();
        },

        deepEqual: function deepEqual(a, b) {
            if (sinon.match && sinon.match.isMatcher(a)) {
                return a.test(b);
            }
            if (typeof a != "object" || typeof b != "object") {
                return a === b;
            }

            if (isElement(a) || isElement(b)) {
                return a === b;
            }

            if (a === b) {
                return true;
            }

            var aString = Object.prototype.toString.call(a);
            if (aString != Object.prototype.toString.call(b)) {
                return false;
            }

            if (aString == "[object Array]") {
                if (a.length !== b.length) {
                    return false;
                }

                for (var i = 0, l = a.length; i < l; i += 1) {
                    if (!deepEqual(a[i], b[i])) {
                        return false;
                    }
                }

                return true;
            }

            var prop, aLength = 0, bLength = 0;

            for (prop in a) {
                aLength += 1;

                if (!deepEqual(a[prop], b[prop])) {
                    return false;
                }
            }

            for (prop in b) {
                bLength += 1;
            }

            if (aLength != bLength) {
                return false;
            }

            return true;
        },

        functionName: function functionName(func) {
            var name = func.displayName || func.name;

            // Use function decomposition as a last resort to get function
            // name. Does not rely on function decomposition to work - if it
            // doesn't debugging will be slightly less informative
            // (i.e. toString will say 'spy' rather than 'myFunc').
            if (!name) {
                var matches = func.toString().match(/function ([^\s\(]+)/);
                name = matches && matches[1];
            }

            return name;
        },

        functionToString: function toString() {
            if (this.getCall && this.callCount) {
                var thisValue, prop, i = this.callCount;

                while (i--) {
                    thisValue = this.getCall(i).thisValue;

                    for (prop in thisValue) {
                        if (thisValue[prop] === this) {
                            return prop;
                        }
                    }
                }
            }

            return this.displayName || "sinon fake";
        },

        getConfig: function (custom) {
            var config = {};
            custom = custom || {};
            var defaults = sinon.defaultConfig;

            for (var prop in defaults) {
                if (defaults.hasOwnProperty(prop)) {
                    config[prop] = custom.hasOwnProperty(prop) ? custom[prop] : defaults[prop];
                }
            }

            return config;
        },

        format: function (val) {
            return "" + val;
        },

        defaultConfig: {
            injectIntoThis: true,
            injectInto: null,
            properties: ["spy", "stub", "mock", "clock", "server", "requests"],
            useFakeTimers: true,
            useFakeServer: true
        },

        timesInWords: function timesInWords(count) {
            return count == 1 && "once" ||
                count == 2 && "twice" ||
                count == 3 && "thrice" ||
                (count || 0) + " times";
        },

        calledInOrder: function (spies) {
            for (var i = 1, l = spies.length; i < l; i++) {
                if (!spies[i - 1].calledBefore(spies[i])) {
                    return false;
                }
            }

            return true;
        },

        orderByFirstCall: function (spies) {
            return spies.sort(function (a, b) {
                // uuid, won't ever be equal
                var aCall = a.getCall(0);
                var bCall = b.getCall(0);
                var aId = aCall && aCall.callId || -1;
                var bId = bCall && bCall.callId || -1;

                return aId < bId ? -1 : 1;
            });
        },

        log: function () {},

        logError: function (label, err) {
            var msg = label + " threw exception: "
            sinon.log(msg + "[" + err.name + "] " + err.message);
            if (err.stack) { sinon.log(err.stack); }

            setTimeout(function () {
                err.message = msg + err.message;
                throw err;
            }, 0);
        },

        typeOf: function (value) {
            if (value === null) {
              return "null";
            }
            var string = Object.prototype.toString.call(value);
            return string.substring(8, string.length - 1).toLowerCase();
        }
    };

    var isNode = typeof module == "object" && typeof require == "function";

    if (isNode) {
        try {
            buster = { format: require("buster-format") };
        } catch (e) {}
        module.exports = sinon;
        module.exports.spy = require("./sinon/spy");
        module.exports.stub = require("./sinon/stub");
        module.exports.mock = require("./sinon/mock");
        module.exports.collection = require("./sinon/collection");
        module.exports.assert = require("./sinon/assert");
        module.exports.sandbox = require("./sinon/sandbox");
        module.exports.test = require("./sinon/test");
        module.exports.testCase = require("./sinon/test_case");
        module.exports.assert = require("./sinon/assert");
        module.exports.match = require("./sinon/match");
    }

    if (buster) {
        var formatter = sinon.create(buster.format);
        formatter.quoteStrings = false;
        sinon.format = function () {
            return formatter.ascii.apply(formatter, arguments);
        };
    } else if (isNode) {
        try {
            var util = require("util");
            sinon.format = function (value) {
                return typeof value == "object" && value.toString === Object.prototype.toString ? util.inspect(value) : value;
            };
        } catch (e) {
            /* Node, but no util module - would be very old, but better safe than
             sorry */
        }
    }

    return sinon;
}(typeof buster == "object" && buster));
});

require.define("/node_modules/sinon/node_modules/buster-format/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"./lib/buster-format"}});

require.define("/node_modules/sinon/node_modules/buster-format/lib/buster-format.js",function(require,module,exports,__dirname,__filename,process){if (typeof buster === "undefined") {
    var buster = {};
}

if (typeof module === "object" && typeof require === "function") {
    buster = require("buster-core");
}

buster.format = buster.format || {};
buster.format.excludeConstructors = ["Object", /^.$/];
buster.format.quoteStrings = true;

buster.format.ascii = (function () {
    "use strict";

    var hasOwn = Object.prototype.hasOwnProperty;

    var specialObjects = [];
    if (typeof global != "undefined") {
        specialObjects.push({ obj: global, value: "[object global]" });
    }
    if (typeof document != "undefined") {
        specialObjects.push({ obj: document, value: "[object HTMLDocument]" });
    }
    if (typeof window != "undefined") {
        specialObjects.push({ obj: window, value: "[object Window]" });
    }

    function keys(object) {
        var k = Object.keys && Object.keys(object) || [];

        if (k.length == 0) {
            for (var prop in object) {
                if (hasOwn.call(object, prop)) {
                    k.push(prop);
                }
            }
        }

        return k.sort();
    }

    function isCircular(object, objects) {
        if (typeof object != "object") {
            return false;
        }

        for (var i = 0, l = objects.length; i < l; ++i) {
            if (objects[i] === object) {
                return true;
            }
        }

        return false;
    }

    function ascii(object, processed, indent) {
        if (typeof object == "string") {
            var quote = typeof this.quoteStrings != "boolean" || this.quoteStrings;
            return processed || quote ? '"' + object + '"' : object;
        }

        if (typeof object == "function" && !(object instanceof RegExp)) {
            return ascii.func(object);
        }

        processed = processed || [];

        if (isCircular(object, processed)) {
            return "[Circular]";
        }

        if (Object.prototype.toString.call(object) == "[object Array]") {
            return ascii.array.call(this, object);
        }

        if (!object) {
            return "" + object;
        }

        if (buster.isElement(object)) {
            return ascii.element(object);
        }

        if (typeof object.toString == "function" &&
            object.toString !== Object.prototype.toString) {
            return object.toString();
        }

        for (var i = 0, l = specialObjects.length; i < l; i++) {
            if (object === specialObjects[i].obj) {
                return specialObjects[i].value;
            }
        }

        return ascii.object.call(this, object, processed, indent);
    }

    ascii.func = function (func) {
        return "function " + buster.functionName(func) + "() {}";
    };

    ascii.array = function (array, processed) {
        processed = processed || [];
        processed.push(array);
        var pieces = [];

        for (var i = 0, l = array.length; i < l; ++i) {
            pieces.push(ascii.call(this, array[i], processed));
        }

        return "[" + pieces.join(", ") + "]";
    };

    ascii.object = function (object, processed, indent) {
        processed = processed || [];
        processed.push(object);
        indent = indent || 0;
        var pieces = [], properties = keys(object), prop, str, obj;
        var is = "";
        var length = 3;

        for (var i = 0, l = indent; i < l; ++i) {
            is += " ";
        }

        for (i = 0, l = properties.length; i < l; ++i) {
            prop = properties[i];
            obj = object[prop];

            if (isCircular(obj, processed)) {
                str = "[Circular]";
            } else {
                str = ascii.call(this, obj, processed, indent + 2);
            }

            str = (/\s/.test(prop) ? '"' + prop + '"' : prop) + ": " + str;
            length += str.length;
            pieces.push(str);
        }

        var cons = ascii.constructorName.call(this, object);
        var prefix = cons ? "[" + cons + "] " : ""

        return (length + indent) > 80 ?
            prefix + "{\n  " + is + pieces.join(",\n  " + is) + "\n" + is + "}" :
            prefix + "{ " + pieces.join(", ") + " }";
    };

    ascii.element = function (element) {
        var tagName = element.tagName.toLowerCase();
        var attrs = element.attributes, attribute, pairs = [], attrName;

        for (var i = 0, l = attrs.length; i < l; ++i) {
            attribute = attrs.item(i);
            attrName = attribute.nodeName.toLowerCase().replace("html:", "");

            if (attrName == "contenteditable" && attribute.nodeValue == "inherit") {
                continue;
            }

            if (!!attribute.nodeValue) {
                pairs.push(attrName + "=\"" + attribute.nodeValue + "\"");
            }
        }

        var formatted = "<" + tagName + (pairs.length > 0 ? " " : "");
        var content = element.innerHTML;

        if (content.length > 20) {
            content = content.substr(0, 20) + "[...]";
        }

        var res = formatted + pairs.join(" ") + ">" + content + "</" + tagName + ">";

        return res.replace(/ contentEditable="inherit"/, "");
    };

    ascii.constructorName = function (object) {
        var name = buster.functionName(object && object.constructor);
        var excludes = this.excludeConstructors || buster.format.excludeConstructors || [];

        for (var i = 0, l = excludes.length; i < l; ++i) {
            if (typeof excludes[i] == "string" && excludes[i] == name) {
                return "";
            } else if (excludes[i].test && excludes[i].test(name)) {
                return "";
            }
        }

        return name;
    };

    return ascii;
}());

if (typeof module != "undefined") {
    module.exports = buster.format;
}
});

require.define("/node_modules/sinon/node_modules/buster-format/node_modules/buster-core/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"./lib/buster-core"}});

require.define("/node_modules/sinon/node_modules/buster-format/node_modules/buster-core/lib/buster-core.js",function(require,module,exports,__dirname,__filename,process){var buster = (function (setTimeout, B) {
    var isNode = typeof require == "function" && typeof module == "object";
    var div = typeof document != "undefined" && document.createElement("div");
    var F = function () {};

    var buster = {
        bind: function bind(obj, methOrProp) {
            var method = typeof methOrProp == "string" ? obj[methOrProp] : methOrProp;
            var args = Array.prototype.slice.call(arguments, 2);
            return function () {
                var allArgs = args.concat(Array.prototype.slice.call(arguments));
                return method.apply(obj, allArgs);
            };
        },

        partial: function partial(fn) {
            var args = [].slice.call(arguments, 1);
            return function () {
                return fn.apply(this, args.concat([].slice.call(arguments)));
            };
        },

        create: function create(object) {
            F.prototype = object;
            return new F();
        },

        extend: function extend(target) {
            if (!target) { return; }
            for (var i = 1, l = arguments.length, prop; i < l; ++i) {
                for (prop in arguments[i]) {
                    target[prop] = arguments[i][prop];
                }
            }
            return target;
        },

        nextTick: function nextTick(callback) {
            if (typeof process != "undefined" && process.nextTick) {
                return process.nextTick(callback);
            }
            setTimeout(callback, 0);
        },

        functionName: function functionName(func) {
            if (!func) return "";
            if (func.displayName) return func.displayName;
            if (func.name) return func.name;
            var matches = func.toString().match(/function\s+([^\(]+)/m);
            return matches && matches[1] || "";
        },

        isNode: function isNode(obj) {
            if (!div) return false;
            try {
                obj.appendChild(div);
                obj.removeChild(div);
            } catch (e) {
                return false;
            }
            return true;
        },

        isElement: function isElement(obj) {
            return obj && obj.nodeType === 1 && buster.isNode(obj);
        },

        isArray: function isArray(arr) {
            return Object.prototype.toString.call(arr) == "[object Array]";
        },

        flatten: function flatten(arr) {
            var result = [], arr = arr || [];
            for (var i = 0, l = arr.length; i < l; ++i) {
                result = result.concat(buster.isArray(arr[i]) ? flatten(arr[i]) : arr[i]);
            }
            return result;
        },

        each: function each(arr, callback) {
            for (var i = 0, l = arr.length; i < l; ++i) {
                callback(arr[i]);
            }
        },

        map: function map(arr, callback) {
            var results = [];
            for (var i = 0, l = arr.length; i < l; ++i) {
                results.push(callback(arr[i]));
            }
            return results;
        },

        parallel: function parallel(fns, callback) {
            function cb(err, res) {
                if (typeof callback == "function") {
                    callback(err, res);
                    callback = null;
                }
            }
            if (fns.length == 0) { return cb(null, []); }
            var remaining = fns.length, results = [];
            function makeDone(num) {
                return function done(err, result) {
                    if (err) { return cb(err); }
                    results[num] = result;
                    if (--remaining == 0) { cb(null, results); }
                };
            }
            for (var i = 0, l = fns.length; i < l; ++i) {
                fns[i](makeDone(i));
            }
        },

        series: function series(fns, callback) {
            function cb(err, res) {
                if (typeof callback == "function") {
                    callback(err, res);
                }
            }
            var remaining = fns.slice();
            var results = [];
            function callNext() {
                if (remaining.length == 0) return cb(null, results);
                var promise = remaining.shift()(next);
                if (promise && typeof promise.then == "function") {
                    promise.then(buster.partial(next, null), next);
                }
            }
            function next(err, result) {
                if (err) return cb(err);
                results.push(result);
                callNext();
            }
            callNext();
        },

        countdown: function countdown(num, done) {
            return function () {
                if (--num == 0) done();
            };
        }
    };

    if (typeof process === "object") {
        var crypto = require("crypto");
        var path = require("path");

        buster.tmpFile = function (fileName) {
            var hashed = crypto.createHash("sha1");
            hashed.update(fileName);
            var tmpfileName = hashed.digest("hex");

            if (process.platform == "win32") {
                return path.join(process.env["TEMP"], tmpfileName);
            } else {
                return path.join("/tmp", tmpfileName);
            }
        };
    }

    if (Array.prototype.some) {
        buster.some = function (arr, fn, thisp) {
            return arr.some(fn, thisp);
        };
    } else {
        // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/some
        buster.some = function (arr, fun, thisp) {
            "use strict";
            if (arr == null) { throw new TypeError(); }
            arr = Object(arr);
            var len = arr.length >>> 0;
            if (typeof fun !== "function") { throw new TypeError(); }

            for (var i = 0; i < len; i++) {
                if (arr.hasOwnProperty(i) && fun.call(thisp, arr[i], i, arr)) {
                    return true;
                }
            }

            return false;
        };
    }

    if (Array.prototype.filter) {
        buster.filter = function (arr, fn, thisp) {
            return arr.filter(fn, thisp);
        };
    } else {
        // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/filter
        buster.filter = function (fn, thisp) {
            "use strict";
            if (this == null) { throw new TypeError(); }

            var t = Object(this);
            var len = t.length >>> 0;
            if (typeof fn != "function") { throw new TypeError(); }

            var res = [];
            for (var i = 0; i < len; i++) {
                if (i in t) {
                    var val = t[i]; // in case fun mutates this
                    if (fn.call(thisp, val, i, t)) { res.push(val); }
                }
            }

            return res;
        };
    }

    if (isNode) {
        module.exports = buster;
        buster.eventEmitter = require("./buster-event-emitter");
        Object.defineProperty(buster, "defineVersionGetter", {
            get: function () {
                return require("./define-version-getter");
            }
        });
    }

    return buster.extend(B || {}, buster);
}(setTimeout, buster));
});

require.define("crypto",function(require,module,exports,__dirname,__filename,process){module.exports = require("crypto-browserify")});

require.define("/node_modules/crypto-browserify/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {}});

require.define("/node_modules/crypto-browserify/index.js",function(require,module,exports,__dirname,__filename,process){var sha = require('./sha')
var rng = require('./rng')

var algorithms = {
  sha1: {
    hex: sha.hex_sha1,
    binary: sha.b64_sha1,
    ascii: sha.str_sha1
  }
}

function error () {
  var m = [].slice.call(arguments).join(' ')
  throw new Error([
    m,
    'we accept pull requests',
    'http://github.com/dominictarr/crypto-browserify'
    ].join('\n'))
}

exports.createHash = function (alg) {
  alg = alg || 'sha1'
  if(!algorithms[alg])
    error('algorithm:', alg, 'is not yet supported')
  var s = ''
  _alg = algorithms[alg]
  return {
    update: function (data) {
      s += data
      return this
    },
    digest: function (enc) {
      enc = enc || 'binary'
      var fn
      if(!(fn = _alg[enc]))
        error('encoding:', enc , 'is not yet supported for algorithm', alg)
      var r = fn(s)
      s = null //not meant to use the hash after you've called digest.
      return r
    }
  }
}

exports.randomBytes = function(size, callback) {
  if (callback && callback.call) {
    try {
      callback.call(this, undefined, rng(size));
    } catch (err) { callback(err); }
  } else {
    return rng(size);
  }
}

// the least I can do is make error messages for the rest of the node.js/crypto api.
;['createCredentials'
, 'createHmac'
, 'createCypher'
, 'createCypheriv'
, 'createDecipher'
, 'createDecipheriv'
, 'createSign'
, 'createVerify'
, 'createDeffieHellman'
, 'pbkdf2'].forEach(function (name) {
  exports[name] = function () {
    error('sorry,', name, 'is not implemented yet')
  }
})
});

require.define("/node_modules/crypto-browserify/sha.js",function(require,module,exports,__dirname,__filename,process){/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

exports.hex_sha1 = hex_sha1;
exports.b64_sha1 = b64_sha1;
exports.str_sha1 = str_sha1;
exports.hex_hmac_sha1 = hex_hmac_sha1;
exports.b64_hmac_sha1 = b64_hmac_sha1;
exports.str_hmac_sha1 = str_hmac_sha1;

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */
var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_sha1(s){return binb2hex(core_sha1(str2binb(s),s.length * chrsz));}
function b64_sha1(s){return binb2b64(core_sha1(str2binb(s),s.length * chrsz));}
function str_sha1(s){return binb2str(core_sha1(str2binb(s),s.length * chrsz));}
function hex_hmac_sha1(key, data){ return binb2hex(core_hmac_sha1(key, data));}
function b64_hmac_sha1(key, data){ return binb2b64(core_hmac_sha1(key, data));}
function str_hmac_sha1(key, data){ return binb2str(core_hmac_sha1(key, data));}

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test()
{
  return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}

/*
 * Calculate the HMAC-SHA1 of a key and some data
 */
function core_hmac_sha1(key, data)
{
  var bkey = str2binb(key);
  if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
  return core_sha1(opad.concat(hash), 512 + 160);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

/*
 * Convert an 8-bit or 16-bit string to an array of big-endian words
 * In 8-bit function, characters >255 have their hi-byte silently ignored.
 */
function str2binb(str)
{
  var bin = Array();
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < str.length * chrsz; i += chrsz)
    bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
  return bin;
}

/*
 * Convert an array of big-endian words to a string
 */
function binb2str(bin)
{
  var str = "";
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < bin.length * 32; i += chrsz)
    str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
  return str;
}

/*
 * Convert an array of big-endian words to a hex string.
 */
function binb2hex(binarray)
{
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i++)
  {
    str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
           hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
  }
  return str;
}

/*
 * Convert an array of big-endian words to a base-64 string
 */
function binb2b64(binarray)
{
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i += 3)
  {
    var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                | (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                |  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
      else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
    }
  }
  return str;
}

});

require.define("/node_modules/crypto-browserify/rng.js",function(require,module,exports,__dirname,__filename,process){// Original code adapted from Robert Kieffer.
// details at https://github.com/broofa/node-uuid
(function() {
  var _global = this;

  var mathRNG, whatwgRNG;

  // NOTE: Math.random() does not guarantee "cryptographic quality"
  mathRNG = function(size) {
    var bytes = new Array(size);
    var r;

    for (var i = 0, r; i < size; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      bytes[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return bytes;
  }

  // currently only available in webkit-based browsers.
  if (_global.crypto && crypto.getRandomValues) {
    var _rnds = new Uint32Array(4);
    whatwgRNG = function(size) {
      var bytes = new Array(size);
      crypto.getRandomValues(_rnds);

      for (var c = 0 ; c < size; c++) {
        bytes[c] = _rnds[c >> 2] >>> ((c & 0x03) * 8) & 0xff;
      }
      return bytes;
    }
  }

  module.exports = whatwgRNG || mathRNG;

}())});

require.define("/node_modules/sinon/node_modules/buster-format/node_modules/buster-core/lib/buster-event-emitter.js",function(require,module,exports,__dirname,__filename,process){/*jslint eqeqeq: false, onevar: false, plusplus: false*/
/*global buster, require, module*/
if (typeof require == "function" && typeof module == "object") {
    var buster = require("./buster-core");
}

(function () {
    function eventListeners(eventEmitter, event) {
        if (!eventEmitter.listeners) {
            eventEmitter.listeners = {};
        }

        if (!eventEmitter.listeners[event]) {
            eventEmitter.listeners[event] = [];
        }

        return eventEmitter.listeners[event];
    }

    function throwLater(event, error) {
        buster.nextTick(function () {
            error.message = event + " listener threw error: " + error.message;
            throw error;
        });
    }

    function addSupervisor(emitter, listener, thisObject) {
        if (!emitter.supervisors) { emitter.supervisors = []; }
        emitter.supervisors.push({
            listener: listener,
            thisObject: thisObject
        });
    }

    function notifyListener(emitter, event, listener, args) {
        try {
            listener.listener.apply(listener.thisObject || emitter, args);
        } catch (e) {
            throwLater(event, e);
        }
    }

    buster.eventEmitter = {
        create: function () {
            return buster.create(this);
        },

        addListener: function addListener(event, listener, thisObject) {
            if (typeof event === "function") {
                return addSupervisor(this, event, listener);
            }
            if (typeof listener != "function") {
                throw new TypeError("Listener is not function");
            }
            eventListeners(this, event).push({
                listener: listener,
                thisObject: thisObject
            });
        },

        once: function once(event, listener, thisObject) {
            var self = this;
            this.addListener(event, listener);

            var wrapped = function () {
                self.removeListener(event, listener);
                self.removeListener(event, wrapped);
            };
            this.addListener(event, wrapped);
        },

        hasListener: function hasListener(event, listener, thisObject) {
            var listeners = eventListeners(this, event);

            for (var i = 0, l = listeners.length; i < l; i++) {
                if (listeners[i].listener === listener &&
                    listeners[i].thisObject === thisObject) {
                    return true;
                }
            }

            return false;
        },

        removeListener: function (event, listener) {
            var listeners = eventListeners(this, event);

            for (var i = 0, l = listeners.length; i < l; ++i) {
                if (listeners[i].listener == listener) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        },

        emit: function emit(event) {
            var listeners = eventListeners(this, event).slice();
            var args = Array.prototype.slice.call(arguments, 1);

            for (var i = 0, l = listeners.length; i < l; i++) {
                notifyListener(this, event, listeners[i], args);
            }

            listeners = this.supervisors || [];
            args = Array.prototype.slice.call(arguments);
            for (i = 0, l = listeners.length; i < l; ++i) {
                notifyListener(this, event, listeners[i], args);
            }
        },

        bind: function (object, events) {
            var method;

            if (!events) {
                for (method in object) {
                    if (object.hasOwnProperty(method) && typeof object[method] == "function") {
                        this.addListener(method, object[method], object);
                    }
                }
            } else if (typeof events == "string" ||
                       Object.prototype.toString.call(events) == "[object Array]") {
                events = typeof events == "string" ? [events] : events;

                for (var i = 0, l = events.length; i < l; ++i) {
                    this.addListener(events[i], object[events[i]], object);
                }
            } else {
                for (var prop in events) {
                    if (events.hasOwnProperty(prop)) {
                        method = events[prop];

                        if (typeof method == "function") {
                            object[buster.functionName(method) || prop] = method;
                        } else {
                            method = object[events[prop]];
                        }

                        this.addListener(prop, method, object);
                    }
                }
            }

            return object;
        }
    };

    buster.eventEmitter.on = buster.eventEmitter.addListener;
}());

if (typeof module != "undefined") {
    module.exports = buster.eventEmitter;
}
});

require.define("/node_modules/sinon/node_modules/buster-format/node_modules/buster-core/lib/define-version-getter.js",function(require,module,exports,__dirname,__filename,process){var path = require("path");
var fs = require("fs");

module.exports = function defineVersionGetter(mod, dirname) {
    Object.defineProperty(mod, "VERSION", {
        get: function () {
            if (!this.version) {
                var pkgJSON = path.resolve(dirname, "..", "package.json");
                var pkg = JSON.parse(fs.readFileSync(pkgJSON, "utf8"));
                this.version = pkg.version;
            }

            return this.version;
        }
    });
};
});

require.define("fs",function(require,module,exports,__dirname,__filename,process){// nothing to see here... no file methods for the browser
});

require.define("/node_modules/sinon/lib/sinon/spy.js",function(require,module,exports,__dirname,__filename,process){/**
 * @depend ../sinon.js
 * @depend match.js
 */
/*jslint eqeqeq: false, onevar: false, plusplus: false*/
/*global module, require, sinon*/
/**
 * Spy functions
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2011 Christian Johansen
 */
"use strict";

(function (sinon) {
    var commonJSModule = typeof module == "object" && typeof require == "function";
    var spyCall;
    var callId = 0;
    var push = [].push;
    var slice = Array.prototype.slice;

    if (!sinon && commonJSModule) {
        sinon = require("../sinon");
    }

    if (!sinon) {
        return;
    }

    function spy(object, property) {
        if (!property && typeof object == "function") {
            return spy.create(object);
        }

        if (!object && !property) {
            return spy.create(function () {});
        }

        var method = object[property];
        return sinon.wrapMethod(object, property, spy.create(method));
    }

    sinon.extend(spy, (function () {

        function delegateToCalls(api, method, matchAny, actual, notCalled) {
            api[method] = function () {
                if (!this.called) {
                    if (notCalled) {
                        return notCalled.apply(this, arguments);
                    }
                    return false;
                }

                var currentCall;
                var matches = 0;

                for (var i = 0, l = this.callCount; i < l; i += 1) {
                    currentCall = this.getCall(i);

                    if (currentCall[actual || method].apply(currentCall, arguments)) {
                        matches += 1;

                        if (matchAny) {
                            return true;
                        }
                    }
                }

                return matches === this.callCount;
            };
        }

        function matchingFake(fakes, args, strict) {
            if (!fakes) {
                return;
            }

            var alen = args.length;

            for (var i = 0, l = fakes.length; i < l; i++) {
                if (fakes[i].matches(args, strict)) {
                    return fakes[i];
                }
            }
        }

        function incrementCallCount() {
            this.called = true;
            this.callCount += 1;
            this.calledOnce = this.callCount == 1;
            this.calledTwice = this.callCount == 2;
            this.calledThrice = this.callCount == 3;
        }

        function createCallProperties() {
            this.firstCall = this.getCall(0);
            this.secondCall = this.getCall(1);
            this.thirdCall = this.getCall(2);
            this.lastCall = this.getCall(this.callCount - 1);
        }

        var uuid = 0;

        // Public API
        var spyApi = {
            reset: function () {
                this.called = false;
                this.calledOnce = false;
                this.calledTwice = false;
                this.calledThrice = false;
                this.callCount = 0;
                this.firstCall = null;
                this.secondCall = null;
                this.thirdCall = null;
                this.lastCall = null;
                this.args = [];
                this.returnValues = [];
                this.thisValues = [];
                this.exceptions = [];
                this.callIds = [];
            },

            create: function create(func) {
                var name;

                if (typeof func != "function") {
                    func = function () {};
                } else {
                    name = sinon.functionName(func);
                }

                function proxy() {
                    return proxy.invoke(func, this, slice.call(arguments));
                }

                sinon.extend(proxy, spy);
                delete proxy.create;
                sinon.extend(proxy, func);

                proxy.reset();
                proxy.prototype = func.prototype;
                proxy.displayName = name || "spy";
                proxy.toString = sinon.functionToString;
                proxy._create = sinon.spy.create;
                proxy.id = "spy#" + uuid++;

                return proxy;
            },

            invoke: function invoke(func, thisValue, args) {
                var matching = matchingFake(this.fakes, args);
                var exception, returnValue;

                incrementCallCount.call(this);
                push.call(this.thisValues, thisValue);
                push.call(this.args, args);
                push.call(this.callIds, callId++);

                try {
                    if (matching) {
                        returnValue = matching.invoke(func, thisValue, args);
                    } else {
                        returnValue = (this.func || func).apply(thisValue, args);
                    }
                } catch (e) {
                    push.call(this.returnValues, undefined);
                    exception = e;
                    throw e;
                } finally {
                    push.call(this.exceptions, exception);
                }

                push.call(this.returnValues, returnValue);

                createCallProperties.call(this);

                return returnValue;
            },

            getCall: function getCall(i) {
                if (i < 0 || i >= this.callCount) {
                    return null;
                }

                return spyCall.create(this, this.thisValues[i], this.args[i],
                                      this.returnValues[i], this.exceptions[i],
                                      this.callIds[i]);
            },

            calledBefore: function calledBefore(spyFn) {
                if (!this.called) {
                    return false;
                }

                if (!spyFn.called) {
                    return true;
                }

                return this.callIds[0] < spyFn.callIds[spyFn.callIds.length - 1];
            },

            calledAfter: function calledAfter(spyFn) {
                if (!this.called || !spyFn.called) {
                    return false;
                }

                return this.callIds[this.callCount - 1] > spyFn.callIds[spyFn.callCount - 1];
            },

            withArgs: function () {
                var args = slice.call(arguments);

                if (this.fakes) {
                    var match = matchingFake(this.fakes, args, true);

                    if (match) {
                        return match;
                    }
                } else {
                    this.fakes = [];
                }

                var original = this;
                var fake = this._create();
                fake.matchingAguments = args;
                push.call(this.fakes, fake);

                fake.withArgs = function () {
                    return original.withArgs.apply(original, arguments);
                };

                for (var i = 0; i < this.args.length; i++) {
                    if (fake.matches(this.args[i])) {
                        incrementCallCount.call(fake);
                        push.call(fake.thisValues, this.thisValues[i]);
                        push.call(fake.args, this.args[i]);
                        push.call(fake.returnValues, this.returnValues[i]);
                        push.call(fake.exceptions, this.exceptions[i]);
                        push.call(fake.callIds, this.callIds[i]);
                    }
                }
                createCallProperties.call(fake);

                return fake;
            },

            matches: function (args, strict) {
                var margs = this.matchingAguments;

                if (margs.length <= args.length &&
                    sinon.deepEqual(margs, args.slice(0, margs.length))) {
                    return !strict || margs.length == args.length;
                }
            },

            printf: function (format) {
                var spy = this;
                var args = slice.call(arguments, 1);
                var formatter;

                return (format || "").replace(/%(.)/g, function (match, specifyer) {
                    formatter = spyApi.formatters[specifyer];

                    if (typeof formatter == "function") {
                        return formatter.call(null, spy, args);
                    } else if (!isNaN(parseInt(specifyer), 10)) {
                        return sinon.format(args[specifyer - 1]);
                    }

                    return "%" + specifyer;
                });
            }
        };

        delegateToCalls(spyApi, "calledOn", true);
        delegateToCalls(spyApi, "alwaysCalledOn", false, "calledOn");
        delegateToCalls(spyApi, "calledWith", true);
        delegateToCalls(spyApi, "calledWithMatch", true);
        delegateToCalls(spyApi, "alwaysCalledWith", false, "calledWith");
        delegateToCalls(spyApi, "alwaysCalledWithMatch", false, "calledWithMatch");
        delegateToCalls(spyApi, "calledWithExactly", true);
        delegateToCalls(spyApi, "alwaysCalledWithExactly", false, "calledWithExactly");
        delegateToCalls(spyApi, "neverCalledWith", false, "notCalledWith",
            function () { return true; });
        delegateToCalls(spyApi, "neverCalledWithMatch", false, "notCalledWithMatch",
            function () { return true; });
        delegateToCalls(spyApi, "threw", true);
        delegateToCalls(spyApi, "alwaysThrew", false, "threw");
        delegateToCalls(spyApi, "returned", true);
        delegateToCalls(spyApi, "alwaysReturned", false, "returned");
        delegateToCalls(spyApi, "calledWithNew", true);
        delegateToCalls(spyApi, "alwaysCalledWithNew", false, "calledWithNew");
        delegateToCalls(spyApi, "callArg", false, "callArgWith", function () {
            throw new Error(this.toString() + " cannot call arg since it was not yet invoked.");
        });
        spyApi.callArgWith = spyApi.callArg;
        delegateToCalls(spyApi, "yield", false, "yield", function () {
            throw new Error(this.toString() + " cannot yield since it was not yet invoked.");
        });
        // "invokeCallback" is an alias for "yield" since "yield" is invalid in strict mode.
        spyApi.invokeCallback = spyApi.yield;
        delegateToCalls(spyApi, "yieldTo", false, "yieldTo", function (property) {
            throw new Error(this.toString() + " cannot yield to '" + property +
                "' since it was not yet invoked.");
        });

        spyApi.formatters = {
            "c": function (spy) {
                return sinon.timesInWords(spy.callCount);
            },

            "n": function (spy) {
                return spy.toString();
            },

            "C": function (spy) {
                var calls = [];

                for (var i = 0, l = spy.callCount; i < l; ++i) {
                    push.call(calls, "    " + spy.getCall(i).toString());
                }

                return calls.length > 0 ? "\n" + calls.join("\n") : "";
            },

            "t": function (spy) {
                var objects = [];

                for (var i = 0, l = spy.callCount; i < l; ++i) {
                    push.call(objects, sinon.format(spy.thisValues[i]));
                }

                return objects.join(", ");
            },

            "*": function (spy, args) {
                return args.join(", ");
            }
        };

        return spyApi;
    }()));

    spyCall = (function () {

        function throwYieldError(proxy, text, args) {
            var msg = sinon.functionName(proxy) + text;
            if (args.length) {
                msg += " Received [" + slice.call(args).join(", ") + "]";
            }
            throw new Error(msg);
        }

        return {
            create: function create(spy, thisValue, args, returnValue, exception, id) {
                var proxyCall = sinon.create(spyCall);
                delete proxyCall.create;
                proxyCall.proxy = spy;
                proxyCall.thisValue = thisValue;
                proxyCall.args = args;
                proxyCall.returnValue = returnValue;
                proxyCall.exception = exception;
                proxyCall.callId = typeof id == "number" && id || callId++;

                return proxyCall;
            },

            calledOn: function calledOn(thisValue) {
                return this.thisValue === thisValue;
            },

            calledWith: function calledWith() {
                for (var i = 0, l = arguments.length; i < l; i += 1) {
                    if (!sinon.deepEqual(arguments[i], this.args[i])) {
                        return false;
                    }
                }

                return true;
            },

            calledWithMatch: function calledWithMatch() {
              for (var i = 0, l = arguments.length; i < l; i += 1) {
                  var actual = this.args[i];
                  var expectation = arguments[i];
                  if (!sinon.match || !sinon.match(expectation).test(actual)) {
                      return false;
                  }
              }
              return true;
            },

            calledWithExactly: function calledWithExactly() {
                return arguments.length == this.args.length &&
                    this.calledWith.apply(this, arguments);
            },

            notCalledWith: function notCalledWith() {
                return !this.calledWith.apply(this, arguments);
            },

            notCalledWithMatch: function notCalledWithMatch() {
              return !this.calledWithMatch.apply(this, arguments);
            },

            returned: function returned(value) {
                return sinon.deepEqual(value, this.returnValue);
            },

            threw: function threw(error) {
                if (typeof error == "undefined" || !this.exception) {
                    return !!this.exception;
                }

                if (typeof error == "string") {
                    return this.exception.name == error;
                }

                return this.exception === error;
            },

            calledWithNew: function calledWithNew(thisValue) {
                return this.thisValue instanceof this.proxy;
            },

            calledBefore: function (other) {
                return this.callId < other.callId;
            },

            calledAfter: function (other) {
                return this.callId > other.callId;
            },

            callArg: function (pos) {
                this.args[pos]();
            },

            callArgWith: function (pos) {
                var args = slice.call(arguments, 1);
                this.args[pos].apply(null, args);
            },

            "yield": function () {
                var args = this.args;
                for (var i = 0, l = args.length; i < l; ++i) {
                    if (typeof args[i] === "function") {
                        args[i].apply(null, slice.call(arguments));
                        return;
                    }
                }
                throwYieldError(this.proxy, " cannot yield since no callback was passed.", args);
            },

            yieldTo: function (prop) {
                var args = this.args;
                for (var i = 0, l = args.length; i < l; ++i) {
                    if (args[i] && typeof args[i][prop] === "function") {
                        args[i][prop].apply(null, slice.call(arguments, 1));
                        return;
                    }
                }
                throwYieldError(this.proxy, " cannot yield to '" + prop +
                    "' since no callback was passed.", args);
            },

            toString: function () {
                var callStr = this.proxy.toString() + "(";
                var args = [];

                for (var i = 0, l = this.args.length; i < l; ++i) {
                    push.call(args, sinon.format(this.args[i]));
                }

                callStr = callStr + args.join(", ") + ")";

                if (typeof this.returnValue != "undefined") {
                    callStr += " => " + sinon.format(this.returnValue);
                }

                if (this.exception) {
                    callStr += " !" + this.exception.name;

                    if (this.exception.message) {
                        callStr += "(" + this.exception.message + ")";
                    }
                }

                return callStr;
            }
        };
    }());

    spy.spyCall = spyCall;

    // This steps outside the module sandbox and will be removed
    sinon.spyCall = spyCall;

    if (commonJSModule) {
        module.exports = spy;
    } else {
        sinon.spy = spy;
    }
}(typeof sinon == "object" && sinon || null));
});

require.define("/node_modules/sinon/lib/sinon/stub.js",function(require,module,exports,__dirname,__filename,process){/**
 * @depend ../sinon.js
 * @depend spy.js
 */
/*jslint eqeqeq: false, onevar: false*/
/*global module, require, sinon*/
/**
 * Stub functions
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2011 Christian Johansen
 */
"use strict";

(function (sinon) {
    var commonJSModule = typeof module == "object" && typeof require == "function";

    if (!sinon && commonJSModule) {
        sinon = require("../sinon");
    }

    if (!sinon) {
        return;
    }

    function stub(object, property, func) {
        if (!!func && typeof func != "function") {
            throw new TypeError("Custom stub should be function");
        }

        var wrapper;

        if (func) {
            wrapper = sinon.spy && sinon.spy.create ? sinon.spy.create(func) : func;
        } else {
            wrapper = stub.create();
        }

        if (!object && !property) {
            return sinon.stub.create();
        }

        if (!property && !!object && typeof object == "object") {
            for (var prop in object) {
                if (typeof object[prop] === "function") {
                    stub(object, prop);
                }
            }

            return object;
        }

        return sinon.wrapMethod(object, property, wrapper);
    }

    function getCallback(stub, args) {
        if (stub.callArgAt < 0) {
            for (var i = 0, l = args.length; i < l; ++i) {
                if (!stub.callArgProp && typeof args[i] == "function") {
                    return args[i];
                }

                if (stub.callArgProp && args[i] &&
                    typeof args[i][stub.callArgProp] == "function") {
                    return args[i][stub.callArgProp];
                }
            }

            return null;
        }

        return args[stub.callArgAt];
    }

    var join = Array.prototype.join;

    function getCallbackError(stub, func, args) {
        if (stub.callArgAt < 0) {
            var msg;

            if (stub.callArgProp) {
                msg = sinon.functionName(stub) +
                    " expected to yield to '" + stub.callArgProp +
                    "', but no object with such a property was passed."
            } else {
                msg = sinon.functionName(stub) +
                            " expected to yield, but no callback was passed."
            }

            if (args.length > 0) {
                msg += " Received [" + join.call(args, ", ") + "]";
            }

            return msg;
        }

        return "argument at index " + stub.callArgAt + " is not a function: " + func;
    }

    function callCallback(stub, args) {
        if (typeof stub.callArgAt == "number") {
            var func = getCallback(stub, args);

            if (typeof func != "function") {
                throw new TypeError(getCallbackError(stub, func, args));
            }

            func.apply(stub.callbackContext, stub.callbackArguments);
        }
    }

    var uuid = 0;

    sinon.extend(stub, (function () {
        var slice = Array.prototype.slice;

        function throwsException(error, message) {
            if (typeof error == "string") {
                this.exception = new Error(message || "");
                this.exception.name = error;
            } else if (!error) {
                this.exception = new Error("Error");
            } else {
                this.exception = error;
            }
            
            return this;
        }

        return {
            create: function create() {
                var functionStub = function () {
                    if (functionStub.exception) {
                        throw functionStub.exception;
                    } else if (typeof functionStub.returnArgAt == 'number') {
                        return arguments[functionStub.returnArgAt];
                    }

                    callCallback(functionStub, arguments);

                    return functionStub.returnValue;
                };

                functionStub.id = "stub#" + uuid++;
                var orig = functionStub;
                functionStub = sinon.spy.create(functionStub);
                functionStub.func = orig;

                sinon.extend(functionStub, stub);
                functionStub._create = sinon.stub.create;
                functionStub.displayName = "stub";
                functionStub.toString = sinon.functionToString;

                return functionStub;
            },

            returns: function returns(value) {
                this.returnValue = value;

                return this;
            },

            returnsArg: function returnsArg(pos) {
                if (typeof pos != "number") {
                    throw new TypeError("argument index is not number");
                }
                
                this.returnArgAt = pos;

                return this;
            },

            "throws": throwsException,
            throwsException: throwsException,

            callsArg: function callsArg(pos) {
                if (typeof pos != "number") {
                    throw new TypeError("argument index is not number");
                }

                this.callArgAt = pos;
                this.callbackArguments = [];

                return this;
            },

            callsArgOn: function callsArgOn(pos, context) {
                if (typeof pos != "number") {
                    throw new TypeError("argument index is not number");
                }
                if (typeof context != "object") {
                    throw new TypeError("argument context is not an object");
                }

                this.callArgAt = pos;
                this.callbackArguments = [];
                this.callbackContext = context;

                return this;
            },

            callsArgWith: function callsArgWith(pos) {
                if (typeof pos != "number") {
                    throw new TypeError("argument index is not number");
                }

                this.callArgAt = pos;
                this.callbackArguments = slice.call(arguments, 1);

                return this;
            },

            callsArgOnWith: function callsArgWith(pos, context) {
                if (typeof pos != "number") {
                    throw new TypeError("argument index is not number");
                }
                if (typeof context != "object") {
                    throw new TypeError("argument context is not an object");
                }

                this.callArgAt = pos;
                this.callbackArguments = slice.call(arguments, 2);
                this.callbackContext = context;

                return this;
            },

            yields: function () {
                this.callArgAt = -1;
                this.callbackArguments = slice.call(arguments, 0);

                return this;
            },

            yieldsOn: function (context) {
                if (typeof context != "object") {
                    throw new TypeError("argument context is not an object");
                }

                this.callArgAt = -1;
                this.callbackArguments = slice.call(arguments, 1);
                this.callbackContext = context;

                return this;
            },

            yieldsTo: function (prop) {
                this.callArgAt = -1;
                this.callArgProp = prop;
                this.callbackArguments = slice.call(arguments, 1);

                return this;
            },

            yieldsToOn: function (prop, context) {
                if (typeof context != "object") {
                    throw new TypeError("argument context is not an object");
                }

                this.callArgAt = -1;
                this.callArgProp = prop;
                this.callbackArguments = slice.call(arguments, 2);
                this.callbackContext = context;

                return this;
            }
        };
    }()));

    if (commonJSModule) {
        module.exports = stub;
    } else {
        sinon.stub = stub;
    }
}(typeof sinon == "object" && sinon || null));
});

require.define("/node_modules/sinon/lib/sinon/mock.js",function(require,module,exports,__dirname,__filename,process){/**
 * @depend ../sinon.js
 * @depend stub.js
 */
/*jslint eqeqeq: false, onevar: false, nomen: false*/
/*global module, require, sinon*/
/**
 * Mock functions.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2011 Christian Johansen
 */
"use strict";

(function (sinon) {
    var commonJSModule = typeof module == "object" && typeof require == "function";
    var push = [].push;

    if (!sinon && commonJSModule) {
        sinon = require("../sinon");
    }

    if (!sinon) {
        return;
    }

    function mock(object) {
        if (!object) {
            return sinon.expectation.create("Anonymous mock");
        }

        return mock.create(object);
    }

    sinon.mock = mock;

    sinon.extend(mock, (function () {
        function each(collection, callback) {
            if (!collection) {
                return;
            }

            for (var i = 0, l = collection.length; i < l; i += 1) {
                callback(collection[i]);
            }
        }

        return {
            create: function create(object) {
                if (!object) {
                    throw new TypeError("object is null");
                }

                var mockObject = sinon.extend({}, mock);
                mockObject.object = object;
                delete mockObject.create;

                return mockObject;
            },

            expects: function expects(method) {
                if (!method) {
                    throw new TypeError("method is falsy");
                }

                if (!this.expectations) {
                    this.expectations = {};
                    this.proxies = [];
                }

                if (!this.expectations[method]) {
                    this.expectations[method] = [];
                    var mockObject = this;

                    sinon.wrapMethod(this.object, method, function () {
                        return mockObject.invokeMethod(method, this, arguments);
                    });

                    push.call(this.proxies, method);
                }

                var expectation = sinon.expectation.create(method);
                push.call(this.expectations[method], expectation);

                return expectation;
            },

            restore: function restore() {
                var object = this.object;

                each(this.proxies, function (proxy) {
                    if (typeof object[proxy].restore == "function") {
                        object[proxy].restore();
                    }
                });
            },

            verify: function verify() {
                var expectations = this.expectations || {};
                var messages = [], met = [];

                each(this.proxies, function (proxy) {
                    each(expectations[proxy], function (expectation) {
                        if (!expectation.met()) {
                            push.call(messages, expectation.toString());
                        } else {
                            push.call(met, expectation.toString());
                        }
                    });
                });

                this.restore();

                if (messages.length > 0) {
                    sinon.expectation.fail(messages.concat(met).join("\n"));
                } else {
                    sinon.expectation.pass(messages.concat(met).join("\n"));
                }

                return true;
            },

            invokeMethod: function invokeMethod(method, thisValue, args) {
                var expectations = this.expectations && this.expectations[method];
                var length = expectations && expectations.length || 0, i;

                for (i = 0; i < length; i += 1) {
                    if (!expectations[i].met() &&
                        expectations[i].allowsCall(thisValue, args)) {
                        return expectations[i].apply(thisValue, args);
                    }
                }

                var messages = [], available, exhausted = 0;

                for (i = 0; i < length; i += 1) {
                    if (expectations[i].allowsCall(thisValue, args)) {
                        available = available || expectations[i];
                    } else {
                        exhausted += 1;
                    }
                    push.call(messages, "    " + expectations[i].toString());
                }

                if (exhausted === 0) {
                    return available.apply(thisValue, args);
                }

                messages.unshift("Unexpected call: " + sinon.spyCall.toString.call({
                    proxy: method,
                    args: args
                }));

                sinon.expectation.fail(messages.join("\n"));
            }
        };
    }()));

    var times = sinon.timesInWords;

    sinon.expectation = (function () {
        var slice = Array.prototype.slice;
        var _invoke = sinon.spy.invoke;

        function callCountInWords(callCount) {
            if (callCount == 0) {
                return "never called";
            } else {
                return "called " + times(callCount);
            }
        }

        function expectedCallCountInWords(expectation) {
            var min = expectation.minCalls;
            var max = expectation.maxCalls;

            if (typeof min == "number" && typeof max == "number") {
                var str = times(min);

                if (min != max) {
                    str = "at least " + str + " and at most " + times(max);
                }

                return str;
            }

            if (typeof min == "number") {
                return "at least " + times(min);
            }

            return "at most " + times(max);
        }

        function receivedMinCalls(expectation) {
            var hasMinLimit = typeof expectation.minCalls == "number";
            return !hasMinLimit || expectation.callCount >= expectation.minCalls;
        }

        function receivedMaxCalls(expectation) {
            if (typeof expectation.maxCalls != "number") {
                return false;
            }

            return expectation.callCount == expectation.maxCalls;
        }

        return {
            minCalls: 1,
            maxCalls: 1,

            create: function create(methodName) {
                var expectation = sinon.extend(sinon.stub.create(), sinon.expectation);
                delete expectation.create;
                expectation.method = methodName;

                return expectation;
            },

            invoke: function invoke(func, thisValue, args) {
                this.verifyCallAllowed(thisValue, args);

                return _invoke.apply(this, arguments);
            },

            atLeast: function atLeast(num) {
                if (typeof num != "number") {
                    throw new TypeError("'" + num + "' is not number");
                }

                if (!this.limitsSet) {
                    this.maxCalls = null;
                    this.limitsSet = true;
                }

                this.minCalls = num;

                return this;
            },

            atMost: function atMost(num) {
                if (typeof num != "number") {
                    throw new TypeError("'" + num + "' is not number");
                }

                if (!this.limitsSet) {
                    this.minCalls = null;
                    this.limitsSet = true;
                }

                this.maxCalls = num;

                return this;
            },

            never: function never() {
                return this.exactly(0);
            },

            once: function once() {
                return this.exactly(1);
            },

            twice: function twice() {
                return this.exactly(2);
            },

            thrice: function thrice() {
                return this.exactly(3);
            },

            exactly: function exactly(num) {
                if (typeof num != "number") {
                    throw new TypeError("'" + num + "' is not a number");
                }

                this.atLeast(num);
                return this.atMost(num);
            },

            met: function met() {
                return !this.failed && receivedMinCalls(this);
            },

            verifyCallAllowed: function verifyCallAllowed(thisValue, args) {
                if (receivedMaxCalls(this)) {
                    this.failed = true;
                    sinon.expectation.fail(this.method + " already called " + times(this.maxCalls));
                }

                if ("expectedThis" in this && this.expectedThis !== thisValue) {
                    sinon.expectation.fail(this.method + " called with " + thisValue + " as thisValue, expected " +
                        this.expectedThis);
                }

                if (!("expectedArguments" in this)) {
                    return;
                }

                if (!args) {
                    sinon.expectation.fail(this.method + " received no arguments, expected " +
                        this.expectedArguments.join());
                }

                if (args.length < this.expectedArguments.length) {
                    sinon.expectation.fail(this.method + " received too few arguments (" + args.join() +
                        "), expected " + this.expectedArguments.join());
                }

                if (this.expectsExactArgCount &&
                    args.length != this.expectedArguments.length) {
                    sinon.expectation.fail(this.method + " received too many arguments (" + args.join() +
                        "), expected " + this.expectedArguments.join());
                }

                for (var i = 0, l = this.expectedArguments.length; i < l; i += 1) {
                    if (!sinon.deepEqual(this.expectedArguments[i], args[i])) {
                        sinon.expectation.fail(this.method + " received wrong arguments (" + args.join() +
                            "), expected " + this.expectedArguments.join());
                    }
                }
            },

            allowsCall: function allowsCall(thisValue, args) {
                if (this.met() && receivedMaxCalls(this)) {
                    return false;
                }

                if ("expectedThis" in this && this.expectedThis !== thisValue) {
                    return false;
                }

                if (!("expectedArguments" in this)) {
                    return true;
                }

                args = args || [];

                if (args.length < this.expectedArguments.length) {
                    return false;
                }

                if (this.expectsExactArgCount &&
                    args.length != this.expectedArguments.length) {
                    return false;
                }

                for (var i = 0, l = this.expectedArguments.length; i < l; i += 1) {
                    if (!sinon.deepEqual(this.expectedArguments[i], args[i])) {
                        return false;
                    }
                }

                return true;
            },

            withArgs: function withArgs() {
                this.expectedArguments = slice.call(arguments);
                return this;
            },

            withExactArgs: function withExactArgs() {
                this.withArgs.apply(this, arguments);
                this.expectsExactArgCount = true;
                return this;
            },

            on: function on(thisValue) {
                this.expectedThis = thisValue;
                return this;
            },

            toString: function () {
                var args = (this.expectedArguments || []).slice();

                if (!this.expectsExactArgCount) {
                    push.call(args, "[...]");
                }

                var callStr = sinon.spyCall.toString.call({
                    proxy: this.method, args: args
                });

                var message = callStr.replace(", [...", "[, ...") + " " +
                    expectedCallCountInWords(this);

                if (this.met()) {
                    return "Expectation met: " + message;
                }

                return "Expected " + message + " (" +
                    callCountInWords(this.callCount) + ")";
            },

            verify: function verify() {
                if (!this.met()) {
                    sinon.expectation.fail(this.toString());
                } else {
                    sinon.expectation.pass(this.toString());
                }

                return true;
            },

            pass: function(message) {
              sinon.assert.pass(message);
            },
            fail: function (message) {
                var exception = new Error(message);
                exception.name = "ExpectationError";

                throw exception;
            }
        };
    }());

    if (commonJSModule) {
        module.exports = mock;
    } else {
        sinon.mock = mock;
    }
}(typeof sinon == "object" && sinon || null));
});

require.define("/node_modules/sinon/lib/sinon/collection.js",function(require,module,exports,__dirname,__filename,process){/**
 * @depend ../sinon.js
 * @depend stub.js
 * @depend mock.js
 */
/*jslint eqeqeq: false, onevar: false, forin: true*/
/*global module, require, sinon*/
/**
 * Collections of stubs, spies and mocks.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2011 Christian Johansen
 */
"use strict";

(function (sinon) {
    var commonJSModule = typeof module == "object" && typeof require == "function";
    var push = [].push;

    if (!sinon && commonJSModule) {
        sinon = require("../sinon");
    }

    if (!sinon) {
        return;
    }

    function getFakes(fakeCollection) {
        if (!fakeCollection.fakes) {
            fakeCollection.fakes = [];
        }

        return fakeCollection.fakes;
    }

    function each(fakeCollection, method) {
        var fakes = getFakes(fakeCollection);

        for (var i = 0, l = fakes.length; i < l; i += 1) {
            if (typeof fakes[i][method] == "function") {
                fakes[i][method]();
            }
        }
    }

    function compact(fakeCollection) {
        var fakes = getFakes(fakeCollection);
        var i = 0;
        while (i < fakes.length) {
          fakes.splice(i, 1);
        }
    }

    var collection = {
        verify: function resolve() {
            each(this, "verify");
        },

        restore: function restore() {
            each(this, "restore");
            compact(this);
        },

        verifyAndRestore: function verifyAndRestore() {
            var exception;

            try {
                this.verify();
            } catch (e) {
                exception = e;
            }

            this.restore();

            if (exception) {
                throw exception;
            }
        },

        add: function add(fake) {
            push.call(getFakes(this), fake);
            return fake;
        },

        spy: function spy() {
            return this.add(sinon.spy.apply(sinon, arguments));
        },

        stub: function stub(object, property, value) {
            if (property) {
                var original = object[property];

                if (typeof original != "function") {
                    if (!object.hasOwnProperty(property)) {
                        throw new TypeError("Cannot stub non-existent own property " + property);
                    }

                    object[property] = value;

                    return this.add({
                        restore: function () {
                            object[property] = original;
                        }
                    });
                }
            }
            if (!property && !!object && typeof object == "object") {
                var stubbedObj = sinon.stub.apply(sinon, arguments);

                for (var prop in stubbedObj) {
                    if (typeof stubbedObj[prop] === "function") {
                        this.add(stubbedObj[prop]);
                    }
                }

                return stubbedObj;
            }

            return this.add(sinon.stub.apply(sinon, arguments));
        },

        mock: function mock() {
            return this.add(sinon.mock.apply(sinon, arguments));
        },

        inject: function inject(obj) {
            var col = this;

            obj.spy = function () {
                return col.spy.apply(col, arguments);
            };

            obj.stub = function () {
                return col.stub.apply(col, arguments);
            };

            obj.mock = function () {
                return col.mock.apply(col, arguments);
            };

            return obj;
        }
    };

    if (commonJSModule) {
        module.exports = collection;
    } else {
        sinon.collection = collection;
    }
}(typeof sinon == "object" && sinon || null));
});

require.define("/node_modules/sinon/lib/sinon/assert.js",function(require,module,exports,__dirname,__filename,process){/**
 * @depend ../sinon.js
 * @depend stub.js
 */
/*jslint eqeqeq: false, onevar: false, nomen: false, plusplus: false*/
/*global module, require, sinon*/
/**
 * Assertions matching the test spy retrieval interface.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2011 Christian Johansen
 */
"use strict";

(function (sinon, global) {
    var commonJSModule = typeof module == "object" && typeof require == "function";
    var slice = Array.prototype.slice;
    var assert;

    if (!sinon && commonJSModule) {
        sinon = require("../sinon");
    }

    if (!sinon) {
        return;
    }

    function verifyIsStub() {
        var method;

        for (var i = 0, l = arguments.length; i < l; ++i) {
            method = arguments[i];

            if (!method) {
                assert.fail("fake is not a spy");
            }

            if (typeof method != "function") {
                assert.fail(method + " is not a function");
            }

            if (typeof method.getCall != "function") {
                assert.fail(method + " is not stubbed");
            }
        }
    }

    function failAssertion(object, msg) {
        object = object || global;
        var failMethod = object.fail || assert.fail;
        failMethod.call(object, msg);
    }

    function mirrorPropAsAssertion(name, method, message) {
        if (arguments.length == 2) {
            message = method;
            method = name;
        }

        assert[name] = function (fake) {
            verifyIsStub(fake);

            var args = slice.call(arguments, 1);
            var failed = false;

            if (typeof method == "function") {
                failed = !method(fake);
            } else {
                failed = typeof fake[method] == "function" ?
                    !fake[method].apply(fake, args) : !fake[method];
            }

            if (failed) {
                failAssertion(this, fake.printf.apply(fake, [message].concat(args)));
            } else {
                assert.pass(name);
            }
        };
    }

    function exposedName(prefix, prop) {
        return !prefix || /^fail/.test(prop) ? prop :
            prefix + prop.slice(0, 1).toUpperCase() + prop.slice(1);
    };

    assert = {
        failException: "AssertError",

        fail: function fail(message) {
            var error = new Error(message);
            error.name = this.failException || assert.failException;

            throw error;
        },

        pass: function pass(assertion) {},

        callOrder: function assertCallOrder() {
            verifyIsStub.apply(null, arguments);
            var expected = "", actual = "";

            if (!sinon.calledInOrder(arguments)) {
                try {
                    expected = [].join.call(arguments, ", ");
                    actual = sinon.orderByFirstCall(slice.call(arguments)).join(", ");
                } catch (e) {
                    // If this fails, we'll just fall back to the blank string
                }

                failAssertion(this, "expected " + expected + " to be " +
                              "called in order but were called as " + actual);
            } else {
                assert.pass("callOrder");
            }
        },

        callCount: function assertCallCount(method, count) {
            verifyIsStub(method);

            if (method.callCount != count) {
                var msg = "expected %n to be called " + sinon.timesInWords(count) +
                    " but was called %c%C";
                failAssertion(this, method.printf(msg));
            } else {
                assert.pass("callCount");
            }
        },

        expose: function expose(target, options) {
            if (!target) {
                throw new TypeError("target is null or undefined");
            }

            var o = options || {};
            var prefix = typeof o.prefix == "undefined" && "assert" || o.prefix;
            var includeFail = typeof o.includeFail == "undefined" || !!o.includeFail;

            for (var method in this) {
                if (method != "export" && (includeFail || !/^(fail)/.test(method))) {
                    target[exposedName(prefix, method)] = this[method];
                }
            }

            return target;
        }
    };

    mirrorPropAsAssertion("called", "expected %n to have been called at least once but was never called");
    mirrorPropAsAssertion("notCalled", function (spy) { return !spy.called; },
                          "expected %n to not have been called but was called %c%C");
    mirrorPropAsAssertion("calledOnce", "expected %n to be called once but was called %c%C");
    mirrorPropAsAssertion("calledTwice", "expected %n to be called twice but was called %c%C");
    mirrorPropAsAssertion("calledThrice", "expected %n to be called thrice but was called %c%C");
    mirrorPropAsAssertion("calledOn", "expected %n to be called with %1 as this but was called with %t");
    mirrorPropAsAssertion("alwaysCalledOn", "expected %n to always be called with %1 as this but was called with %t");
    mirrorPropAsAssertion("calledWith", "expected %n to be called with arguments %*%C");
    mirrorPropAsAssertion("calledWithMatch", "expected %n to be called with match %*%C");
    mirrorPropAsAssertion("alwaysCalledWith", "expected %n to always be called with arguments %*%C");
    mirrorPropAsAssertion("alwaysCalledWithMatch", "expected %n to always be called with match %*%C");
    mirrorPropAsAssertion("calledWithExactly", "expected %n to be called with exact arguments %*%C");
    mirrorPropAsAssertion("alwaysCalledWithExactly", "expected %n to always be called with exact arguments %*%C");
    mirrorPropAsAssertion("neverCalledWith", "expected %n to never be called with arguments %*%C");
    mirrorPropAsAssertion("neverCalledWithMatch", "expected %n to never be called with match %*%C");
    mirrorPropAsAssertion("threw", "%n did not throw exception%C");
    mirrorPropAsAssertion("alwaysThrew", "%n did not always throw exception%C");

    if (commonJSModule) {
        module.exports = assert;
    } else {
        sinon.assert = assert;
    }
}(typeof sinon == "object" && sinon || null, typeof window != "undefined" ? window : global));
});

require.define("/node_modules/sinon/lib/sinon/sandbox.js",function(require,module,exports,__dirname,__filename,process){/**
 * @depend ../sinon.js
 * @depend collection.js
 * @depend util/fake_timers.js
 * @depend util/fake_server_with_clock.js
 */
/*jslint eqeqeq: false, onevar: false, plusplus: false*/
/*global require, module*/
/**
 * Manages fake collections as well as fake utilities such as Sinon's
 * timers and fake XHR implementation in one convenient object.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2011 Christian Johansen
 */
"use strict";

if (typeof module == "object" && typeof require == "function") {
    var sinon = require("../sinon");
    sinon.extend(sinon, require("./util/fake_timers"));
}

(function () {
    var push = [].push;

    function exposeValue(sandbox, config, key, value) {
        if (!value) {
            return;
        }

        if (config.injectInto) {
            config.injectInto[key] = value;
        } else {
            push.call(sandbox.args, value);
        }
    }

    function prepareSandboxFromConfig(config) {
        var sandbox = sinon.create(sinon.sandbox);

        if (config.useFakeServer) {
            if (typeof config.useFakeServer == "object") {
                sandbox.serverPrototype = config.useFakeServer;
            }

            sandbox.useFakeServer();
        }

        if (config.useFakeTimers) {
            if (typeof config.useFakeTimers == "object") {
                sandbox.useFakeTimers.apply(sandbox, config.useFakeTimers);
            } else {
                sandbox.useFakeTimers();
            }
        }

        return sandbox;
    }

    sinon.sandbox = sinon.extend(sinon.create(sinon.collection), {
        useFakeTimers: function useFakeTimers() {
            this.clock = sinon.useFakeTimers.apply(sinon, arguments);

            return this.add(this.clock);
        },

        serverPrototype: sinon.fakeServer,

        useFakeServer: function useFakeServer() {
            var proto = this.serverPrototype || sinon.fakeServer;

            if (!proto || !proto.create) {
                return null;
            }

            this.server = proto.create();
            return this.add(this.server);
        },

        inject: function (obj) {
            sinon.collection.inject.call(this, obj);

            if (this.clock) {
                obj.clock = this.clock;
            }

            if (this.server) {
                obj.server = this.server;
                obj.requests = this.server.requests;
            }

            return obj;
        },

        create: function (config) {
            if (!config) {
                return sinon.create(sinon.sandbox);
            }

            var sandbox = prepareSandboxFromConfig(config);
            sandbox.args = sandbox.args || [];
            var prop, value, exposed = sandbox.inject({});

            if (config.properties) {
                for (var i = 0, l = config.properties.length; i < l; i++) {
                    prop = config.properties[i];
                    value = exposed[prop] || prop == "sandbox" && sandbox;
                    exposeValue(sandbox, config, prop, value);
                }
            } else {
                exposeValue(sandbox, config, "sandbox", value);
            }

            return sandbox;
        }
    });

    sinon.sandbox.useFakeXMLHttpRequest = sinon.sandbox.useFakeServer;

    if (typeof module == "object" && typeof require == "function") {
        module.exports = sinon.sandbox;
    }
}());
});

require.define("/node_modules/sinon/lib/sinon/util/fake_timers.js",function(require,module,exports,__dirname,__filename,process){/*jslint eqeqeq: false, plusplus: false, evil: true, onevar: false, browser: true, forin: false*/
/*global module, require, window*/
/**
 * Fake timer API
 * setTimeout
 * setInterval
 * clearTimeout
 * clearInterval
 * tick
 * reset
 * Date
 *
 * Inspired by jsUnitMockTimeOut from JsUnit
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2011 Christian Johansen
 */
"use strict";

if (typeof sinon == "undefined") {
    var sinon = {};
}

(function (global) {
    var id = 1;

    function addTimer(args, recurring) {
        if (args.length === 0) {
            throw new Error("Function requires at least 1 parameter");
        }

        var toId = id++;
        var delay = args[1] || 0;

        if (!this.timeouts) {
            this.timeouts = {};
        }

        this.timeouts[toId] = {
            id: toId,
            func: args[0],
            callAt: this.now + delay,
            invokeArgs: Array.prototype.slice.call(args, 2)
        };

        if (recurring === true) {
            this.timeouts[toId].interval = delay;
        }

        return toId;
    }

    function parseTime(str) {
        if (!str) {
            return 0;
        }

        var strings = str.split(":");
        var l = strings.length, i = l;
        var ms = 0, parsed;

        if (l > 3 || !/^(\d\d:){0,2}\d\d?$/.test(str)) {
            throw new Error("tick only understands numbers and 'h:m:s'");
        }

        while (i--) {
            parsed = parseInt(strings[i], 10);

            if (parsed >= 60) {
                throw new Error("Invalid time " + str);
            }

            ms += parsed * Math.pow(60, (l - i - 1));
        }

        return ms * 1000;
    }

    function createObject(object) {
        var newObject;

        if (Object.create) {
            newObject = Object.create(object);
        } else {
            var F = function () {};
            F.prototype = object;
            newObject = new F();
        }

        newObject.Date.clock = newObject;
        return newObject;
    }

    sinon.clock = {
        now: 0,

        create: function create(now) {
            var clock = createObject(this);

            if (typeof now == "number") {
                clock.now = now;
            }

            if (!!now && typeof now == "object") {
                throw new TypeError("now should be milliseconds since UNIX epoch");
            }

            return clock;
        },

        setTimeout: function setTimeout(callback, timeout) {
            return addTimer.call(this, arguments, false);
        },

        clearTimeout: function clearTimeout(timerId) {
            if (!this.timeouts) {
                this.timeouts = [];
            }

            if (timerId in this.timeouts) {
                delete this.timeouts[timerId];
            }
        },

        setInterval: function setInterval(callback, timeout) {
            return addTimer.call(this, arguments, true);
        },

        clearInterval: function clearInterval(timerId) {
            this.clearTimeout(timerId);
        },

        tick: function tick(ms) {
            ms = typeof ms == "number" ? ms : parseTime(ms);
            var tickFrom = this.now, tickTo = this.now + ms, previous = this.now;
            var timer = this.firstTimerInRange(tickFrom, tickTo);

            var firstException;
            while (timer && tickFrom <= tickTo) {
                if (this.timeouts[timer.id]) {
                    tickFrom = this.now = timer.callAt;
                    try {
                      this.callTimer(timer);
                    } catch (e) {
                      firstException = firstException || e;
                    }
                }

                timer = this.firstTimerInRange(previous, tickTo);
                previous = tickFrom;
            }

            this.now = tickTo;

            if (firstException) {
              throw firstException;
            }
        },

        firstTimerInRange: function (from, to) {
            var timer, smallest, originalTimer;

            for (var id in this.timeouts) {
                if (this.timeouts.hasOwnProperty(id)) {
                    if (this.timeouts[id].callAt < from || this.timeouts[id].callAt > to) {
                        continue;
                    }

                    if (!smallest || this.timeouts[id].callAt < smallest) {
                        originalTimer = this.timeouts[id];
                        smallest = this.timeouts[id].callAt;

                        timer = {
                            func: this.timeouts[id].func,
                            callAt: this.timeouts[id].callAt,
                            interval: this.timeouts[id].interval,
                            id: this.timeouts[id].id,
                            invokeArgs: this.timeouts[id].invokeArgs
                        };
                    }
                }
            }

            return timer || null;
        },

        callTimer: function (timer) {
            if (typeof timer.interval == "number") {
                this.timeouts[timer.id].callAt += timer.interval;
            } else {
                delete this.timeouts[timer.id];
            }

            try {
                if (typeof timer.func == "function") {
                    timer.func.apply(null, timer.invokeArgs);
                } else {
                    eval(timer.func);
                }
            } catch (e) {
              var exception = e;
            }

            if (!this.timeouts[timer.id]) {
                if (exception) {
                  throw exception;
                }
                return;
            }

            if (exception) {
              throw exception;
            }
        },

        reset: function reset() {
            this.timeouts = {};
        },

        Date: (function () {
            var NativeDate = Date;

            function ClockDate(year, month, date, hour, minute, second, ms) {
                // Defensive and verbose to avoid potential harm in passing
                // explicit undefined when user does not pass argument
                switch (arguments.length) {
                case 0:
                    return new NativeDate(ClockDate.clock.now);
                case 1:
                    return new NativeDate(year);
                case 2:
                    return new NativeDate(year, month);
                case 3:
                    return new NativeDate(year, month, date);
                case 4:
                    return new NativeDate(year, month, date, hour);
                case 5:
                    return new NativeDate(year, month, date, hour, minute);
                case 6:
                    return new NativeDate(year, month, date, hour, minute, second);
                default:
                    return new NativeDate(year, month, date, hour, minute, second, ms);
                }
            }

            return mirrorDateProperties(ClockDate, NativeDate);
        }())
    };

    function mirrorDateProperties(target, source) {
        if (source.now) {
            target.now = function now() {
                return target.clock.now;
            };
        } else {
            delete target.now;
        }

        if (source.toSource) {
            target.toSource = function toSource() {
                return source.toSource();
            };
        } else {
            delete target.toSource;
        }

        target.toString = function toString() {
            return source.toString();
        };

        target.prototype = source.prototype;
        target.parse = source.parse;
        target.UTC = source.UTC;
        target.prototype.toUTCString = source.prototype.toUTCString;
        return target;
    }

    var methods = ["Date", "setTimeout", "setInterval",
                   "clearTimeout", "clearInterval"];

    function restore() {
        var method;

        for (var i = 0, l = this.methods.length; i < l; i++) {
            method = this.methods[i];
            if (global[method].hadOwnProperty) {
                global[method] = this["_" + method];
            } else {
                delete global[method];
            }
        }

        // Prevent multiple executions which will completely remove these props
        this.methods = [];
    }

    function stubGlobal(method, clock) {
        clock[method].hadOwnProperty = Object.prototype.hasOwnProperty.call(global, method);
        clock["_" + method] = global[method];

        if (method == "Date") {
            var date = mirrorDateProperties(clock[method], global[method]);
            global[method] = date;
        } else {
            global[method] = function () {
                return clock[method].apply(clock, arguments);
            };

            for (var prop in clock[method]) {
                if (clock[method].hasOwnProperty(prop)) {
                    global[method][prop] = clock[method][prop];
                }
            }
        }

        global[method].clock = clock;
    }

    sinon.useFakeTimers = function useFakeTimers(now) {
        var clock = sinon.clock.create(now);
        clock.restore = restore;
        clock.methods = Array.prototype.slice.call(arguments,
                                                   typeof now == "number" ? 1 : 0);

        if (clock.methods.length === 0) {
            clock.methods = methods;
        }

        for (var i = 0, l = clock.methods.length; i < l; i++) {
            stubGlobal(clock.methods[i], clock);
        }

        return clock;
    };
}(typeof global != "undefined" && typeof global !== "function" ? global : this));

sinon.timers = {
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    Date: Date
};

if (typeof module == "object" && typeof require == "function") {
    module.exports = sinon;
}
});

require.define("/node_modules/sinon/lib/sinon/test.js",function(require,module,exports,__dirname,__filename,process){/**
 * @depend ../sinon.js
 * @depend stub.js
 * @depend mock.js
 * @depend sandbox.js
 */
/*jslint eqeqeq: false, onevar: false, forin: true, plusplus: false*/
/*global module, require, sinon*/
/**
 * Test function, sandboxes fakes
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2011 Christian Johansen
 */
"use strict";

(function (sinon) {
    var commonJSModule = typeof module == "object" && typeof require == "function";

    if (!sinon && commonJSModule) {
        sinon = require("../sinon");
    }

    if (!sinon) {
        return;
    }

    function test(callback) {
        var type = typeof callback;

        if (type != "function") {
            throw new TypeError("sinon.test needs to wrap a test function, got " + type);
        }

        return function () {
            var config = sinon.getConfig(sinon.config);
            config.injectInto = config.injectIntoThis && this || config.injectInto;
            var sandbox = sinon.sandbox.create(config);
            var exception, result;
            var args = Array.prototype.slice.call(arguments).concat(sandbox.args);

            try {
                result = callback.apply(this, args);
            } finally {
                sandbox.verifyAndRestore();
            }

            return result;
        };
    }

    test.config = {
        injectIntoThis: true,
        injectInto: null,
        properties: ["spy", "stub", "mock", "clock", "server", "requests"],
        useFakeTimers: true,
        useFakeServer: true
    };

    if (commonJSModule) {
        module.exports = test;
    } else {
        sinon.test = test;
    }
}(typeof sinon == "object" && sinon || null));
});

require.define("/node_modules/sinon/lib/sinon/test_case.js",function(require,module,exports,__dirname,__filename,process){/**
 * @depend ../sinon.js
 * @depend test.js
 */
/*jslint eqeqeq: false, onevar: false, eqeqeq: false*/
/*global module, require, sinon*/
/**
 * Test case, sandboxes all test functions
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2011 Christian Johansen
 */
"use strict";

(function (sinon) {
    var commonJSModule = typeof module == "object" && typeof require == "function";

    if (!sinon && commonJSModule) {
        sinon = require("../sinon");
    }

    if (!sinon || !Object.prototype.hasOwnProperty) {
        return;
    }

    function createTest(property, setUp, tearDown) {
        return function () {
            if (setUp) {
                setUp.apply(this, arguments);
            }

            var exception, result;

            try {
                result = property.apply(this, arguments);
            } catch (e) {
                exception = e;
            }

            if (tearDown) {
                tearDown.apply(this, arguments);
            }

            if (exception) {
                throw exception;
            }

            return result;
        };
    }

    function testCase(tests, prefix) {
        /*jsl:ignore*/
        if (!tests || typeof tests != "object") {
            throw new TypeError("sinon.testCase needs an object with test functions");
        }
        /*jsl:end*/

        prefix = prefix || "test";
        var rPrefix = new RegExp("^" + prefix);
        var methods = {}, testName, property, method;
        var setUp = tests.setUp;
        var tearDown = tests.tearDown;

        for (testName in tests) {
            if (tests.hasOwnProperty(testName)) {
                property = tests[testName];

                if (/^(setUp|tearDown)$/.test(testName)) {
                    continue;
                }

                if (typeof property == "function" && rPrefix.test(testName)) {
                    method = property;

                    if (setUp || tearDown) {
                        method = createTest(property, setUp, tearDown);
                    }

                    methods[testName] = sinon.test(method);
                } else {
                    methods[testName] = tests[testName];
                }
            }
        }

        return methods;
    }

    if (commonJSModule) {
        module.exports = testCase;
    } else {
        sinon.testCase = testCase;
    }
}(typeof sinon == "object" && sinon || null));
});

require.define("/node_modules/sinon/lib/sinon/match.js",function(require,module,exports,__dirname,__filename,process){/* @depend ../sinon.js */
/*jslint eqeqeq: false, onevar: false, plusplus: false*/
/*global module, require, sinon*/
/**
 * Match functions
 *
 * @author Maximilian Antoni (mail@maxantoni.de)
 * @license BSD
 *
 * Copyright (c) 2012 Maximilian Antoni
 */
"use strict";

(function (sinon) {
    var commonJSModule = typeof module == "object" && typeof require == "function";

    if (!sinon && commonJSModule) {
        sinon = require("../sinon");
    }

    if (!sinon) {
        return;
    }

    function assertType(value, type, name) {
        var actual = sinon.typeOf(value);
        if (actual !== type) {
            throw new TypeError("Expected type of " + name + " to be " +
                type + ", but was " + actual);
        }
    }

    var matcher = {
        toString: function () {
            return this.message;
        }
    };

    function isMatcher(object) {
        return matcher.isPrototypeOf(object);
    }

    function matchObject(expectation, actual) {
        if (actual === null || actual === undefined) {
            return false;
        }
        for (var key in expectation) {
            if (expectation.hasOwnProperty(key)) {
                var exp = expectation[key];
                var act = actual[key];
                if (match.isMatcher(exp)) {
                    if (!exp.test(act)) {
                        return false;
                    }
                } else if (sinon.typeOf(exp) === "object") {
                    if (!matchObject(exp, act)) {
                        return false;
                    }
                } else if (exp !== act) {
                    return false;
                }
            }
        }
        return true;
    }

    matcher.or = function (m2) {
        if (!isMatcher(m2)) {
            throw new TypeError("Matcher expected");
        }
        var m1 = this;
        var or = sinon.create(matcher);
        or.test = function (actual) {
            return m1.test(actual) || m2.test(actual);
        };
        or.message = m1.message + ".or(" + m2.message + ")";
        return or;
    };

    matcher.and = function (m2) {
        if (!isMatcher(m2)) {
            throw new TypeError("Matcher expected");
        }
        var m1 = this;
        var and = sinon.create(matcher);
        and.test = function (actual) {
            return m1.test(actual) && m2.test(actual);
        };
        and.message = m1.message + ".and(" + m2.message + ")";
        return and;
    };

    var match = function (expectation, message) {
        var m = sinon.create(matcher);
        var type = sinon.typeOf(expectation);
        switch (type) {
        case "object":
            if (typeof expectation.test === "function") {
                m.test = function (actual) {
                    return expectation.test(actual) === true;
                };
                m.message = "match(" + sinon.functionName(expectation.test) + ")";
                return m;
            }
            var str = [];
            for (var key in expectation) {
                if (expectation.hasOwnProperty(key)) {
                    str.push(key + ": " + expectation[key]);
                }
            }
            m.test = function (actual) {
                return matchObject(expectation, actual);
            };
            m.message = "match(" + str.join(", ") + ")";
            break;
        case "number":
            m.test = function (actual) {
                return expectation == actual;
            };
            break;
        case "string":
            m.test = function (actual) {
                if (typeof actual !== "string") {
                    return false;
                }
                return actual.indexOf(expectation) !== -1;
            };
            m.message = "match(\"" + expectation + "\")";
            break;
        case "regexp":
            m.test = function (actual) {
                if (typeof actual !== "string") {
                    return false;
                }
                return expectation.test(actual);
            };
            break;
        case "function":
            m.test = expectation;
            if (message) {
                m.message = message;
            } else {
                m.message = "match(" + sinon.functionName(expectation) + ")";
            }
            break;
        default:
            m.test = function (actual) {
              return sinon.deepEqual(expectation, actual);
            };
        }
        if (!m.message) {
            m.message = "match(" + expectation + ")";
        }
        return m;
    };

    match.isMatcher = isMatcher;

    match.any = match(function () {
        return true;
    }, "any");

    match.defined = match(function (actual) {
        return actual !== null && actual !== undefined;
    }, "defined");

    match.truthy = match(function (actual) {
        return !!actual;
    }, "truthy");

    match.falsy = match(function (actual) {
        return !actual;
    }, "falsy");

    match.same = function (expectation) {
        return match(function (actual) {
            return expectation === actual;
        }, "same(" + expectation + ")");
    };

    match.typeOf = function (type) {
        assertType(type, "string", "type");
        return match(function (actual) {
            return sinon.typeOf(actual) === type;
        }, "typeOf(\"" + type + "\")");
    };

    match.instanceOf = function (type) {
        assertType(type, "function", "type");
        return match(function (actual) {
            return actual instanceof type;
        }, "instanceOf(" + sinon.functionName(type) + ")");
    };

    function createPropertyMatcher(propertyTest, messagePrefix) {
        return function (property, value) {
            assertType(property, "string", "property");
            var onlyProperty = arguments.length === 1;
            var message = messagePrefix + "(\"" + property + "\"";
            if (!onlyProperty) {
                message += ", " + value;
            }
            message += ")";
            return match(function (actual) {
                if (actual === undefined || actual === null ||
                        !propertyTest(actual, property)) {
                    return false;
                }
                return onlyProperty || sinon.deepEqual(value, actual[property]);
            }, message);
        };
    }

    match.has = createPropertyMatcher(function (actual, property) {
        if (typeof actual === "object") {
            return property in actual;
        }
        return actual[property] !== undefined;
    }, "has");

    match.hasOwn = createPropertyMatcher(function (actual, property) {
        return actual.hasOwnProperty(property);
    }, "hasOwn");

    match.bool = match.typeOf("boolean");
    match.number = match.typeOf("number");
    match.string = match.typeOf("string");
    match.object = match.typeOf("object");
    match.func = match.typeOf("function");
    match.array = match.typeOf("array");
    match.regexp = match.typeOf("regexp");
    match.date = match.typeOf("date");

    if (commonJSModule) {
        module.exports = match;
    } else {
        sinon.match = match;
    }
}(typeof sinon == "object" && sinon || null));
});

require.define("/bin/testlingAdapter.js",function(require,module,exports,__dirname,__filename,process){var stream = require("testling").stream
    , es = require("event-stream")
    , gate = es.gate()
    , first = false
    , socket
    , results = {
        failed: 0
        , passed: 0
        , total: 0
        , tests: []
    }

var adapterStream = es.connect(
    gate
    , es.through(writer, ender)
)

stream.pipe(adapterStream)

window.customAdapter = customAdapter

function customAdapter(_socket) {
    socket = _socket
    gate.open()
}

function writer(data) {
    if (first === false) {
        first = true
        emit("tests-start")
    }

    if (typeof data === "object") {
        var tst = {
            passed: 0
            , failed: 0
            , total: 1
            , id: data.id
            , name: data.name
            , items: []
        }

        if (!data.ok) {
            tst.items.push({
                passed: false
                , message: data.name
                , stacktrace: data.stack.join("\n")
            })
            results.failed++
            tst.failed++
        } else {
            results.passed++
            tst.passed++
        }

        results.total++
        results.tests.push(tst)

        emit("test-result", tst)
    }
}

function ender() {
    emit("all-tests-results", results)
}

function emit() {
    socket.emit.apply(socket, arguments)
}});
require("/bin/testlingAdapter.js");

require.define("/test/unit.js",function(require,module,exports,__dirname,__filename,process){var compose = require("..")
    , composeAsync = compose.async
    , sinon = require("sinon")
    , assert = require("assert")
    , curry = require("ap").curry
    , test = require("testling")
    , globalScope = typeof global === "undefined" ? window : global

test("compose with empty functions", function (t) {
    var a = sinon.spy()
        , b = sinon.spy()

    var composed = compose(a, b)
        , result = composed(5)

    t.equal(typeof composed, "function", "composed is not a function")
    t.ok(a.calledOnce, "a was not called once")
    t.ok(a.calledWith(5), "a was not called with 5")
    t.ok(b.calledOnce, "b was not called once")
    t.ok(b.calledWith(undefined), "b was not called with undefined")
    t.equal(result, undefined, "result is not undefined")

    t.end()
})

test("compose with non-trivial functions", function (t) {
    var a = sinon.stub().returns(4)
        , b = sinon.stub().returns(8)

    var composed = compose(a, b)
        , result = composed(5)

    t.equal(typeof composed, "function", "composed is not a function")
    t.ok(a.calledOnce, "a was not called once")
    t.ok(a.calledWith(5), "a was not called with 5")
    t.ok(b.calledOnce, "b was not called once")
    t.ok(b.calledWith(4), "b was not called with 4")
    t.equal(result, 8, "result is not 8")

    t.end()
})

test("compose with array values", function (t)  {
    var a = sinon.stub().returns([1,2,3])
        , b = sinon.spy()

    var composed = compose(a, b)
        , result = composed(5)

    t.equal(typeof composed, "function", "composed is not a function")
    t.ok(a.calledOnce, "a was not called once")
    t.ok(a.calledWith(5), "a was not called with 5")
    t.ok(b.calledOnce, "b was not called once")
    t.ok(b.calledWith(1,2,3), "b was not called with 1,2,3")
    t.equal(result, undefined, "result is not undefined")

    t.end()
})

test("compose with thisValue", function (t) {
    var a = sinon.spy()
        , b = sinon.spy()
        , thisValue = {}

    var composed = compose(a, b)
        , result = composed.call(thisValue)

    t.equal(typeof composed, "function", "composed is not a function")
    t.ok(a.calledOnce, "a was not called once")
    t.ok(a.calledWith(undefined), "a was not called with undefined")
    t.equal(a.thisValues[0], thisValue,
        "a was not called with correct this value")
    t.ok(b.calledOnce, "b was not called once")
    t.ok(b.calledWith(undefined), "b was not called with undefined")
    t.equal(b.thisValues[0], thisValue,
        "b was not called with correct this value")
    t.equal(result, undefined, "result is not undefined")

    t.end()
})

test("compose with a fresh thisValue", function (t) {
    var a = sinon.spy()
        , b = sinon.spy()

    var composed = compose(a, b)
        , result = composed()

    t.equal(typeof composed, "function", "composed is not a function")
    t.ok(a.calledOnce, "a was not called once")
    t.ok(a.calledWith(undefined), "a was not called with undefined")
    t.ok(b.calledOnce, "b was not called once")
    t.ok(b.calledWith(undefined), "b was not called with undefined")
    t.equal(result, undefined, "result is not undefined")
    t.equal(a.thisValues[0], b.thisValues[0],
        "thisValues are not the same")
    t.equal(typeof a.thisValues[0], "object",
        "this value is not an object")
    t.ok(a.thisValues[0] !== globalScope, "thisValue is the global object")

    t.end()
})

test("compose with multiple functions", function (t) {
    var a = sinon.spy()
        , b = sinon.spy()
        , c = sinon.spy()
        , d = sinon.spy()

    var composed = compose(a, b, c, d)
        , result = composed()

    t.equal(typeof composed, "function", "composed is not a function")
    t.ok(a.calledOnce, "a was not called once")
    t.ok(a.calledWith(undefined), "a was not called with undefined")
    t.ok(b.calledOnce, "b was not called once")
    t.ok(b.calledWith(undefined), "b was not called with undefined")
    t.ok(c.calledOnce, "c was not called once")
    t.ok(c.calledWith(undefined), "c was not called with undefined")
    t.ok(d.calledOnce, "d was not called once")
    t.ok(d.calledWith(undefined), "d was not called with undefined")
    t.equal(result, undefined, "result is not undefined")

    t.end()
})

test("composeAsync with empty functions", function (t) {
    var a = sinon.stub().callsArg(0)
        , b = sinon.stub().callsArg(0)
        , callback = sinon.spy()

    var composed = composeAsync(a, b)
        , result = composed(callback)

    t.equal(typeof composed, "function", "composed is not a function")
    t.ok(a.calledOnce, "a was not called once")
    t.ok(a.calledWith(sinon.match.func),
        "a was not called with a function")
    t.ok(b.calledOnce, "b was not called once")
    t.ok(b.calledWith(sinon.match.func),
        "b was not called with a function")
    t.ok(callback.calledOnce, "callback was not called once")
    t.ok(callback.calledWith(undefined),
        "callback was not called with undefined")
    t.equal(result, undefined, "result is not undefined")

    t.end()
})

test("composeASync with non-trivial functions", function (t) {
    t.end()
})});
require("/test/unit.js");
})();
