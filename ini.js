exports.parse = exports.decode = decode
exports.stringify = exports.encode = encode

exports.safe = safe
exports.unsafe = unsafe

// Checks to see what platform of computer is being used, and changes the newline character appropriately
var eol = process.platform === 'win32' ? '\r\n' : '\n'

/**
* Returns the object (obj) as ini-style formatted string
* @param {string} obj - An ini-style formatted string (if the optional parameter options.section is given, then all top-level properties of the object are put into this section).
* @param {(Object|String)} [opt] - The options specified for the given .ini file
* @param {string} [opt.section=none] - A string which will be the first section in the encoded ini data.
* @param {string} [opt.whitespace=false] - Boolean to specify whether to put the whitespace around the "=" character.
* @returns {string} out - An ini-style formatted string
**/
function encode (obj, opt) {
  var children = []
  var out = ''

  // Creates a default options object if a string is passed in instead of an options object
  if (typeof opt === 'string') {
    opt = {
      section: opt,
      whitespace: false
    }
  } else {
    opt = opt || {}
    opt.whitespace = opt.whitespace === true
  }

  var separator = opt.whitespace ? ' = ' : '='

  // Puts all keys into proper format for the output
  Object.keys(obj).forEach(function (k, _, __) {
    var val = obj[k]
    if (val && Array.isArray(val)) {
      val.forEach(function (item) {
        out += safe(k + '[]') + separator + safe(item) + '\n'
      })
    } else if (val && typeof val === 'object') {
      children.push(k)
    } else {
      out += safe(k) + separator + safe(val) + eol
    }
  })

  if (opt.section && out.length) {
    out = '[' + safe(opt.section) + ']' + eol + out
  }

  // Puts all children into proper format for the output (if there are any)
  children.forEach(function (k, _, __) {
    var nk = dotSplit(k).join('\\.')
    var section = (opt.section ? opt.section + '.' : '') + nk
    var child = encode(obj[k], {
      section: section,
      whitespace: opt.whitespace
    })
    if (out.length && child.length) {
      out += eol
    }
    out += child
  })

  return out
}

// Helper function for encode which returns an array in the correct format
function dotSplit (str) {
  return str.replace(/\1/g, '\u0002LITERAL\\1LITERAL\u0002')
    .replace(/\\\./g, '\u0001')
    .split(/\./).map(function (part) {
    return part.replace(/\1/g, '\\.')
      .replace(/\2LITERAL\\1LITERAL\2/g, '\u0001')
  })
}

/**
* Decodes the ini-style formatted string into a nested object.
* @param {string} str - An ini-style formatted string
* @return {Object} out - A nested ini object
*/
function decode (str) {
  var out = {}
  var p = out
  var section = null
  //          section     |key      = value
  var re = /^\[([^\]]*)\]$|^([^=]+)(=(.*))?$/i
  var lines = str.split(/[\r\n]+/g)

  lines.forEach(function (line, _, __) {
    if (!line || line.match(/^\s*[;#]/)) return
    var match = line.match(re)
    if (!match) return
    if (match[1] !== undefined) {
      section = unsafe(match[1])
      p = out[section] = out[section] || {}
      return
    }
    var key = unsafe(match[2])
    var value = match[3] ? unsafe((match[4] || '')) : true
    switch (value) {
      case 'true':
      case 'false':
      case 'null': value = JSON.parse(value)
    }

    // Convert keys with '[]' suffix to an array
    if (key.length > 2 && key.slice(-2) === '[]') {
      key = key.substring(0, key.length - 2)
      if (!p[key]) {
        p[key] = []
      } else if (!Array.isArray(p[key])) {
        p[key] = [p[key]]
      }
    }

    // safeguard against resetting a previously defined
    // array by accidentally forgetting the brackets
    if (Array.isArray(p[key])) {
      p[key].push(value)
    } else {
      p[key] = value
    }
  })

  // {a:{y:1},"a.b":{x:2}} --> {a:{y:1,b:{x:2}}}
  // use a filter to return the keys that have to be deleted.
  Object.keys(out).filter(function (k, _, __) {
    if (!out[k] ||
      typeof out[k] !== 'object' ||
      Array.isArray(out[k])) {
      return false
    }
    // see if the parent section is also an object.
    // if so, add it to that, and mark this one for deletion
    var parts = dotSplit(k)
    var p = out
    var l = parts.pop()
    var nl = l.replace(/\\\./g, '.')
    parts.forEach(function (part, _, __) {
      if (!p[part] || typeof p[part] !== 'object') p[part] = {}
      p = p[part]
    })
    if (p === out && nl === l) {
      return false
    }
    p[nl] = out[k]
    return true
  }).forEach(function (del, _, __) {
    delete out[del]
  })

  return out
}

/**
* Returns whether the string is quoted
* @param {string} val - Value to check to see if there's a quote at the beginning and end of the passed in string
* @return {boolean} - True if there are quotes at the beginning and end of the string, false if not
*/
function isQuoted (val) {
  return (val.charAt(0) === '"' && val.slice(-1) === '"') ||
    (val.charAt(0) === "'" && val.slice(-1) === "'")
}

/**
* Returns a "safe" version of the string passed in that properly escapes all neccesary comments / special characters
* @param {string} val - String that needs to be made safe
* @return {string} - String passed in made "safe" by esacping the necessary special characters
*/
function safe (val) {
  return (typeof val !== 'string' ||
    val.match(/[=\r\n]/) ||
    val.match(/^\[/) ||
    (val.length > 1 &&
     isQuoted(val)) ||
    val !== val.trim()) ?
      JSON.stringify(val) :
      val.replace(/;/g, '\\;').replace(/#/g, '\\#')
}

/**
* Returns an "unsafe" version of the string passed in.
* @param {string} val - String that needs needs the special characters un-escaped.
* @return {string} - A string with all the special characters un-escaped.
*/
function unsafe (val, doUnesc) {
  val = (val || '').trim()
  if (isQuoted(val)) {
    // remove the single quotes before calling JSON.parse
    if (val.charAt(0) === "'") {
      val = val.substr(1, val.length - 2)
    }
    try { val = JSON.parse(val) } catch (_) {}
  } else {
    // walk the val to find the first not-escaped ; character
    var esc = false
    var unesc = ''
    for (var i = 0, l = val.length; i < l; i++) {
      var c = val.charAt(i)
      if (esc) {
        if ('\\;#'.indexOf(c) !== -1) {
          unesc += c
        } else {
          unesc += '\\' + c
        }
        esc = false
      } else if (';#'.indexOf(c) !== -1) {
        break
      } else if (c === '\\') {
        esc = true
      } else {
        unesc += c
      }
    }
    if (esc) {
      unesc += '\\'
    }
    return unesc
  }
  return val
}
