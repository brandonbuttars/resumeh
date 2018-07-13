/**
 * Shorter and fast way to select a single node in the DOM
 * @param   { String } selector - unique dom selector
 * @param   { Object } ctx - DOM node where the target of our search will is located
 * @returns { Object } dom node found
 */
function $(selector, ctx) {
  return (ctx || document).querySelector(selector)
}

const
  // be aware, internal usage
  // ATTENTION: prefix the global dynamic variables with `__`
  // tags instances cache
  __TAGS_CACHE = [],
  // tags implementation cache
  __TAG_IMPL = {},
  YIELD_TAG = 'yield',

  /**
   * Const
   */
  GLOBAL_MIXIN = '__global_mixin',

  // riot specific prefixes or attributes
  ATTRS_PREFIX = 'riot-',

  // Riot Directives
  REF_DIRECTIVES = ['ref', 'data-ref'],
  IS_DIRECTIVE = 'data-is',
  CONDITIONAL_DIRECTIVE = 'if',
  LOOP_DIRECTIVE = 'each',
  LOOP_NO_REORDER_DIRECTIVE = 'no-reorder',
  SHOW_DIRECTIVE = 'show',
  HIDE_DIRECTIVE = 'hide',
  KEY_DIRECTIVE = 'key',
  RIOT_EVENTS_KEY = '__riot-events__',

  // for typeof == '' comparisons
  T_STRING = 'string',
  T_OBJECT = 'object',
  T_UNDEF  = 'undefined',
  T_FUNCTION = 'function',

  XLINK_NS = 'http://www.w3.org/1999/xlink',
  SVG_NS = 'http://www.w3.org/2000/svg',
  XLINK_REGEX = /^xlink:(\w+)/,

  WIN = typeof window === T_UNDEF ? /* istanbul ignore next */ undefined : window,

  // special native tags that cannot be treated like the others
  RE_SPECIAL_TAGS = /^(?:t(?:body|head|foot|[rhd])|caption|col(?:group)?|opt(?:ion|group))$/,
  RE_SPECIAL_TAGS_NO_OPTION = /^(?:t(?:body|head|foot|[rhd])|caption|col(?:group)?)$/,
  RE_EVENTS_PREFIX = /^on/,
  RE_HTML_ATTRS = /([-\w]+) ?= ?(?:"([^"]*)|'([^']*)|({[^}]*}))/g,
  // some DOM attributes must be normalized
  CASE_SENSITIVE_ATTRIBUTES = {
    'viewbox': 'viewBox',
    'preserveaspectratio': 'preserveAspectRatio'
  },
  /**
   * Matches boolean HTML attributes in the riot tag definition.
   * With a long list like this, a regex is faster than `[].indexOf` in most browsers.
   * @const {RegExp}
   * @see [attributes.md](https://github.com/riot/compiler/blob/dev/doc/attributes.md)
   */
  RE_BOOL_ATTRS = /^(?:disabled|checked|readonly|required|allowfullscreen|auto(?:focus|play)|compact|controls|default|formnovalidate|hidden|ismap|itemscope|loop|multiple|muted|no(?:resize|shade|validate|wrap)?|open|reversed|seamless|selected|sortable|truespeed|typemustmatch)$/,
  // version# for IE 8-11, 0 for others
  IE_VERSION = (WIN && WIN.document || /* istanbul ignore next */ {}).documentMode | 0;

/**
 * Create a generic DOM node
 * @param   { String } name - name of the DOM node we want to create
 * @returns { Object } DOM node just created
 */
function makeElement(name) {
  return name === 'svg' ? document.createElementNS(SVG_NS, name) : document.createElement(name)
}

/**
 * Set any DOM attribute
 * @param { Object } dom - DOM node we want to update
 * @param { String } name - name of the property we want to set
 * @param { String } val - value of the property we want to set
 */
function setAttribute(dom, name, val) {
  const xlink = XLINK_REGEX.exec(name);
  if (xlink && xlink[1])
    dom.setAttributeNS(XLINK_NS, xlink[1], val);
  else
    dom.setAttribute(name, val);
}

let styleNode;
// Create cache and shortcut to the correct property
let cssTextProp;
let byName = {};
let needsInject = false;

// skip the following code on the server
if (WIN) {
  styleNode = ((() => {
    // create a new style element with the correct type
    const newNode = makeElement('style');
    // replace any user node or insert the new one into the head
    const userNode = $('style[type=riot]');

    setAttribute(newNode, 'type', 'text/css');
    /* istanbul ignore next */
    if (userNode) {
      if (userNode.id) newNode.id = userNode.id;
      userNode.parentNode.replaceChild(newNode, userNode);
    } else document.head.appendChild(newNode);

    return newNode
  }))();
  cssTextProp = styleNode.styleSheet;
}

/**
 * Object that will be used to inject and manage the css of every tag instance
 */
var styleManager = {
  styleNode,
  /**
   * Save a tag style to be later injected into DOM
   * @param { String } css - css string
   * @param { String } name - if it's passed we will map the css to a tagname
   */
  add(css, name) {
    byName[name] = css;
    needsInject = true;
  },
  /**
   * Inject all previously saved tag styles into DOM
   * innerHTML seems slow: http://jsperf.com/riot-insert-style
   */
  inject() {
    if (!WIN || !needsInject) return
    needsInject = false;
    const style = Object.keys(byName)
      .map(k => byName[k])
      .join('\n');
    /* istanbul ignore next */
    if (cssTextProp) cssTextProp.cssText = style;
    else styleNode.innerHTML = style;
  },

  /**
   * Remove a tag style of injected DOM later.
   * @param {String} name a registered tagname
   */
  remove(name) {
    delete byName[name];
    needsInject = true;
  }
};

/**
 * The riot template engine
 * @version v3.0.8
 */

var skipRegex = (function () { //eslint-disable-line no-unused-vars

  var beforeReChars = '[{(,;:?=|&!^~>%*/';

  var beforeReWords = [
    'case',
    'default',
    'do',
    'else',
    'in',
    'instanceof',
    'prefix',
    'return',
    'typeof',
    'void',
    'yield'
  ];

  var wordsLastChar = beforeReWords.reduce(function (s, w) {
    return s + w.slice(-1)
  }, '');

  var RE_REGEX = /^\/(?=[^*>/])[^[/\\]*(?:(?:\\.|\[(?:\\.|[^\]\\]*)*\])[^[\\/]*)*?\/[gimuy]*/;
  var RE_VN_CHAR = /[$\w]/;

  function prev (code, pos) {
    while (--pos >= 0 && /\s/.test(code[pos]));
    return pos
  }

  function _skipRegex (code, start) {

    var re = /.*/g;
    var pos = re.lastIndex = start++;
    var match = re.exec(code)[0].match(RE_REGEX);

    if (match) {
      var next = pos + match[0].length;

      pos = prev(code, pos);
      var c = code[pos];

      if (pos < 0 || ~beforeReChars.indexOf(c)) {
        return next
      }

      if (c === '.') {

        if (code[pos - 1] === '.') {
          start = next;
        }

      } else if (c === '+' || c === '-') {

        if (code[--pos] !== c ||
            (pos = prev(code, pos)) < 0 ||
            !RE_VN_CHAR.test(code[pos])) {
          start = next;
        }

      } else if (~wordsLastChar.indexOf(c)) {

        var end = pos + 1;

        while (--pos >= 0 && RE_VN_CHAR.test(code[pos]));
        if (~beforeReWords.indexOf(code.slice(pos + 1, end))) {
          start = next;
        }
      }
    }

    return start
  }

  return _skipRegex

})();

/**
 * riot.util.brackets
 *
 * - `brackets    ` - Returns a string or regex based on its parameter
 * - `brackets.set` - Change the current riot brackets
 *
 * @module
 */

/* global riot */

var brackets = (function (UNDEF) {

  var
    REGLOB = 'g',

    R_MLCOMMS = /\/\*[^*]*\*+(?:[^*\/][^*]*\*+)*\//g,

    R_STRINGS = /"[^"\\]*(?:\\[\S\s][^"\\]*)*"|'[^'\\]*(?:\\[\S\s][^'\\]*)*'|`[^`\\]*(?:\\[\S\s][^`\\]*)*`/g,

    S_QBLOCKS = R_STRINGS.source + '|' +
      /(?:\breturn\s+|(?:[$\w\)\]]|\+\+|--)\s*(\/)(?![*\/]))/.source + '|' +
      /\/(?=[^*\/])[^[\/\\]*(?:(?:\[(?:\\.|[^\]\\]*)*\]|\\.)[^[\/\\]*)*?([^<]\/)[gim]*/.source,

    UNSUPPORTED = RegExp('[\\' + 'x00-\\x1F<>a-zA-Z0-9\'",;\\\\]'),

    NEED_ESCAPE = /(?=[[\]()*+?.^$|])/g,

    S_QBLOCK2 = R_STRINGS.source + '|' + /(\/)(?![*\/])/.source,

    FINDBRACES = {
      '(': RegExp('([()])|'   + S_QBLOCK2, REGLOB),
      '[': RegExp('([[\\]])|' + S_QBLOCK2, REGLOB),
      '{': RegExp('([{}])|'   + S_QBLOCK2, REGLOB)
    },

    DEFAULT = '{ }';

  var _pairs = [
    '{', '}',
    '{', '}',
    /{[^}]*}/,
    /\\([{}])/g,
    /\\({)|{/g,
    RegExp('\\\\(})|([[({])|(})|' + S_QBLOCK2, REGLOB),
    DEFAULT,
    /^\s*{\^?\s*([$\w]+)(?:\s*,\s*(\S+))?\s+in\s+(\S.*)\s*}/,
    /(^|[^\\]){=[\S\s]*?}/
  ];

  var
    cachedBrackets = UNDEF,
    _regex,
    _cache = [],
    _settings;

  function _loopback (re) { return re }

  function _rewrite (re, bp) {
    if (!bp) bp = _cache;
    return new RegExp(
      re.source.replace(/{/g, bp[2]).replace(/}/g, bp[3]), re.global ? REGLOB : ''
    )
  }

  function _create (pair) {
    if (pair === DEFAULT) return _pairs

    var arr = pair.split(' ');

    if (arr.length !== 2 || UNSUPPORTED.test(pair)) {
      throw new Error('Unsupported brackets "' + pair + '"')
    }
    arr = arr.concat(pair.replace(NEED_ESCAPE, '\\').split(' '));

    arr[4] = _rewrite(arr[1].length > 1 ? /{[\S\s]*?}/ : _pairs[4], arr);
    arr[5] = _rewrite(pair.length > 3 ? /\\({|})/g : _pairs[5], arr);
    arr[6] = _rewrite(_pairs[6], arr);
    arr[7] = RegExp('\\\\(' + arr[3] + ')|([[({])|(' + arr[3] + ')|' + S_QBLOCK2, REGLOB);
    arr[8] = pair;
    return arr
  }

  function _brackets (reOrIdx) {
    return reOrIdx instanceof RegExp ? _regex(reOrIdx) : _cache[reOrIdx]
  }

  _brackets.split = function split (str, tmpl, _bp) {
    // istanbul ignore next: _bp is for the compiler
    if (!_bp) _bp = _cache;

    var
      parts = [],
      match,
      isexpr,
      start,
      pos,
      re = _bp[6];

    var qblocks = [];
    var prevStr = '';
    var mark, lastIndex;

    isexpr = start = re.lastIndex = 0;

    while ((match = re.exec(str))) {

      lastIndex = re.lastIndex;
      pos = match.index;

      if (isexpr) {

        if (match[2]) {

          var ch = match[2];
          var rech = FINDBRACES[ch];
          var ix = 1;

          rech.lastIndex = lastIndex;
          while ((match = rech.exec(str))) {
            if (match[1]) {
              if (match[1] === ch) ++ix;
              else if (!--ix) break
            } else {
              rech.lastIndex = pushQBlock(match.index, rech.lastIndex, match[2]);
            }
          }
          re.lastIndex = ix ? str.length : rech.lastIndex;
          continue
        }

        if (!match[3]) {
          re.lastIndex = pushQBlock(pos, lastIndex, match[4]);
          continue
        }
      }

      if (!match[1]) {
        unescapeStr(str.slice(start, pos));
        start = re.lastIndex;
        re = _bp[6 + (isexpr ^= 1)];
        re.lastIndex = start;
      }
    }

    if (str && start < str.length) {
      unescapeStr(str.slice(start));
    }

    parts.qblocks = qblocks;

    return parts

    function unescapeStr (s) {
      if (prevStr) {
        s = prevStr + s;
        prevStr = '';
      }
      if (tmpl || isexpr) {
        parts.push(s && s.replace(_bp[5], '$1'));
      } else {
        parts.push(s);
      }
    }

    function pushQBlock(_pos, _lastIndex, slash) { //eslint-disable-line
      if (slash) {
        _lastIndex = skipRegex(str, _pos);
      }

      if (tmpl && _lastIndex > _pos + 2) {
        mark = '\u2057' + qblocks.length + '~';
        qblocks.push(str.slice(_pos, _lastIndex));
        prevStr += str.slice(start, _pos) + mark;
        start = _lastIndex;
      }
      return _lastIndex
    }
  };

  _brackets.hasExpr = function hasExpr (str) {
    return _cache[4].test(str)
  };

  _brackets.loopKeys = function loopKeys (expr) {
    var m = expr.match(_cache[9]);

    return m
      ? { key: m[1], pos: m[2], val: _cache[0] + m[3].trim() + _cache[1] }
      : { val: expr.trim() }
  };

  _brackets.array = function array (pair) {
    return pair ? _create(pair) : _cache
  };

  function _reset (pair) {
    if ((pair || (pair = DEFAULT)) !== _cache[8]) {
      _cache = _create(pair);
      _regex = pair === DEFAULT ? _loopback : _rewrite;
      _cache[9] = _regex(_pairs[9]);
    }
    cachedBrackets = pair;
  }

  function _setSettings (o) {
    var b;

    o = o || {};
    b = o.brackets;
    Object.defineProperty(o, 'brackets', {
      set: _reset,
      get: function () { return cachedBrackets },
      enumerable: true
    });
    _settings = o;
    _reset(b);
  }

  Object.defineProperty(_brackets, 'settings', {
    set: _setSettings,
    get: function () { return _settings }
  });

  /* istanbul ignore next: in the browser riot is always in the scope */
  _brackets.settings = typeof riot !== 'undefined' && riot.settings || {};
  _brackets.set = _reset;
  _brackets.skipRegex = skipRegex;

  _brackets.R_STRINGS = R_STRINGS;
  _brackets.R_MLCOMMS = R_MLCOMMS;
  _brackets.S_QBLOCKS = S_QBLOCKS;
  _brackets.S_QBLOCK2 = S_QBLOCK2;

  return _brackets

})();

/**
 * @module tmpl
 *
 * tmpl          - Root function, returns the template value, render with data
 * tmpl.hasExpr  - Test the existence of a expression inside a string
 * tmpl.loopKeys - Get the keys for an 'each' loop (used by `_each`)
 */

var tmpl = (function () {

  var _cache = {};

  function _tmpl (str, data) {
    if (!str) return str

    return (_cache[str] || (_cache[str] = _create(str))).call(
      data, _logErr.bind({
        data: data,
        tmpl: str
      })
    )
  }

  _tmpl.hasExpr = brackets.hasExpr;

  _tmpl.loopKeys = brackets.loopKeys;

  // istanbul ignore next
  _tmpl.clearCache = function () { _cache = {}; };

  _tmpl.errorHandler = null;

  function _logErr (err, ctx) {

    err.riotData = {
      tagName: ctx && ctx.__ && ctx.__.tagName,
      _riot_id: ctx && ctx._riot_id  //eslint-disable-line camelcase
    };

    if (_tmpl.errorHandler) _tmpl.errorHandler(err);
    else if (
      typeof console !== 'undefined' &&
      typeof console.error === 'function'
    ) {
      console.error(err.message);
      console.log('<%s> %s', err.riotData.tagName || 'Unknown tag', this.tmpl); // eslint-disable-line
      console.log(this.data); // eslint-disable-line
    }
  }

  function _create (str) {
    var expr = _getTmpl(str);

    if (expr.slice(0, 11) !== 'try{return ') expr = 'return ' + expr;

    return new Function('E', expr + ';')    // eslint-disable-line no-new-func
  }

  var RE_DQUOTE = /\u2057/g;
  var RE_QBMARK = /\u2057(\d+)~/g;

  function _getTmpl (str) {
    var parts = brackets.split(str.replace(RE_DQUOTE, '"'), 1);
    var qstr = parts.qblocks;
    var expr;

    if (parts.length > 2 || parts[0]) {
      var i, j, list = [];

      for (i = j = 0; i < parts.length; ++i) {

        expr = parts[i];

        if (expr && (expr = i & 1

            ? _parseExpr(expr, 1, qstr)

            : '"' + expr
                .replace(/\\/g, '\\\\')
                .replace(/\r\n?|\n/g, '\\n')
                .replace(/"/g, '\\"') +
              '"'

          )) list[j++] = expr;

      }

      expr = j < 2 ? list[0]
           : '[' + list.join(',') + '].join("")';

    } else {

      expr = _parseExpr(parts[1], 0, qstr);
    }

    if (qstr.length) {
      expr = expr.replace(RE_QBMARK, function (_, pos) {
        return qstr[pos]
          .replace(/\r/g, '\\r')
          .replace(/\n/g, '\\n')
      });
    }
    return expr
  }

  var RE_CSNAME = /^(?:(-?[_A-Za-z\xA0-\xFF][-\w\xA0-\xFF]*)|\u2057(\d+)~):/;
  var
    RE_BREND = {
      '(': /[()]/g,
      '[': /[[\]]/g,
      '{': /[{}]/g
    };

  function _parseExpr (expr, asText, qstr) {

    expr = expr
      .replace(/\s+/g, ' ').trim()
      .replace(/\ ?([[\({},?\.:])\ ?/g, '$1');

    if (expr) {
      var
        list = [],
        cnt = 0,
        match;

      while (expr &&
            (match = expr.match(RE_CSNAME)) &&
            !match.index
        ) {
        var
          key,
          jsb,
          re = /,|([[{(])|$/g;

        expr = RegExp.rightContext;
        key  = match[2] ? qstr[match[2]].slice(1, -1).trim().replace(/\s+/g, ' ') : match[1];

        while (jsb = (match = re.exec(expr))[1]) skipBraces(jsb, re);

        jsb  = expr.slice(0, match.index);
        expr = RegExp.rightContext;

        list[cnt++] = _wrapExpr(jsb, 1, key);
      }

      expr = !cnt ? _wrapExpr(expr, asText)
           : cnt > 1 ? '[' + list.join(',') + '].join(" ").trim()' : list[0];
    }
    return expr

    function skipBraces (ch, re) {
      var
        mm,
        lv = 1,
        ir = RE_BREND[ch];

      ir.lastIndex = re.lastIndex;
      while (mm = ir.exec(expr)) {
        if (mm[0] === ch) ++lv;
        else if (!--lv) break
      }
      re.lastIndex = lv ? expr.length : ir.lastIndex;
    }
  }

  // istanbul ignore next: not both
  var // eslint-disable-next-line max-len
    JS_CONTEXT = '"in this?this:' + (typeof window !== 'object' ? 'global' : 'window') + ').',
    JS_VARNAME = /[,{][\$\w]+(?=:)|(^ *|[^$\w\.{])(?!(?:typeof|true|false|null|undefined|in|instanceof|is(?:Finite|NaN)|void|NaN|new|Date|RegExp|Math)(?![$\w]))([$_A-Za-z][$\w]*)/g,
    JS_NOPROPS = /^(?=(\.[$\w]+))\1(?:[^.[(]|$)/;

  function _wrapExpr (expr, asText, key) {
    var tb;

    expr = expr.replace(JS_VARNAME, function (match, p, mvar, pos, s) {
      if (mvar) {
        pos = tb ? 0 : pos + match.length;

        if (mvar !== 'this' && mvar !== 'global' && mvar !== 'window') {
          match = p + '("' + mvar + JS_CONTEXT + mvar;
          if (pos) tb = (s = s[pos]) === '.' || s === '(' || s === '[';
        } else if (pos) {
          tb = !JS_NOPROPS.test(s.slice(pos));
        }
      }
      return match
    });

    if (tb) {
      expr = 'try{return ' + expr + '}catch(e){E(e,this)}';
    }

    if (key) {

      expr = (tb
          ? 'function(){' + expr + '}.call(this)' : '(' + expr + ')'
        ) + '?"' + key + '":""';

    } else if (asText) {

      expr = 'function(v){' + (tb
          ? expr.replace('return ', 'v=') : 'v=(' + expr + ')'
        ) + ';return v||v===0?v:""}.call(this)';
    }

    return expr
  }

  _tmpl.version = brackets.version = 'v3.0.8';

  return _tmpl

})();

var observable = function(el) {

  /**
   * Extend the original object or create a new empty one
   * @type { Object }
   */

  el = el || {};

  /**
   * Private variables
   */
  var callbacks = {},
    slice = Array.prototype.slice;

  /**
   * Public Api
   */

  // extend the el object adding the observable methods
  Object.defineProperties(el, {
    /**
     * Listen to the given `event` ands
     * execute the `callback` each time an event is triggered.
     * @param  { String } event - event id
     * @param  { Function } fn - callback function
     * @returns { Object } el
     */
    on: {
      value: function(event, fn) {
        if (typeof fn == 'function')
          (callbacks[event] = callbacks[event] || []).push(fn);
        return el
      },
      enumerable: false,
      writable: false,
      configurable: false
    },

    /**
     * Removes the given `event` listeners
     * @param   { String } event - event id
     * @param   { Function } fn - callback function
     * @returns { Object } el
     */
    off: {
      value: function(event, fn) {
        if (event == '*' && !fn) callbacks = {};
        else {
          if (fn) {
            var arr = callbacks[event];
            for (var i = 0, cb; cb = arr && arr[i]; ++i) {
              if (cb == fn) arr.splice(i--, 1);
            }
          } else delete callbacks[event];
        }
        return el
      },
      enumerable: false,
      writable: false,
      configurable: false
    },

    /**
     * Listen to the given `event` and
     * execute the `callback` at most once
     * @param   { String } event - event id
     * @param   { Function } fn - callback function
     * @returns { Object } el
     */
    one: {
      value: function(event, fn) {
        function on() {
          el.off(event, on);
          fn.apply(el, arguments);
        }
        return el.on(event, on)
      },
      enumerable: false,
      writable: false,
      configurable: false
    },

    /**
     * Execute all callback functions that listen to
     * the given `event`
     * @param   { String } event - event id
     * @returns { Object } el
     */
    trigger: {
      value: function(event) {

        // getting the arguments
        var arglen = arguments.length - 1,
          args = new Array(arglen),
          fns,
          fn,
          i;

        for (i = 0; i < arglen; i++) {
          args[i] = arguments[i + 1]; // skip first argument
        }

        fns = slice.call(callbacks[event] || [], 0);

        for (i = 0; fn = fns[i]; ++i) {
          fn.apply(el, args);
        }

        if (callbacks['*'] && event != '*')
          el.trigger.apply(el, ['*', event].concat(args));

        return el
      },
      enumerable: false,
      writable: false,
      configurable: false
    }
  });

  return el

};

/**
 * Short alias for Object.getOwnPropertyDescriptor
 */
function getPropDescriptor (o, k) {
  return Object.getOwnPropertyDescriptor(o, k)
}

/**
 * Check if passed argument is undefined
 * @param   { * } value -
 * @returns { Boolean } -
 */
function isUndefined(value) {
  return typeof value === T_UNDEF
}

/**
 * Check whether object's property could be overridden
 * @param   { Object }  obj - source object
 * @param   { String }  key - object property
 * @returns { Boolean } true if writable
 */
function isWritable(obj, key) {
  const descriptor = getPropDescriptor(obj, key);
  return isUndefined(obj[key]) || descriptor && descriptor.writable
}

/**
 * Extend any object with other properties
 * @param   { Object } src - source object
 * @returns { Object } the resulting extended object
 *
 * var obj = { foo: 'baz' }
 * extend(obj, {bar: 'bar', foo: 'bar'})
 * console.log(obj) => {bar: 'bar', foo: 'bar'}
 *
 */
function extend(src) {
  let obj;
  let i = 1;
  const args = arguments;
  const l = args.length;

  for (; i < l; i++) {
    if (obj = args[i]) {
      for (const key in obj) {
        // check if this property of the source object could be overridden
        if (isWritable(src, key))
          src[key] = obj[key];
      }
    }
  }
  return src
}

/**
 * Alias for Object.create
 */
function create(src) {
  return Object.create(src)
}

var settings = extend(create(brackets.settings), {
  skipAnonymousTags: true,
  // handle the auto updates on any DOM event
  autoUpdate: true
});

/**
 * Shorter and fast way to select multiple nodes in the DOM
 * @param   { String } selector - DOM selector
 * @param   { Object } ctx - DOM node where the targets of our search will is located
 * @returns { Object } dom nodes found
 */
function $$(selector, ctx) {
  return [].slice.call((ctx || document).querySelectorAll(selector))
}

/**
 * Create a document text node
 * @returns { Object } create a text node to use as placeholder
 */
function createDOMPlaceholder() {
  return document.createTextNode('')
}

/**
 * Toggle the visibility of any DOM node
 * @param   { Object }  dom - DOM node we want to hide
 * @param   { Boolean } show - do we want to show it?
 */

function toggleVisibility(dom, show) {
  dom.style.display = show ? '' : 'none';
  dom.hidden = show ? false : true;
}

/**
 * Get the value of any DOM attribute on a node
 * @param   { Object } dom - DOM node we want to parse
 * @param   { String } name - name of the attribute we want to get
 * @returns { String | undefined } name of the node attribute whether it exists
 */
function getAttribute(dom, name) {
  return dom.getAttribute(name)
}

/**
 * Remove any DOM attribute from a node
 * @param   { Object } dom - DOM node we want to update
 * @param   { String } name - name of the property we want to remove
 */
function removeAttribute(dom, name) {
  dom.removeAttribute(name);
}

/**
 * Set the inner html of any DOM node SVGs included
 * @param { Object } container - DOM node where we'll inject new html
 * @param { String } html - html to inject
 * @param { Boolean } isSvg - svg tags should be treated a bit differently
 */
/* istanbul ignore next */
function setInnerHTML(container, html, isSvg) {
  // innerHTML is not supported on svg tags so we neet to treat them differently
  if (isSvg) {
    const node = container.ownerDocument.importNode(
      new DOMParser()
        .parseFromString(`<svg xmlns="${ SVG_NS }">${ html }</svg>`, 'application/xml')
        .documentElement,
      true
    );

    container.appendChild(node);
  } else {
    container.innerHTML = html;
  }
}

/**
 * Minimize risk: only zero or one _space_ between attr & value
 * @param   { String }   html - html string we want to parse
 * @param   { Function } fn - callback function to apply on any attribute found
 */
function walkAttributes(html, fn) {
  if (!html) return
  let m;
  while (m = RE_HTML_ATTRS.exec(html))
    fn(m[1].toLowerCase(), m[2] || m[3] || m[4]);
}

/**
 * Create a document fragment
 * @returns { Object } document fragment
 */
function createFragment() {
  return document.createDocumentFragment()
}

/**
 * Insert safely a tag to fix #1962 #1649
 * @param   { HTMLElement } root - children container
 * @param   { HTMLElement } curr - node to insert
 * @param   { HTMLElement } next - node that should preceed the current node inserted
 */
function safeInsert(root, curr, next) {
  root.insertBefore(curr, next.parentNode && next);
}

/**
 * Convert a style object to a string
 * @param   { Object } style - style object we need to parse
 * @returns { String } resulting css string
 * @example
 * styleObjectToString({ color: 'red', height: '10px'}) // => 'color: red; height: 10px'
 */
function styleObjectToString(style) {
  return Object.keys(style).reduce((acc, prop) => {
    return `${acc} ${prop}: ${style[prop]};`
  }, '')
}

/**
 * Walk down recursively all the children tags starting dom node
 * @param   { Object }   dom - starting node where we will start the recursion
 * @param   { Function } fn - callback to transform the child node just found
 * @param   { Object }   context - fn can optionally return an object, which is passed to children
 */
function walkNodes(dom, fn, context) {
  if (dom) {
    const res = fn(dom, context);
    let next;
    // stop the recursion
    if (res === false) return

    dom = dom.firstChild;

    while (dom) {
      next = dom.nextSibling;
      walkNodes(dom, fn, res);
      dom = next;
    }
  }
}



var dom = /*#__PURE__*/Object.freeze({
  $$: $$,
  $: $,
  createDOMPlaceholder: createDOMPlaceholder,
  mkEl: makeElement,
  setAttr: setAttribute,
  toggleVisibility: toggleVisibility,
  getAttr: getAttribute,
  remAttr: removeAttribute,
  setInnerHTML: setInnerHTML,
  walkAttrs: walkAttributes,
  createFrag: createFragment,
  safeInsert: safeInsert,
  styleObjectToString: styleObjectToString,
  walkNodes: walkNodes
});

/**
 * Check against the null and undefined values
 * @param   { * }  value -
 * @returns {Boolean} -
 */
function isNil(value) {
  return isUndefined(value) || value === null
}

/**
 * Check if passed argument is empty. Different from falsy, because we dont consider 0 or false to be blank
 * @param { * } value -
 * @returns { Boolean } -
 */
function isBlank(value) {
  return isNil(value) || value === ''
}

/**
 * Check if passed argument is a function
 * @param   { * } value -
 * @returns { Boolean } -
 */
function isFunction(value) {
  return typeof value === T_FUNCTION
}

/**
 * Check if passed argument is an object, exclude null
 * NOTE: use isObject(x) && !isArray(x) to excludes arrays.
 * @param   { * } value -
 * @returns { Boolean } -
 */
function isObject(value) {
  return value && typeof value === T_OBJECT // typeof null is 'object'
}

/**
 * Check if a DOM node is an svg tag or part of an svg
 * @param   { HTMLElement }  el - node we want to test
 * @returns {Boolean} true if it's an svg node
 */
function isSvg(el) {
  const owner = el.ownerSVGElement;
  return !!owner || owner === null
}

/**
 * Check if passed argument is a kind of array
 * @param   { * } value -
 * @returns { Boolean } -
 */
function isArray(value) {
  return Array.isArray(value) || value instanceof Array
}

/**
 * Check if the passed argument is a boolean attribute
 * @param   { String } value -
 * @returns { Boolean } -
 */
function isBoolAttr(value) {
  return RE_BOOL_ATTRS.test(value)
}

/**
 * Check if passed argument is a string
 * @param   { * } value -
 * @returns { Boolean } -
 */
function isString(value) {
  return typeof value === T_STRING
}



var check = /*#__PURE__*/Object.freeze({
  isBlank: isBlank,
  isFunction: isFunction,
  isObject: isObject,
  isSvg: isSvg,
  isWritable: isWritable,
  isArray: isArray,
  isBoolAttr: isBoolAttr,
  isNil: isNil,
  isString: isString,
  isUndefined: isUndefined
});

/**
 * Check whether an array contains an item
 * @param   { Array } array - target array
 * @param   { * } item - item to test
 * @returns { Boolean } -
 */
function contains(array, item) {
  return array.indexOf(item) !== -1
}

/**
 * Specialized function for looping an array-like collection with `each={}`
 * @param   { Array } list - collection of items
 * @param   {Function} fn - callback function
 * @returns { Array } the array looped
 */
function each(list, fn) {
  const len = list ? list.length : 0;
  let i = 0;
  for (; i < len; i++) fn(list[i], i);
  return list
}

/**
 * Faster String startsWith alternative
 * @param   { String } str - source string
 * @param   { String } value - test string
 * @returns { Boolean } -
 */
function startsWith(str, value) {
  return str.slice(0, value.length) === value
}

/**
 * Function returning always a unique identifier
 * @returns { Number } - number from 0...n
 */
var uid = (function uid() {
  let i = -1;
  return () => ++i
})();

/**
 * Helper function to set an immutable property
 * @param   { Object } el - object where the new property will be set
 * @param   { String } key - object key where the new property will be stored
 * @param   { * } value - value of the new property
 * @param   { Object } options - set the propery overriding the default options
 * @returns { Object } - the initial object
 */
function define(el, key, value, options) {
  Object.defineProperty(el, key, extend({
    value,
    enumerable: false,
    writable: false,
    configurable: true
  }, options));
  return el
}

/**
 * Convert a string containing dashes to camel case
 * @param   { String } str - input string
 * @returns { String } my-string -> myString
 */
function toCamel(str) {
  return str.replace(/-(\w)/g, (_, c) => c.toUpperCase())
}

/**
 * Warn a message via console
 * @param   {String} message - warning message
 */
function warn(message) {
  if (console && console.warn) console.warn(message);
}



var misc = /*#__PURE__*/Object.freeze({
  contains: contains,
  each: each,
  getPropDescriptor: getPropDescriptor,
  startsWith: startsWith,
  uid: uid,
  defineProperty: define,
  objectCreate: create,
  extend: extend,
  toCamel: toCamel,
  warn: warn
});

/**
 * Set the property of an object for a given key. If something already
 * exists there, then it becomes an array containing both the old and new value.
 * @param { Object } obj - object on which to set the property
 * @param { String } key - property name
 * @param { Object } value - the value of the property to be set
 * @param { Boolean } ensureArray - ensure that the property remains an array
 * @param { Number } index - add the new item in a certain array position
 */
function arrayishAdd(obj, key, value, ensureArray, index) {
  const dest = obj[key];
  const isArr = isArray(dest);
  const hasIndex = !isUndefined(index);

  if (dest && dest === value) return

  // if the key was never set, set it once
  if (!dest && ensureArray) obj[key] = [value];
  else if (!dest) obj[key] = value;
  // if it was an array and not yet set
  else {
    if (isArr) {
      const oldIndex = dest.indexOf(value);
      // this item never changed its position
      if (oldIndex === index) return
      // remove the item from its old position
      if (oldIndex !== -1) dest.splice(oldIndex, 1);
      // move or add the item
      if (hasIndex) {
        dest.splice(index, 0, value);
      } else {
        dest.push(value);
      }
    } else obj[key] = [dest, value];
  }
}

/**
 * Detect the tag implementation by a DOM node
 * @param   { Object } dom - DOM node we need to parse to get its tag implementation
 * @returns { Object } it returns an object containing the implementation of a custom tag (template and boot function)
 */
function get(dom) {
  return dom.tagName && __TAG_IMPL[getAttribute(dom, IS_DIRECTIVE) ||
    getAttribute(dom, IS_DIRECTIVE) || dom.tagName.toLowerCase()]
}

/**
 * Get the tag name of any DOM node
 * @param   { Object } dom - DOM node we want to parse
 * @param   { Boolean } skipDataIs - hack to ignore the data-is attribute when attaching to parent
 * @returns { String } name to identify this dom node in riot
 */
function getName(dom, skipDataIs) {
  const child = get(dom);
  const namedTag = !skipDataIs && getAttribute(dom, IS_DIRECTIVE);
  return namedTag && !tmpl.hasExpr(namedTag) ?
    namedTag : child ? child.name : dom.tagName.toLowerCase()
}

/**
 * Return a temporary context containing also the parent properties
 * @this Tag
 * @param { Tag } - temporary tag context containing all the parent properties
 */
function inheritParentProps() {
  if (this.parent) return extend(create(this), this.parent)
  return this
}

/*
  Includes hacks needed for the Internet Explorer version 9 and below
  See: http://kangax.github.io/compat-table/es5/#ie8
       http://codeplanet.io/dropping-ie8/
*/

const
  reHasYield  = /<yield\b/i,
  reYieldAll  = /<yield\s*(?:\/>|>([\S\s]*?)<\/yield\s*>|>)/ig,
  reYieldSrc  = /<yield\s+to=['"]([^'">]*)['"]\s*>([\S\s]*?)<\/yield\s*>/ig,
  reYieldDest = /<yield\s+from=['"]?([-\w]+)['"]?\s*(?:\/>|>([\S\s]*?)<\/yield\s*>)/ig,
  rootEls = { tr: 'tbody', th: 'tr', td: 'tr', col: 'colgroup' },
  tblTags = IE_VERSION && IE_VERSION < 10 ? RE_SPECIAL_TAGS : RE_SPECIAL_TAGS_NO_OPTION,
  GENERIC = 'div',
  SVG = 'svg';


/*
  Creates the root element for table or select child elements:
  tr/th/td/thead/tfoot/tbody/caption/col/colgroup/option/optgroup
*/
function specialTags(el, tmpl, tagName) {

  let
    select = tagName[0] === 'o',
    parent = select ? 'select>' : 'table>';

  // trim() is important here, this ensures we don't have artifacts,
  // so we can check if we have only one element inside the parent
  el.innerHTML = '<' + parent + tmpl.trim() + '</' + parent;
  parent = el.firstChild;

  // returns the immediate parent if tr/th/td/col is the only element, if not
  // returns the whole tree, as this can include additional elements
  /* istanbul ignore next */
  if (select) {
    parent.selectedIndex = -1;  // for IE9, compatible w/current riot behavior
  } else {
    // avoids insertion of cointainer inside container (ex: tbody inside tbody)
    const tname = rootEls[tagName];
    if (tname && parent.childElementCount === 1) parent = $(tname, parent);
  }
  return parent
}

/*
  Replace the yield tag from any tag template with the innerHTML of the
  original tag in the page
*/
function replaceYield(tmpl, html) {
  // do nothing if no yield
  if (!reHasYield.test(tmpl)) return tmpl

  // be careful with #1343 - string on the source having `$1`
  const src = {};

  html = html && html.replace(reYieldSrc, function (_, ref, text) {
    src[ref] = src[ref] || text;   // preserve first definition
    return ''
  }).trim();

  return tmpl
    .replace(reYieldDest, function (_, ref, def) {  // yield with from - to attrs
      return src[ref] || def || ''
    })
    .replace(reYieldAll, function (_, def) {        // yield without any "from"
      return html || def || ''
    })
}

/**
 * Creates a DOM element to wrap the given content. Normally an `DIV`, but can be
 * also a `TABLE`, `SELECT`, `TBODY`, `TR`, or `COLGROUP` element.
 *
 * @param   { String } tmpl  - The template coming from the custom tag definition
 * @param   { String } html - HTML content that comes from the DOM element where you
 *           will mount the tag, mostly the original tag in the page
 * @param   { Boolean } isSvg - true if the root node is an svg
 * @returns { HTMLElement } DOM element with _tmpl_ merged through `YIELD` with the _html_.
 */
function mkdom(tmpl, html, isSvg) {
  const match   = tmpl && tmpl.match(/^\s*<([-\w]+)/);
  const  tagName = match && match[1].toLowerCase();
  let el = makeElement(isSvg ? SVG : GENERIC);

  // replace all the yield tags with the tag inner html
  tmpl = replaceYield(tmpl, html);

  /* istanbul ignore next */
  if (tblTags.test(tagName))
    el = specialTags(el, tmpl, tagName);
  else
    setInnerHTML(el, tmpl, isSvg);

  return el
}

const EVENT_ATTR_RE = /^on/;

/**
 * True if the event attribute starts with 'on'
 * @param   { String } attribute - event attribute
 * @returns { Boolean }
 */
function isEventAttribute(attribute) {
  return EVENT_ATTR_RE.test(attribute)
}

/**
 * Loop backward all the parents tree to detect the first custom parent tag
 * @param   { Object } tag - a Tag instance
 * @returns { Object } the instance of the first custom parent tag found
 */
function getImmediateCustomParent(tag) {
  let ptag = tag;
  while (ptag.__.isAnonymous) {
    if (!ptag.parent) break
    ptag = ptag.parent;
  }
  return ptag
}

/**
 * Trigger DOM events
 * @param   { HTMLElement } dom - dom element target of the event
 * @param   { Function } handler - user function
 * @param   { Object } e - event object
 */
function handleEvent(dom, handler, e) {
  let ptag = this.__.parent;
  let item = this.__.item;

  if (!item)
    while (ptag && !item) {
      item = ptag.__.item;
      ptag = ptag.__.parent;
    }

  // override the event properties
  /* istanbul ignore next */
  if (isWritable(e, 'currentTarget')) e.currentTarget = dom;
  /* istanbul ignore next */
  if (isWritable(e, 'target')) e.target = e.srcElement;
  /* istanbul ignore next */
  if (isWritable(e, 'which')) e.which = e.charCode || e.keyCode;

  e.item = item;

  handler.call(this, e);

  // avoid auto updates
  if (!settings.autoUpdate) return

  if (!e.preventUpdate) {
    const p = getImmediateCustomParent(this);
    // fixes #2083
    if (p.isMounted) p.update();
  }
}

/**
 * Attach an event to a DOM node
 * @param { String } name - event name
 * @param { Function } handler - event callback
 * @param { Object } dom - dom node
 * @param { Tag } tag - tag instance
 */
function setEventHandler(name, handler, dom, tag) {
  let eventName;
  const cb = handleEvent.bind(tag, dom, handler);

  // avoid to bind twice the same event
  // possible fix for #2332
  dom[name] = null;

  // normalize event name
  eventName = name.replace(RE_EVENTS_PREFIX, '');

  // cache the listener into the listeners array
  if (!contains(tag.__.listeners, dom)) tag.__.listeners.push(dom);
  if (!dom[RIOT_EVENTS_KEY]) dom[RIOT_EVENTS_KEY] = {};
  if (dom[RIOT_EVENTS_KEY][name]) dom.removeEventListener(eventName, dom[RIOT_EVENTS_KEY][name]);

  dom[RIOT_EVENTS_KEY][name] = cb;
  dom.addEventListener(eventName, cb, false);
}

/**
 * Create a new child tag including it correctly into its parent
 * @param   { Object } child - child tag implementation
 * @param   { Object } opts - tag options containing the DOM node where the tag will be mounted
 * @param   { String } innerHTML - inner html of the child node
 * @param   { Object } parent - instance of the parent tag including the child custom tag
 * @returns { Object } instance of the new child tag just created
 */
function initChild(child, opts, innerHTML, parent) {
  const tag = createTag(child, opts, innerHTML);
  const tagName = opts.tagName || getName(opts.root, true);
  const ptag = getImmediateCustomParent(parent);
  // fix for the parent attribute in the looped elements
  define(tag, 'parent', ptag);
  // store the real parent tag
  // in some cases this could be different from the custom parent tag
  // for example in nested loops
  tag.__.parent = parent;

  // add this tag to the custom parent tag
  arrayishAdd(ptag.tags, tagName, tag);

  // and also to the real parent tag
  if (ptag !== parent)
    arrayishAdd(parent.tags, tagName, tag);

  return tag
}

/**
 * Removes an item from an object at a given key. If the key points to an array,
 * then the item is just removed from the array.
 * @param { Object } obj - object on which to remove the property
 * @param { String } key - property name
 * @param { Object } value - the value of the property to be removed
 * @param { Boolean } ensureArray - ensure that the property remains an array
*/
function arrayishRemove(obj, key, value, ensureArray) {
  if (isArray(obj[key])) {
    let index = obj[key].indexOf(value);
    if (index !== -1) obj[key].splice(index, 1);
    if (!obj[key].length) delete obj[key];
    else if (obj[key].length === 1 && !ensureArray) obj[key] = obj[key][0];
  } else if (obj[key] === value)
    delete obj[key]; // otherwise just delete the key
}

/**
 * Adds the elements for a virtual tag
 * @this Tag
 * @param { Node } src - the node that will do the inserting or appending
 * @param { Tag } target - only if inserting, insert before this tag's first child
 */
function makeVirtual(src, target) {
  const head = createDOMPlaceholder();
  const tail = createDOMPlaceholder();
  const frag = createFragment();
  let sib;
  let el;

  this.root.insertBefore(head, this.root.firstChild);
  this.root.appendChild(tail);

  this.__.head = el = head;
  this.__.tail = tail;

  while (el) {
    sib = el.nextSibling;
    frag.appendChild(el);
    this.__.virts.push(el); // hold for unmounting
    el = sib;
  }

  if (target)
    src.insertBefore(frag, target.__.head);
  else
    src.appendChild(frag);
}

/**
 * makes a tag virtual and replaces a reference in the dom
 * @this Tag
 * @param { tag } the tag to make virtual
 * @param { ref } the dom reference location
 */
function makeReplaceVirtual(tag, ref) {
  const frag = createFragment();
  makeVirtual.call(tag, frag);
  ref.parentNode.replaceChild(frag, ref);
}

/**
 * Update dynamically created data-is tags with changing expressions
 * @param { Object } expr - expression tag and expression info
 * @param { Tag }    parent - parent for tag creation
 * @param { String } tagName - tag implementation we want to use
 */
function updateDataIs(expr, parent, tagName) {
  let tag = expr.tag || expr.dom._tag;
  let ref;

  const { head } = tag ? tag.__ : {};
  const isVirtual = expr.dom.tagName === 'VIRTUAL';

  if (tag && expr.tagName === tagName) {
    tag.update();
    return
  }

  // sync _parent to accommodate changing tagnames
  if (tag) {
    // need placeholder before unmount
    if(isVirtual) {
      ref = createDOMPlaceholder();
      head.parentNode.insertBefore(ref, head);
    }

    tag.unmount(true);
  }

  // unable to get the tag name
  if (!isString(tagName)) return

  expr.impl = __TAG_IMPL[tagName];

  // unknown implementation
  if (!expr.impl) return

  expr.tag = tag = initChild(
    expr.impl, {
      root: expr.dom,
      parent,
      tagName
    },
    expr.dom.innerHTML,
    parent
  );

  each(expr.attrs, a => setAttribute(tag.root, a.name, a.value));
  expr.tagName = tagName;
  tag.mount();

  // root exist first time, after use placeholder
  if (isVirtual) makeReplaceVirtual(tag, ref || tag.root);

  // parent is the placeholder tag, not the dynamic tag so clean up
  parent.__.onUnmount = () => {
    const delName = tag.opts.dataIs;
    arrayishRemove(tag.parent.tags, delName, tag);
    arrayishRemove(tag.__.parent.tags, delName, tag);
    tag.unmount();
  };
}

/**
 * Nomalize any attribute removing the "riot-" prefix
 * @param   { String } attrName - original attribute name
 * @returns { String } valid html attribute name
 */
function normalizeAttrName(attrName) {
  if (!attrName) return null
  attrName = attrName.replace(ATTRS_PREFIX, '');
  if (CASE_SENSITIVE_ATTRIBUTES[attrName]) attrName = CASE_SENSITIVE_ATTRIBUTES[attrName];
  return attrName
}

/**
 * Update on single tag expression
 * @this Tag
 * @param { Object } expr - expression logic
 * @returns { undefined }
 */
function updateExpression(expr) {
  if (this.root && getAttribute(this.root,'virtualized')) return

  const dom = expr.dom;
  // remove the riot- prefix
  const attrName = normalizeAttrName(expr.attr);
  const isToggle = contains([SHOW_DIRECTIVE, HIDE_DIRECTIVE], attrName);
  const isVirtual = expr.root && expr.root.tagName === 'VIRTUAL';
  const { isAnonymous } = this.__;
  const parent = dom && (expr.parent || dom.parentNode);
  // detect the style attributes
  const isStyleAttr = attrName === 'style';
  const isClassAttr = attrName === 'class';

  let value;

  // if it's a tag we could totally skip the rest
  if (expr._riot_id) {
    if (expr.__.wasCreated) {
      expr.update();
    // if it hasn't been mounted yet, do that now.
    } else {
      expr.mount();
      if (isVirtual) {
        makeReplaceVirtual(expr, expr.root);
      }
    }
    return
  }

  // if this expression has the update method it means it can handle the DOM changes by itself
  if (expr.update) return expr.update()

  const context = isToggle && !isAnonymous ? inheritParentProps.call(this) : this;

  // ...it seems to be a simple expression so we try to calculate its value
  value = tmpl(expr.expr, context);

  const hasValue = !isBlank(value);
  const isObj = isObject(value);

  // convert the style/class objects to strings
  if (isObj) {
    if (isClassAttr) {
      value = tmpl(JSON.stringify(value), this);
    } else if (isStyleAttr) {
      value = styleObjectToString(value);
    }
  }

  // remove original attribute
  if (expr.attr && (!expr.wasParsedOnce || !hasValue || value === false)) {
    // remove either riot-* attributes or just the attribute name
    removeAttribute(dom, getAttribute(dom, expr.attr) ? expr.attr : attrName);
  }

  // for the boolean attributes we don't need the value
  // we can convert it to checked=true to checked=checked
  if (expr.bool) value = value ? attrName : false;
  if (expr.isRtag) return updateDataIs(expr, this, value)
  if (expr.wasParsedOnce && expr.value === value) return

  // update the expression value
  expr.value = value;
  expr.wasParsedOnce = true;

  // if the value is an object (and it's not a style or class attribute) we can not do much more with it
  if (isObj && !isClassAttr && !isStyleAttr && !isToggle) return
  // avoid to render undefined/null values
  if (!hasValue) value = '';

  // textarea and text nodes have no attribute name
  if (!attrName) {
    // about #815 w/o replace: the browser converts the value to a string,
    // the comparison by "==" does too, but not in the server
    value += '';
    // test for parent avoids error with invalid assignment to nodeValue
    if (parent) {
      // cache the parent node because somehow it will become null on IE
      // on the next iteration
      expr.parent = parent;
      if (parent.tagName === 'TEXTAREA') {
        parent.value = value;                    // #1113
        if (!IE_VERSION) dom.nodeValue = value;  // #1625 IE throws here, nodeValue
      }                                         // will be available on 'updated'
      else dom.nodeValue = value;
    }
    return
  }

  switch (true) {
  // handle events binding
  case isFunction(value):
    if (isEventAttribute(attrName)) {
      setEventHandler(attrName, value, dom, this);
    }
    break
  // show / hide
  case isToggle:
    toggleVisibility(dom, attrName === HIDE_DIRECTIVE ? !value : value);
    break
  // handle attributes
  default:
    if (expr.bool) {
      dom[attrName] = value;
    }

    if (attrName === 'value' && dom.value !== value) {
      dom.value = value;
    } else if (hasValue && value !== false) {
      setAttribute(dom, attrName, value);
    }

    // make sure that in case of style changes
    // the element stays hidden
    if (isStyleAttr && dom.hidden) toggleVisibility(dom, false);
  }
}

/**
 * Update all the expressions in a Tag instance
 * @this Tag
 * @param { Array } expressions - expression that must be re evaluated
 */
function update(expressions) {
  each(expressions, updateExpression.bind(this));
}

/**
 * We need to update opts for this tag. That requires updating the expressions
 * in any attributes on the tag, and then copying the result onto opts.
 * @this Tag
 * @param   {Boolean} isLoop - is it a loop tag?
 * @param   { Tag }  parent - parent tag node
 * @param   { Boolean }  isAnonymous - is it a tag without any impl? (a tag not registered)
 * @param   { Object }  opts - tag options
 * @param   { Array }  instAttrs - tag attributes array
 */
function updateOpts(isLoop, parent, isAnonymous, opts, instAttrs) {
  // isAnonymous `each` tags treat `dom` and `root` differently. In this case
  // (and only this case) we don't need to do updateOpts, because the regular parse
  // will update those attrs. Plus, isAnonymous tags don't need opts anyway
  if (isLoop && isAnonymous) return
  const ctx = isLoop ? inheritParentProps.call(this) : parent || this;

  each(instAttrs, (attr) => {
    if (attr.expr) updateExpression.call(ctx, attr.expr);
    // normalize the attribute names
    opts[toCamel(attr.name).replace(ATTRS_PREFIX, '')] = attr.expr ? attr.expr.value : attr.value;
  });
}

/**
 * Update the tag expressions and options
 * @param { Tag } tag - tag object
 * @param { * } data - data we want to use to extend the tag properties
 * @param { Array } expressions - component expressions array
 * @returns { Tag } the current tag instance
 */
function componentUpdate(tag, data, expressions) {
  const __ = tag.__;
  const nextOpts = {};
  const canTrigger = tag.isMounted && !__.skipAnonymous;

  // inherit properties from the parent tag
  if (__.isAnonymous && __.parent) extend(tag, __.parent);
  extend(tag, data);

  updateOpts.apply(tag, [__.isLoop, __.parent, __.isAnonymous, nextOpts, __.instAttrs]);

  if (
    canTrigger &&
    tag.isMounted &&
    isFunction(tag.shouldUpdate) && !tag.shouldUpdate(data, nextOpts)
  ) {
    return tag
  }

  extend(tag.opts, nextOpts);

  if (canTrigger) tag.trigger('update', data);
  update.call(tag, expressions);
  if (canTrigger) tag.trigger('updated');

  return tag
}

/**
 * Get selectors for tags
 * @param   { Array } tags - tag names to select
 * @returns { String } selector
 */
function query(tags) {
  // select all tags
  if (!tags) {
    const keys = Object.keys(__TAG_IMPL);
    return keys + query(keys)
  }

  return tags
    .filter(t => !/[^-\w]/.test(t))
    .reduce((list, t) => {
      const name = t.trim().toLowerCase();
      return list + `,[${IS_DIRECTIVE}="${name}"]`
    }, '')
}

/**
 * Another way to create a riot tag a bit more es6 friendly
 * @param { HTMLElement } el - tag DOM selector or DOM node/s
 * @param { Object } opts - tag logic
 * @returns { Tag } new riot tag instance
 */
function Tag(el, opts) {
  // get the tag properties from the class constructor
  const {name, tmpl, css, attrs, onCreate} = this;
  // register a new tag and cache the class prototype
  if (!__TAG_IMPL[name]) {
    tag(name, tmpl, css, attrs, onCreate);
    // cache the class constructor
    __TAG_IMPL[name].class = this.constructor;
  }

  // mount the tag using the class instance
  mount$1(el, name, opts, this);
  // inject the component css
  if (css) styleManager.inject();

  return this
}

/**
 * Create a new riot tag implementation
 * @param   { String }   name - name/id of the new riot tag
 * @param   { String }   tmpl - tag template
 * @param   { String }   css - custom tag css
 * @param   { String }   attrs - root tag attributes
 * @param   { Function } fn - user function
 * @returns { String } name/id of the tag just created
 */
function tag(name, tmpl, css, attrs, fn) {
  if (isFunction(attrs)) {
    fn = attrs;

    if (/^[\w-]+\s?=/.test(css)) {
      attrs = css;
      css = '';
    } else
      attrs = '';
  }

  if (css) {
    if (isFunction(css))
      fn = css;
    else
      styleManager.add(css, name);
  }

  name = name.toLowerCase();
  __TAG_IMPL[name] = { name, tmpl, attrs, fn };

  return name
}

/**
 * Create a new riot tag implementation (for use by the compiler)
 * @param   { String }   name - name/id of the new riot tag
 * @param   { String }   tmpl - tag template
 * @param   { String }   css - custom tag css
 * @param   { String }   attrs - root tag attributes
 * @param   { Function } fn - user function
 * @returns { String } name/id of the tag just created
 */
function tag2(name, tmpl, css, attrs, fn) {
  if (css) styleManager.add(css, name);

  __TAG_IMPL[name] = { name, tmpl, attrs, fn };

  return name
}

/**
 * Mount a tag using a specific tag implementation
 * @param   { * } selector - tag DOM selector or DOM node/s
 * @param   { String } tagName - tag implementation name
 * @param   { Object } opts - tag logic
 * @returns { Array } new tags instances
 */
function mount(selector, tagName, opts) {
  const tags = [];
  let elem, allTags;

  function pushTagsTo(root) {
    if (root.tagName) {
      let riotTag = getAttribute(root, IS_DIRECTIVE), tag;

      // have tagName? force riot-tag to be the same
      if (tagName && riotTag !== tagName) {
        riotTag = tagName;
        setAttribute(root, IS_DIRECTIVE, tagName);
      }

      tag = mount$1(root, riotTag || root.tagName.toLowerCase(), opts);

      if (tag)
        tags.push(tag);
    } else if (root.length)
      each(root, pushTagsTo); // assume nodeList
  }

  // inject styles into DOM
  styleManager.inject();

  if (isObject(tagName)) {
    opts = tagName;
    tagName = 0;
  }

  // crawl the DOM to find the tag
  if (isString(selector)) {
    selector = selector === '*' ?
      // select all registered tags
      // & tags found with the riot-tag attribute set
      allTags = query() :
      // or just the ones named like the selector
      selector + query(selector.split(/, */));

    // make sure to pass always a selector
    // to the querySelectorAll function
    elem = selector ? $$(selector) : [];
  }
  else
    // probably you have passed already a tag or a NodeList
    elem = selector;

  // select all the registered and mount them inside their root elements
  if (tagName === '*') {
    // get all custom tags
    tagName = allTags || query();
    // if the root els it's just a single tag
    if (elem.tagName)
      elem = $$(tagName, elem);
    else {
      // select all the children for all the different root elements
      var nodeList = [];

      each(elem, _el => nodeList.push($$(tagName, _el)));

      elem = nodeList;
    }
    // get rid of the tagName
    tagName = 0;
  }

  pushTagsTo(elem);

  return tags
}

// Create a mixin that could be globally shared across all the tags
const mixins = {};
const globals = mixins[GLOBAL_MIXIN] = {};
let mixins_id = 0;

/**
 * Create/Return a mixin by its name
 * @param   { String }  name - mixin name (global mixin if object)
 * @param   { Object }  mix - mixin logic
 * @param   { Boolean } g - is global?
 * @returns { Object }  the mixin logic
 */
function mixin(name, mix, g) {
  // Unnamed global
  if (isObject(name)) {
    mixin(`__${mixins_id++}__`, name, true);
    return
  }

  const store = g ? globals : mixins;

  // Getter
  if (!mix) {
    if (isUndefined(store[name]))
      throw new Error(`Unregistered mixin: ${ name }`)

    return store[name]
  }

  // Setter
  store[name] = isFunction(mix) ?
    extend(mix.prototype, store[name] || {}) && mix :
    extend(store[name] || {}, mix);
}

/**
 * Update all the tags instances created
 * @returns { Array } all the tags instances
 */
function update$1() {
  return each(__TAGS_CACHE, tag => tag.update())
}

function unregister(name) {
  styleManager.remove(name);
  return delete __TAG_IMPL[name]
}

const version = 'WIP';

var core = /*#__PURE__*/Object.freeze({
  Tag: Tag,
  tag: tag,
  tag2: tag2,
  mount: mount,
  mixin: mixin,
  update: update$1,
  unregister: unregister,
  version: version
});

/**
 * Add a mixin to this tag
 * @returns { Tag } the current tag instance
 */
function componentMixin(tag$$1, ...mixins) {
  each(mixins, (mix) => {
    let instance;
    let obj;
    let props = [];

    // properties blacklisted and will not be bound to the tag instance
    const propsBlacklist = ['init', '__proto__'];

    mix = isString(mix) ? mixin(mix) : mix;

    // check if the mixin is a function
    if (isFunction(mix)) {
      // create the new mixin instance
      instance = new mix();
    } else instance = mix;

    const proto = Object.getPrototypeOf(instance);

    // build multilevel prototype inheritance chain property list
    do props = props.concat(Object.getOwnPropertyNames(obj || instance));
    while (obj = Object.getPrototypeOf(obj || instance))

    // loop the keys in the function prototype or the all object keys
    each(props, (key) => {
      // bind methods to tag
      // allow mixins to override other properties/parent mixins
      if (!contains(propsBlacklist, key)) {
        // check for getters/setters
        const descriptor = getPropDescriptor(instance, key) || getPropDescriptor(proto, key);
        const hasGetterSetter = descriptor && (descriptor.get || descriptor.set);

        // apply method only if it does not already exist on the instance
        if (!tag$$1.hasOwnProperty(key) && hasGetterSetter) {
          Object.defineProperty(tag$$1, key, descriptor);
        } else {
          tag$$1[key] = isFunction(instance[key]) ?
            instance[key].bind(tag$$1) :
            instance[key];
        }
      }
    });

    // init method will be called automatically
    if (instance.init)
      instance.init.bind(tag$$1)(tag$$1.opts);
  });

  return tag$$1
}

/**
 * Move the position of a custom tag in its parent tag
 * @this Tag
 * @param   { String } tagName - key where the tag was stored
 * @param   { Number } newPos - index where the new tag will be stored
 */
function moveChild(tagName, newPos) {
  const parent = this.parent;
  let tags;
  // no parent no move
  if (!parent) return

  tags = parent.tags[tagName];

  if (isArray(tags))
    tags.splice(newPos, 0, tags.splice(tags.indexOf(this), 1)[0]);
  else arrayishAdd(parent.tags, tagName, this);
}

/**
 * Move virtual tag and all child nodes
 * @this Tag
 * @param { Node } src  - the node that will do the inserting
 * @param { Tag } target - insert before this tag's first child
 */
function moveVirtual(src, target) {
  let el = this.__.head;
  let sib;
  const frag = createFragment();

  while (el) {
    sib = el.nextSibling;
    frag.appendChild(el);
    el = sib;
    if (el === this.__.tail) {
      frag.appendChild(el);
      src.insertBefore(frag, target.__.head);
      break
    }
  }
}

/**
 * Convert the item looped into an object used to extend the child tag properties
 * @param   { Object } expr - object containing the keys used to extend the children tags
 * @param   { * } key - value to assign to the new object returned
 * @param   { * } val - value containing the position of the item in the array
 * @returns { Object } - new object containing the values of the original item
 *
 * The variables 'key' and 'val' are arbitrary.
 * They depend on the collection type looped (Array, Object)
 * and on the expression used on the each tag
 *
 */
function mkitem(expr, key, val) {
  const item = {};
  item[expr.key] = key;
  if (expr.pos) item[expr.pos] = val;
  return item
}

/**
 * Unmount the redundant tags
 * @param   { Array } items - array containing the current items to loop
 * @param   { Array } tags - array containing all the children tags
 */
function unmountRedundant(items, tags, filteredItemsCount) {
  let i = tags.length;
  const j = items.length - filteredItemsCount;

  while (i > j) {
    i--;
    remove.apply(tags[i], [tags, i]);
  }
}


/**
 * Remove a child tag
 * @this Tag
 * @param   { Array } tags - tags collection
 * @param   { Number } i - index of the tag to remove
 */
function remove(tags, i) {
  tags.splice(i, 1);
  this.unmount();
  arrayishRemove(this.parent, this, this.__.tagName, true);
}

/**
 * Move the nested custom tags in non custom loop tags
 * @this Tag
 * @param   { Number } i - current position of the loop tag
 */
function moveNestedTags(i) {
  each(Object.keys(this.tags), (tagName) => {
    moveChild.apply(this.tags[tagName], [tagName, i]);
  });
}

/**
 * Move a child tag
 * @this Tag
 * @param   { HTMLElement } root - dom node containing all the loop children
 * @param   { Tag } nextTag - instance of the next tag preceding the one we want to move
 * @param   { Boolean } isVirtual - is it a virtual tag?
 */
function move(root, nextTag, isVirtual) {
  if (isVirtual)
    moveVirtual.apply(this, [root, nextTag]);
  else
    safeInsert(root, this.root, nextTag.root);
}

/**
 * Insert and mount a child tag
 * @this Tag
 * @param   { HTMLElement } root - dom node containing all the loop children
 * @param   { Tag } nextTag - instance of the next tag preceding the one we want to insert
 * @param   { Boolean } isVirtual - is it a virtual tag?
 */
function insert(root, nextTag, isVirtual) {
  if (isVirtual)
    makeVirtual.apply(this, [root, nextTag]);
  else
    safeInsert(root, this.root, nextTag.root);
}

/**
 * Append a new tag into the DOM
 * @this Tag
 * @param   { HTMLElement } root - dom node containing all the loop children
 * @param   { Boolean } isVirtual - is it a virtual tag?
 */
function append(root, isVirtual) {
  if (isVirtual)
    makeVirtual.call(this, root);
  else
    root.appendChild(this.root);
}

/**
 * Return the value we want to use to lookup the postion of our items in the collection
 * @param   { String }  keyAttr         - lookup string or expression
 * @param   { * }       originalItem    - original item from the collection
 * @param   { Object }  keyedItem       - object created by riot via { item, i in collection }
 * @param   { Boolean } hasKeyAttrExpr  - flag to check whether the key is an expression
 * @returns { * } value that we will use to figure out the item position via collection.indexOf
 */
function getItemId(keyAttr, originalItem, keyedItem, hasKeyAttrExpr) {
  if (keyAttr) {
    return hasKeyAttrExpr ?  tmpl(keyAttr, keyedItem) :  originalItem[keyAttr]
  }

  return originalItem
}

/**
 * Manage tags having the 'each'
 * @param   { HTMLElement } dom - DOM node we need to loop
 * @param   { Tag } parent - parent tag instance where the dom node is contained
 * @param   { String } expr - string contained in the 'each' attribute
 * @returns { Object } expression object for this each loop
 */
function _each(dom, parent, expr) {
  const mustReorder = typeof getAttribute(dom, LOOP_NO_REORDER_DIRECTIVE) !== T_STRING || removeAttribute(dom, LOOP_NO_REORDER_DIRECTIVE);
  const keyAttr = getAttribute(dom, KEY_DIRECTIVE);
  const hasKeyAttrExpr = keyAttr ? tmpl.hasExpr(keyAttr) : false;
  const tagName = getName(dom);
  const impl = __TAG_IMPL[tagName];
  const parentNode = dom.parentNode;
  const placeholder = createDOMPlaceholder();
  const child = get(dom);
  const ifExpr = getAttribute(dom, CONDITIONAL_DIRECTIVE);
  const tags = [];
  const isLoop = true;
  const innerHTML = dom.innerHTML;
  const isAnonymous = !__TAG_IMPL[tagName];
  const isVirtual = dom.tagName === 'VIRTUAL';
  let oldItems = [];

  // remove the each property from the original tag
  removeAttribute(dom, LOOP_DIRECTIVE);
  removeAttribute(dom, KEY_DIRECTIVE);

  // parse the each expression
  expr = tmpl.loopKeys(expr);
  expr.isLoop = true;

  if (ifExpr) removeAttribute(dom, CONDITIONAL_DIRECTIVE);

  // insert a marked where the loop tags will be injected
  parentNode.insertBefore(placeholder, dom);
  parentNode.removeChild(dom);

  expr.update = function updateEach() {
    // get the new items collection
    expr.value = tmpl(expr.val, parent);

    let items = expr.value;
    const frag = createFragment();
    const isObject = !isArray(items) && !isString(items);
    const root = placeholder.parentNode;
    const tmpItems = [];
    const hasKeys = isObject && !!items;

    // if this DOM was removed the update here is useless
    // this condition fixes also a weird async issue on IE in our unit test
    if (!root) return

    // object loop. any changes cause full redraw
    if (isObject) {
      items = items ? Object.keys(items).map(key => mkitem(expr, items[key], key)) : [];
    }

    // store the amount of filtered items
    let filteredItemsCount = 0;

    // loop all the new items
    each(items, (_item, index) => {
      const i = index - filteredItemsCount;
      const item = !hasKeys && expr.key ? mkitem(expr, _item, index) : _item;

      // skip this item because it must be filtered
      if (ifExpr && !tmpl(ifExpr, extend(create(parent), item))) {
        filteredItemsCount ++;
        return
      }

      const itemId = getItemId(keyAttr, _item, item, hasKeyAttrExpr);
      // reorder only if the items are not objects
      // or a key attribute has been provided
      const doReorder = !isObject && mustReorder && typeof _item === T_OBJECT || keyAttr;
      const oldPos = oldItems.indexOf(itemId);
      const isNew = oldPos === -1;
      const pos = !isNew && doReorder ? oldPos : i;
      // does a tag exist in this position?
      let tag = tags[pos];
      const mustAppend = i >= oldItems.length;
      const mustCreate = doReorder && isNew || !doReorder && !tag || !tags[i];

      // new tag
      if (mustCreate) {
        tag = createTag(impl, {
          parent,
          isLoop,
          isAnonymous,
          tagName,
          root: dom.cloneNode(isAnonymous),
          item,
          index: i,
        }, innerHTML);

        // mount the tag
        tag.mount();

        if (mustAppend)
          append.apply(tag, [frag || root, isVirtual]);
        else
          insert.apply(tag, [root, tags[i], isVirtual]);

        if (!mustAppend) oldItems.splice(i, 0, item);
        tags.splice(i, 0, tag);
        if (child) arrayishAdd(parent.tags, tagName, tag, true);
      } else if (pos !== i && doReorder) {
        // move
        if (keyAttr || contains(items, oldItems[pos])) {
          move.apply(tag, [root, tags[i], isVirtual]);
          // move the old tag instance
          tags.splice(i, 0, tags.splice(pos, 1)[0]);
          // move the old item
          oldItems.splice(i, 0, oldItems.splice(pos, 1)[0]);
        }

        // update the position attribute if it exists
        if (expr.pos) tag[expr.pos] = i;

        // if the loop tags are not custom
        // we need to move all their custom tags into the right position
        if (!child && tag.tags) moveNestedTags.call(tag, i);
      }

      // cache the original item to use it in the events bound to this node
      // and its children
      extend(tag.__, {
        item,
        index: i,
        parent
      });

      tmpItems[i] = itemId;

      if (!mustCreate) tag.update(item);
    });

    // remove the redundant tags
    unmountRedundant(items, tags, filteredItemsCount);

    // clone the items array
    oldItems = tmpItems.slice();

    root.insertBefore(frag, placeholder);
  };

  expr.unmount = () => {
    each(tags, t => { t.unmount(); });
  };

  return expr
}

var RefExpr = {
  init(dom, parent, attrName, attrValue) {
    this.dom = dom;
    this.attr = attrName;
    this.rawValue = attrValue;
    this.parent = parent;
    this.hasExp = tmpl.hasExpr(attrValue);
    return this
  },
  update() {
    const old = this.value;
    const customParent = this.parent && getImmediateCustomParent(this.parent);
    // if the referenced element is a custom tag, then we set the tag itself, rather than DOM
    const tagOrDom = this.dom.__ref || this.tag || this.dom;

    this.value = this.hasExp ? tmpl(this.rawValue, this.parent) : this.rawValue;

    // the name changed, so we need to remove it from the old key (if present)
    if (!isBlank(old) && customParent) arrayishRemove(customParent.refs, old, tagOrDom);
    if (!isBlank(this.value) && isString(this.value)) {
      // add it to the refs of parent tag (this behavior was changed >=3.0)
      if (customParent) arrayishAdd(
        customParent.refs,
        this.value,
        tagOrDom,
        // use an array if it's a looped node and the ref is not an expression
        null,
        this.parent.__.index
      );

      if (this.value !== old) {
        setAttribute(this.dom, this.attr, this.value);
      }
    } else {
      removeAttribute(this.dom, this.attr);
    }

    // cache the ref bound to this dom node
    // to reuse it in future (see also #2329)
    if (!this.dom.__ref) this.dom.__ref = tagOrDom;
  },
  unmount() {
    const tagOrDom = this.tag || this.dom;
    const customParent = this.parent && getImmediateCustomParent(this.parent);
    if (!isBlank(this.value) && customParent)
      arrayishRemove(customParent.refs, this.value, tagOrDom);
  }
};

/**
 * Create a new ref directive
 * @param   { HTMLElement } dom - dom node having the ref attribute
 * @param   { Tag } context - tag instance where the DOM node is located
 * @param   { String } attrName - either 'ref' or 'data-ref'
 * @param   { String } attrValue - value of the ref attribute
 * @returns { RefExpr } a new RefExpr object
 */
function createRefDirective(dom, tag, attrName, attrValue) {
  return create(RefExpr).init(dom, tag, attrName, attrValue)
}

/**
 * Trigger the unmount method on all the expressions
 * @param   { Array } expressions - DOM expressions
 */
function unmountAll(expressions) {
  each(expressions, expr => {
    if (expr.unmount) expr.unmount(true);
    else if (expr.tagName) expr.tag.unmount(true);
    else if (expr.unmount) expr.unmount();
  });
}

var IfExpr = {
  init(dom, tag, expr) {
    removeAttribute(dom, CONDITIONAL_DIRECTIVE);
    extend(this, { tag, expr, stub: createDOMPlaceholder(), pristine: dom });
    const p = dom.parentNode;
    p.insertBefore(this.stub, dom);
    p.removeChild(dom);

    return this
  },
  update() {
    this.value = tmpl(this.expr, this.tag);

    if (this.value && !this.current) { // insert
      this.current = this.pristine.cloneNode(true);
      this.stub.parentNode.insertBefore(this.current, this.stub);
      this.expressions = parseExpressions.apply(this.tag, [this.current, true]);
    } else if (!this.value && this.current) { // remove
      this.unmount();
      this.current = null;
      this.expressions = [];
    }

    if (this.value) update.call(this.tag, this.expressions);
  },
  unmount() {
    if (this.current) {
      if (this.current._tag) {
        this.current._tag.unmount();
      } else if (this.current.parentNode) {
        this.current.parentNode.removeChild(this.current);
      }
    }

    unmountAll(this.expressions || []);
  }
};

/**
 * Create a new if directive
 * @param   { HTMLElement } dom - if root dom node
 * @param   { Tag } context - tag instance where the DOM node is located
 * @param   { String } attr - if expression
 * @returns { IFExpr } a new IfExpr object
 */
function createIfDirective(dom, tag, attr) {
  return create(IfExpr).init(dom, tag, attr)
}

/**
 * Walk the tag DOM to detect the expressions to evaluate
 * @this Tag
 * @param   { HTMLElement } root - root tag where we will start digging the expressions
 * @param   { Boolean } mustIncludeRoot - flag to decide whether the root must be parsed as well
 * @returns { Array } all the expressions found
 */
function parseExpressions(root, mustIncludeRoot) {
  const expressions = [];

  walkNodes(root, (dom) => {
    const type = dom.nodeType;
    let attr;
    let tagImpl;

    if (!mustIncludeRoot && dom === root) return

    // text node
    if (type === 3 && dom.parentNode.tagName !== 'STYLE' && tmpl.hasExpr(dom.nodeValue))
      expressions.push({dom, expr: dom.nodeValue});

    if (type !== 1) return

    const isVirtual = dom.tagName === 'VIRTUAL';

    // loop. each does it's own thing (for now)
    if (attr = getAttribute(dom, LOOP_DIRECTIVE)) {
      if(isVirtual) setAttribute(dom, 'loopVirtual', true); // ignore here, handled in _each
      expressions.push(_each(dom, this, attr));
      return false
    }

    // if-attrs become the new parent. Any following expressions (either on the current
    // element, or below it) become children of this expression.
    if (attr = getAttribute(dom, CONDITIONAL_DIRECTIVE)) {
      expressions.push(createIfDirective(dom, this, attr));
      return false
    }

    if (attr = getAttribute(dom, IS_DIRECTIVE)) {
      if (tmpl.hasExpr(attr)) {
        expressions.push({
          isRtag: true,
          expr: attr,
          dom,
          attrs: [].slice.call(dom.attributes)
        });

        return false
      }
    }

    // if this is a tag, stop traversing here.
    // we ignore the root, since parseExpressions is called while we're mounting that root
    tagImpl = get(dom);

    if(isVirtual) {
      if(getAttribute(dom, 'virtualized')) {dom.parentElement.removeChild(dom); } // tag created, remove from dom
      if(!tagImpl && !getAttribute(dom, 'virtualized') && !getAttribute(dom, 'loopVirtual'))  // ok to create virtual tag
        tagImpl = { tmpl: dom.outerHTML };
    }

    if (tagImpl && (dom !== root || mustIncludeRoot)) {
      const hasIsDirective = getAttribute(dom, IS_DIRECTIVE);
      if(isVirtual && !hasIsDirective) { // handled in update
        // can not remove attribute like directives
        // so flag for removal after creation to prevent maximum stack error
        setAttribute(dom, 'virtualized', true);
        const tag = createTag(
          {tmpl: dom.outerHTML},
          {root: dom, parent: this},
          dom.innerHTML
        );

        expressions.push(tag); // no return, anonymous tag, keep parsing
      } else {
        if (hasIsDirective && isVirtual)
          warn(`Virtual tags shouldn't be used together with the "${IS_DIRECTIVE}" attribute - https://github.com/riot/riot/issues/2511`);

        expressions.push(
          initChild(
            tagImpl,
            {
              root: dom,
              parent: this
            },
            dom.innerHTML,
            this
          )
        );
        return false
      }
    }

    // attribute expressions
    parseAttributes.apply(this, [dom, dom.attributes, (attr, expr) => {
      if (!expr) return
      expressions.push(expr);
    }]);
  });

  return expressions
}

/**
 * Calls `fn` for every attribute on an element. If that attr has an expression,
 * it is also passed to fn.
 * @this Tag
 * @param   { HTMLElement } dom - dom node to parse
 * @param   { Array } attrs - array of attributes
 * @param   { Function } fn - callback to exec on any iteration
 */
function parseAttributes(dom, attrs, fn) {
  each(attrs, (attr) => {
    if (!attr) return false

    const name = attr.name;
    const bool = isBoolAttr(name);
    let expr;

    if (contains(REF_DIRECTIVES, name) && dom.tagName.toLowerCase() !== YIELD_TAG) {
      expr =  createRefDirective(dom, this, name, attr.value);
    } else if (tmpl.hasExpr(attr.value)) {
      expr = {dom, expr: attr.value, attr: name, bool};
    }

    fn(attr, expr);
  });
}

/**
 * Manage the mount state of a tag triggering also the observable events
 * @this Tag
 * @param { Boolean } value - ..of the isMounted flag
 */
function setMountState(value) {
  const { isAnonymous } = this.__;

  define(this, 'isMounted', value);

  if (!isAnonymous) {
    if (value) this.trigger('mount');
    else {
      this.trigger('unmount');
      this.off('*');
      this.__.wasCreated = false;
    }
  }
}

/**
 * Mount the current tag instance
 * @returns { Tag } the current tag instance
 */
function componentMount(tag$$1, dom, expressions, opts) {
  const __ = tag$$1.__;
  const root = __.root;
  root._tag = tag$$1; // keep a reference to the tag just created

  // Read all the attrs on this instance. This give us the info we need for updateOpts
  parseAttributes.apply(__.parent, [root, root.attributes, (attr, expr) => {
    if (!__.isAnonymous && RefExpr.isPrototypeOf(expr)) expr.tag = tag$$1;
    attr.expr = expr;
    __.instAttrs.push(attr);
  }]);

  // update the root adding custom attributes coming from the compiler
  walkAttributes(__.impl.attrs, (k, v) => { __.implAttrs.push({name: k, value: v}); });
  parseAttributes.apply(tag$$1, [root, __.implAttrs, (attr, expr) => {
    if (expr) expressions.push(expr);
    else setAttribute(root, attr.name, attr.value);
  }]);

  // initialiation
  updateOpts.apply(tag$$1, [__.isLoop, __.parent, __.isAnonymous, opts, __.instAttrs]);

  // add global mixins
  const globalMixin = mixin(GLOBAL_MIXIN);

  if (globalMixin && !__.skipAnonymous) {
    for (const i in globalMixin) {
      if (globalMixin.hasOwnProperty(i)) {
        tag$$1.mixin(globalMixin[i]);
      }
    }
  }

  if (__.impl.fn) __.impl.fn.call(tag$$1, opts);

  if (!__.skipAnonymous) tag$$1.trigger('before-mount');

  // parse layout after init. fn may calculate args for nested custom tags
  each(parseExpressions.apply(tag$$1, [dom, __.isAnonymous]), e => expressions.push(e));

  tag$$1.update(__.item);

  if (!__.isAnonymous && !__.isInline) {
    while (dom.firstChild) root.appendChild(dom.firstChild);
  }

  define(tag$$1, 'root', root);

  // if we need to wait that the parent "mount" or "updated" event gets triggered
  if (!__.skipAnonymous && tag$$1.parent) {
    const p = getImmediateCustomParent(tag$$1.parent);
    p.one(!p.isMounted ? 'mount' : 'updated', () => {
      setMountState.call(tag$$1, true);
    });
  } else {
    // otherwise it's not a child tag we can trigger its mount event
    setMountState.call(tag$$1, true);
  }

  tag$$1.__.wasCreated = true;

  return tag$$1
}

/**
 * Unmount the tag instance
 * @param { Boolean } mustKeepRoot - if it's true the root node will not be removed
 * @returns { Tag } the current tag instance
 */
function tagUnmount(tag, mustKeepRoot, expressions) {
  const __ = tag.__;
  const root = __.root;
  const tagIndex = __TAGS_CACHE.indexOf(tag);
  const p = root.parentNode;

  if (!__.skipAnonymous) tag.trigger('before-unmount');

  // clear all attributes coming from the mounted tag
  walkAttributes(__.impl.attrs, (name) => {
    if (startsWith(name, ATTRS_PREFIX))
      name = name.slice(ATTRS_PREFIX.length);

    removeAttribute(root, name);
  });

  // remove all the event listeners
  tag.__.listeners.forEach((dom) => {
    Object.keys(dom[RIOT_EVENTS_KEY]).forEach((eventName) => {
      dom.removeEventListener(eventName, dom[RIOT_EVENTS_KEY][eventName]);
    });
  });

  // remove tag instance from the global tags cache collection
  if (tagIndex !== -1) __TAGS_CACHE.splice(tagIndex, 1);

  // clean up the parent tags object
  if (__.parent && !__.isAnonymous) {
    const ptag = getImmediateCustomParent(__.parent);

    if (__.isVirtual) {
      Object
        .keys(tag.tags)
        .forEach(tagName => arrayishRemove(ptag.tags, tagName, tag.tags[tagName]));
    } else {
      arrayishRemove(ptag.tags, __.tagName, tag);
    }
  }

  // unmount all the virtual directives
  if (tag.__.virts) {
    each(tag.__.virts, (v) => {
      if (v.parentNode) v.parentNode.removeChild(v);
    });
  }

  // allow expressions to unmount themselves
  unmountAll(expressions);
  each(__.instAttrs, a => a.expr && a.expr.unmount && a.expr.unmount());

  // clear the tag html if it's necessary
  if (mustKeepRoot) setInnerHTML(root, '');
  // otherwise detach the root tag from the DOM
  else if (p) p.removeChild(root);

  // custom internal unmount function to avoid relying on the observable
  if (__.onUnmount) __.onUnmount();

  // weird fix for a weird edge case #2409 and #2436
  // some users might use your software not as you've expected
  // so I need to add these dirty hacks to mitigate unexpected issues
  if (!tag.isMounted) setMountState.call(tag, true);

  setMountState.call(tag, false);

  delete root._tag;

  return tag
}

/**
 * Tag creation factory function
 * @constructor
 * @param { Object } impl - it contains the tag template, and logic
 * @param { Object } conf - tag options
 * @param { String } innerHTML - html that eventually we need to inject in the tag
 */
function createTag(impl = {}, conf = {}, innerHTML) {
  const tag = conf.context || {};
  const opts = conf.opts || {};
  const parent = conf.parent;
  const isLoop = conf.isLoop;
  const isAnonymous = !!conf.isAnonymous;
  const skipAnonymous = settings.skipAnonymousTags && isAnonymous;
  const item = conf.item;
  // available only for the looped nodes
  const index = conf.index;
  // All attributes on the Tag when it's first parsed
  const instAttrs = [];
  // expressions on this type of Tag
  const implAttrs = [];
  const tmpl = impl.tmpl;
  const expressions = [];
  const root = conf.root;
  const tagName = conf.tagName || getName(root);
  const isVirtual = tagName === 'virtual';
  const isInline = !isVirtual && !tmpl;
  let dom;

  if (isInline || isLoop && isAnonymous) {
    dom = root;
  } else {
    if (!isVirtual) root.innerHTML = '';
    dom = mkdom(tmpl, innerHTML, isSvg(root));
  }

  // make this tag observable
  if (!skipAnonymous) observable(tag);

  // only call unmount if we have a valid __TAG_IMPL (has name property)
  if (impl.name && root._tag) root._tag.unmount(true);

  define(tag, '__', {
    impl,
    root,
    skipAnonymous,
    implAttrs,
    isAnonymous,
    instAttrs,
    innerHTML,
    tagName,
    index,
    isLoop,
    isInline,
    item,
    parent,
    // tags having event listeners
    // it would be better to use weak maps here but we can not introduce breaking changes now
    listeners: [],
    // these vars will be needed only for the virtual tags
    virts: [],
    wasCreated: false,
    tail: null,
    head: null
  });

  // tag protected properties
  return [
    ['isMounted', false],
    // create a unique id to this tag
    // it could be handy to use it also to improve the virtual dom rendering speed
    ['_riot_id', uid()],
    ['root', root],
    ['opts', opts, { writable: true, enumerable: true }],
    ['parent', parent || null],
    // protect the "tags" and "refs" property from being overridden
    ['tags', {}],
    ['refs', {}],
    ['update', data => componentUpdate(tag, data, expressions)],
    ['mixin', (...mixins) => componentMixin(tag, ...mixins)],
    ['mount', () => componentMount(tag, dom, expressions, opts)],
    ['unmount', mustKeepRoot => tagUnmount(tag, mustKeepRoot, expressions)]
  ].reduce((acc, [key, value, opts]) => {
    define(tag, key, value, opts);
    return acc
  }, extend(tag, item))
}

/**
 * Mount a tag creating new Tag instance
 * @param   { Object } root - dom node where the tag will be mounted
 * @param   { String } tagName - name of the riot tag we want to mount
 * @param   { Object } opts - options to pass to the Tag instance
 * @param   { Object } ctx - optional context that will be used to extend an existing class ( used in riot.Tag )
 * @returns { Tag } a new Tag instance
 */
function mount$1(root, tagName, opts, ctx) {
  const impl = __TAG_IMPL[tagName];
  const implClass = __TAG_IMPL[tagName].class;
  const context = ctx || (implClass ? create(implClass.prototype) : {});
  // cache the inner HTML to fix #855
  const innerHTML = root._innerHTML = root._innerHTML || root.innerHTML;
  const conf = extend({ root, opts, context }, { parent: opts ? opts.parent : null });
  let tag;

  if (impl && root) tag = createTag(impl, conf, innerHTML);

  if (tag && tag.mount) {
    tag.mount(true);
    // add this tag to the virtualDom variable
    if (!contains(__TAGS_CACHE, tag)) __TAGS_CACHE.push(tag);
  }

  return tag
}



var tags = /*#__PURE__*/Object.freeze({
  arrayishAdd: arrayishAdd,
  getTagName: getName,
  inheritParentProps: inheritParentProps,
  mountTo: mount$1,
  selectTags: query,
  arrayishRemove: arrayishRemove,
  getTag: get,
  initChildTag: initChild,
  moveChildTag: moveChild,
  makeReplaceVirtual: makeReplaceVirtual,
  getImmediateCustomParentTag: getImmediateCustomParent,
  makeVirtual: makeVirtual,
  moveVirtual: moveVirtual,
  unmountAll: unmountAll,
  createIfDirective: createIfDirective,
  createRefDirective: createRefDirective
});

/**
 * Riot public api
 */
const settings$1 = settings;
const util = {
  tmpl,
  brackets,
  styleManager,
  vdom: __TAGS_CACHE,
  styleNode: styleManager.styleNode,
  // export the riot internal utils as well
  dom,
  check,
  misc,
  tags
};

var riot$1 = extend({}, core, {
  observable: observable,
  settings: settings$1,
  util,
});

const html = `
  <i class="material-icons" circle="{{opts.circle === ''}}">{{opts.is}}</i>
`;

riot$1.tag('icon', html, function (opts) {});

const html$1 = `
  <svg viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <g class="logo-group" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <circle class="circle" fill="#000" cx="256" cy="256" r="256"></circle>
      <polygon class="buttar-outline" fill="#000" points="92 143.99561 92 288.67652 315.920778 435 420 287.219566 419.348853 152.221786 185.264079 117"></polygon>
      <polygon class="buttar-top" fill="#000" points="108.642477 151.400436 311.012274 218.515988 399.760877 161.338299 183.900946 126.513808"></polygon>
      <polygon class="buttar-left" fill="#000" points="104.256785 279.231831 302.492592 405.631177 302.492592 232.594095 104.256785 161.269622"></polygon>
      <polygon class="buttar-right" fill="#000" points="405.605923 285.743459 317.462419 405.631177 317.462419 232.594095 405.605923 167.78125"></polygon>
    </g>
  </svg>
`;

riot$1.tag('logo', html$1, function (opts) {});

var TAGS = {
	'' : ['<em>','</em>'],
	_ : ['<strong>','</strong>'],
	'\n' : ['<br />'],
	' ' : ['<br />'],
	'-': ['<hr />']
};

/** Outdent a string based on the first indented line's leading whitespace
 *	@private
 */
function outdent(str) {
	return str.replace(RegExp('^'+(str.match(/^(\t| )+/) || '')[0], 'gm'), '');
}

/** Encode special attribute characters to HTML entities in a String.
 *	@private
 */
function encodeAttr(str) {
	return (str+'').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Parse Markdown into an HTML String. */
function parse(md) {
	var tokenizer = /((?:^|\n+)(?:\n---+|\* \*(?: \*)+)\n)|(?:^```(\w*)\n([\s\S]*?)\n```$)|((?:(?:^|\n+)(?:\t|  {2,}).+)+\n*)|((?:(?:^|\n)([>*+-]|\d+\.)\s+.*)+)|(?:\!\[([^\]]*?)\]\(([^\)]+?)\))|(\[)|(\](?:\(([^\)]+?)\))?)|(?:(?:^|\n+)([^\s].*)\n(\-{3,}|={3,})(?:\n+|$))|(?:(?:^|\n+)(#{1,3})\s*(.+)(?:\n+|$))|(?:`([^`].*?)`)|(  \n\n*|\n{2,}|__|\*\*|[_*])/gm,
		context = [],
		out = '',
		last = 0,
		links = {},
		chunk, prev, token, inner, t;

	function tag(token) {
		var desc = TAGS[token.replace(/\*/g,'_')[1] || ''],
			end = context[context.length-1]==token;
		if (!desc) { return token; }
		if (!desc[1]) { return desc[0]; }
		context[end?'pop':'push'](token);
		return desc[end|0];
	}

	function flush() {
		var str = '';
		while (context.length) { str += tag(context[context.length-1]); }
		return str;
	}

	md = md.replace(/^\[(.+?)\]:\s*(.+)$/gm, function (s, name, url) {
		links[name.toLowerCase()] = url;
		return '';
	}).replace(/^\n+|\n+$/g, '');

	while ( (token=tokenizer.exec(md)) ) {
		prev = md.substring(last, token.index);
		last = tokenizer.lastIndex;
		chunk = token[0];
		if (prev.match(/[^\\](\\\\)*\\$/)) ;
		// Code/Indent blocks:
		else if (token[3] || token[4]) {
			chunk = '<pre class="code '+(token[4]?'poetry':token[2].toLowerCase())+'">'+outdent(encodeAttr(token[3] || token[4]).replace(/^\n+|\n+$/g, ''))+'</pre>';
		}
		// > Quotes, -* lists:
		else if (token[6]) {
			t = token[6];
			if (t.match(/\./)) {
				token[5] = token[5].replace(/^\d+/gm, '');
			}
			inner = parse(outdent(token[5].replace(/^\s*[>*+.-]/gm, '')));
			if (t==='>') { t = 'blockquote'; }
			else {
				t = t.match(/\./) ? 'ol' : 'ul';
				inner = inner.replace(/^(.*)(\n|$)/gm, '<li>$1</li>');
			}
			chunk = '<'+t+'>' + inner + '</'+t+'>';
		}
		// Images:
		else if (token[8]) {
			chunk = "<img src=\"" + (encodeAttr(token[8])) + "\" alt=\"" + (encodeAttr(token[7])) + "\">";
		}
		// Links:
		else if (token[10]) {
			out = out.replace('<a>', ("<a href=\"" + (encodeAttr(token[11] || links[prev.toLowerCase()])) + "\">"));
			chunk = flush() + '</a>';
		}
		else if (token[9]) {
			chunk = '<a>';
		}
		// Headings:
		else if (token[12] || token[14]) {
			t = 'h' + (token[14] ? token[14].length : (token[13][0]==='='?1:2));
			chunk = '<'+t+'>' + parse(token[12] || token[15]) + '</'+t+'>';
		}
		// `code`:
		else if (token[16]) {
			chunk = '<code>'+encodeAttr(token[16])+'</code>';
		}
		// Inline formatting: *em*, **strong** & friends
		else if (token[17] || token[1]) {
			chunk = tag(token[17] || '--');
		}
		out += prev;
		out += chunk;
	}

	return (out + md.substring(last) + flush()).trim();
}

const html$2 = `
  <div></div>
`;

riot$1.tag('markdown', html$2, function (opts) {
  const tag = this,
        root = tag.root;
  
  tag.on('mount', () => {
    root.querySelector('div').innerHTML = parse(opts.code).replace(/\n/g, '<br/>');
  });
});

const html$3 = `
  <div>
    <div class="ripple">
      <div></div>
      <div></div>
    </div>
  </div>
`;

riot$1.tag('ui-throbber', html$3, function (opts) {});

const html$4 = `
  <nav>
    <ul>
      <li hamburger>
        <a href="#" title="Menu">
          <icon is="menu" circle></icon>
        </a>
      </li>
      <li each="{{item in items}}" active="{{opts.section === item.section}}">
        <a href="{{item.section !== 'profile' ? '#/'+ item.section : '#'}}" title="{{item.label}}">
          <icon is="{{item.icon}}" circle></icon>
          <span>{{item.label}}</span>
        </a>
      </li>
      <li>
        <a href="/dist/assets/BrandonButtarsResume.pdf" target="_blank" title="Download Resume">
          <icon is="file_download" circle></icon>
          <span>Download</span>
        </a>
      </li>
  </nav>
`;

riot$1.tag('ui-menu', html$4, function (opts) {
  const tag = this,
        root = tag.root;
  
  tag.items = [
    { label: 'Profile', icon: 'face', section: 'profile' },
    { label: 'Experience', icon: 'business', section: 'experience' },
    // { label: 'Technology', icon: 'important_devices', section: 'technology' },
    { label: 'Education', icon: 'school', section: 'education' },
    { label: 'Portfolio', icon: 'palette', section: 'portfolio' }
  ];

  tag.on('mount', () => {
    const hamburger = root.querySelector('[hamburger] a');

    hamburger.addEventListener('click', function (e) {
      e.preventDefault();
      PubSub.fire('menu:toggle');
    });

    window.addEventListener('resize', () => {
      PubSub.fire('menu:close');
    });
  });
});

var app$1 = app = {
  api: {
    'root': 'http://buttars.space:1337',
    'profile': 'http://buttars.space:1337/profile/5b41337e929fde6e8bd4244a',
    'education': 'http://buttars.space:1337/education?_sort=order:asc',
    'experience': 'http://buttars.space:1337/experience?_sort=order:asc',
    'technology': 'http://buttars.space:1337/technology?_sort=name:asc',
    'portfolio': 'http://buttars.space:1337/portfolio'
  }
};

const html$5 = `
  <grid compact each="{{exp in opts.experience}}">
    <div size="12" mobile="3" desktop="2">
      <h5>{{exp.start}}{{ exp.start !== exp.end ? ' - ' : '' }}{{exp.current ? 'Current' : exp.start !== exp.end ? exp.end : ''}}</h5>
      <img if="{{exp.logo}}" src="${app$1.api.root}{{exp.logo.url}}"/>
    </div>
    <div size="12" mobile="9" desktop="10">
      <h4>{{exp.company}}</h4>
      <h6>{{exp.position}}</h6>
      <markdown code="{{exp.description}}"></markdown>
    </div>
  </grid>
`;

riot$1.tag('experience-block', html$5, function (opts) {});

const html$6 = `
  <grid compact each="{{ed in opts.education}}">
    <div size="12" mobile="3" desktop="2">
      <h5>{{ed.start}} - {{ed.end}}</h5>
    </div>
    <div size="12" mobile="9" desktop="10">
      <h4>{{ed.institution}}</h4>
      <h6>{{ed.emphasis}}</h6>
    </div>
  </grid>
`;

riot$1.tag('education-block', html$6, function (opts) {});

const html$7 = `
  <p><em>Currently being assembled. In the mean time here's some links to things I've done and a few images.</em></p>
  <ul>
    <li each="{{link in links}}">
      <a href="{{link.link}}" target="_blank">{{link.label}}</a>
    </li>
  </ul>
  <dl grid>
    <dd each="{{p in opts.portfolio}}">
      <a data-src="${app$1.api.root}{{p.file.url}}" to-modal href="${app$1.api.root}{{p.file.url}}" target="_blank"></a>
    </dd>
  </dl>
`;

riot$1.tag('portfolio-block', html$7, function (opts) {
  const tag = this,
        root = tag.root;
  
  tag.links = [
    { label: 'Stuff I\'ve Done (Pinterest)', link: 'https://www.pinterest.com/brandonbuttars/stuff-i-ve-done/' },
    { label: 'NOC Timer', link: 'https://cdn.sorensonspark.com/ticogen/index.html' },
    { label: 'Exported Wireframe', link: 'http://resume.brandonbuttars.com/dist/assets/ImagineLearning' }
  ];

  tag.on('mount', () => {
    const imgs = root.querySelectorAll('[data-src]');
    if (imgs.length > 0) {
      imgs.forEach(i => {
        i.src = i.getAttribute('data-src');
        i.style.cssText = `background-image: url(${i.getAttribute('data-src')})`;
      });
    }
  });  
});

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var crypt = createCommonjsModule(function (module) {
(function() {
  var base64map
      = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',

  crypt = {
    // Bit-wise rotation left
    rotl: function(n, b) {
      return (n << b) | (n >>> (32 - b));
    },

    // Bit-wise rotation right
    rotr: function(n, b) {
      return (n << (32 - b)) | (n >>> b);
    },

    // Swap big-endian to little-endian and vice versa
    endian: function(n) {
      // If number given, swap endian
      if (n.constructor == Number) {
        return crypt.rotl(n, 8) & 0x00FF00FF | crypt.rotl(n, 24) & 0xFF00FF00;
      }

      // Else, assume array and swap all items
      for (var i = 0; i < n.length; i++)
        n[i] = crypt.endian(n[i]);
      return n;
    },

    // Generate an array of any length of random bytes
    randomBytes: function(n) {
      for (var bytes = []; n > 0; n--)
        bytes.push(Math.floor(Math.random() * 256));
      return bytes;
    },

    // Convert a byte array to big-endian 32-bit words
    bytesToWords: function(bytes) {
      for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
        words[b >>> 5] |= bytes[i] << (24 - b % 32);
      return words;
    },

    // Convert big-endian 32-bit words to a byte array
    wordsToBytes: function(words) {
      for (var bytes = [], b = 0; b < words.length * 32; b += 8)
        bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
      return bytes;
    },

    // Convert a byte array to a hex string
    bytesToHex: function(bytes) {
      for (var hex = [], i = 0; i < bytes.length; i++) {
        hex.push((bytes[i] >>> 4).toString(16));
        hex.push((bytes[i] & 0xF).toString(16));
      }
      return hex.join('');
    },

    // Convert a hex string to a byte array
    hexToBytes: function(hex) {
      for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
      return bytes;
    },

    // Convert a byte array to a base-64 string
    bytesToBase64: function(bytes) {
      for (var base64 = [], i = 0; i < bytes.length; i += 3) {
        var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        for (var j = 0; j < 4; j++)
          if (i * 8 + j * 6 <= bytes.length * 8)
            base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F));
          else
            base64.push('=');
      }
      return base64.join('');
    },

    // Convert a base-64 string to a byte array
    base64ToBytes: function(base64) {
      // Remove non-base-64 characters
      base64 = base64.replace(/[^A-Z0-9+\/]/ig, '');

      for (var bytes = [], i = 0, imod4 = 0; i < base64.length;
          imod4 = ++i % 4) {
        if (imod4 == 0) continue;
        bytes.push(((base64map.indexOf(base64.charAt(i - 1))
            & (Math.pow(2, -2 * imod4 + 8) - 1)) << (imod4 * 2))
            | (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2)));
      }
      return bytes;
    }
  };

  module.exports = crypt;
})();
});

var charenc = {
  // UTF-8 encoding
  utf8: {
    // Convert a string to a byte array
    stringToBytes: function(str) {
      return charenc.bin.stringToBytes(unescape(encodeURIComponent(str)));
    },

    // Convert a byte array to a string
    bytesToString: function(bytes) {
      return decodeURIComponent(escape(charenc.bin.bytesToString(bytes)));
    }
  },

  // Binary encoding
  bin: {
    // Convert a string to a byte array
    stringToBytes: function(str) {
      for (var bytes = [], i = 0; i < str.length; i++)
        bytes.push(str.charCodeAt(i) & 0xFF);
      return bytes;
    },

    // Convert a byte array to a string
    bytesToString: function(bytes) {
      for (var str = [], i = 0; i < bytes.length; i++)
        str.push(String.fromCharCode(bytes[i]));
      return str.join('');
    }
  }
};

var charenc_1 = charenc;

/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
var isBuffer_1 = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
};

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

var md5 = createCommonjsModule(function (module) {
(function(){
  var crypt$$1 = crypt,
      utf8 = charenc_1.utf8,
      isBuffer = isBuffer_1,
      bin = charenc_1.bin,

  // The core
  md5 = function (message, options) {
    // Convert to byte array
    if (message.constructor == String)
      if (options && options.encoding === 'binary')
        message = bin.stringToBytes(message);
      else
        message = utf8.stringToBytes(message);
    else if (isBuffer(message))
      message = Array.prototype.slice.call(message, 0);
    else if (!Array.isArray(message))
      message = message.toString();
    // else, assume byte array already

    var m = crypt$$1.bytesToWords(message),
        l = message.length * 8,
        a =  1732584193,
        b = -271733879,
        c = -1732584194,
        d =  271733878;

    // Swap endian
    for (var i = 0; i < m.length; i++) {
      m[i] = ((m[i] <<  8) | (m[i] >>> 24)) & 0x00FF00FF |
             ((m[i] << 24) | (m[i] >>>  8)) & 0xFF00FF00;
    }

    // Padding
    m[l >>> 5] |= 0x80 << (l % 32);
    m[(((l + 64) >>> 9) << 4) + 14] = l;

    // Method shortcuts
    var FF = md5._ff,
        GG = md5._gg,
        HH = md5._hh,
        II = md5._ii;

    for (var i = 0; i < m.length; i += 16) {

      var aa = a,
          bb = b,
          cc = c,
          dd = d;

      a = FF(a, b, c, d, m[i+ 0],  7, -680876936);
      d = FF(d, a, b, c, m[i+ 1], 12, -389564586);
      c = FF(c, d, a, b, m[i+ 2], 17,  606105819);
      b = FF(b, c, d, a, m[i+ 3], 22, -1044525330);
      a = FF(a, b, c, d, m[i+ 4],  7, -176418897);
      d = FF(d, a, b, c, m[i+ 5], 12,  1200080426);
      c = FF(c, d, a, b, m[i+ 6], 17, -1473231341);
      b = FF(b, c, d, a, m[i+ 7], 22, -45705983);
      a = FF(a, b, c, d, m[i+ 8],  7,  1770035416);
      d = FF(d, a, b, c, m[i+ 9], 12, -1958414417);
      c = FF(c, d, a, b, m[i+10], 17, -42063);
      b = FF(b, c, d, a, m[i+11], 22, -1990404162);
      a = FF(a, b, c, d, m[i+12],  7,  1804603682);
      d = FF(d, a, b, c, m[i+13], 12, -40341101);
      c = FF(c, d, a, b, m[i+14], 17, -1502002290);
      b = FF(b, c, d, a, m[i+15], 22,  1236535329);

      a = GG(a, b, c, d, m[i+ 1],  5, -165796510);
      d = GG(d, a, b, c, m[i+ 6],  9, -1069501632);
      c = GG(c, d, a, b, m[i+11], 14,  643717713);
      b = GG(b, c, d, a, m[i+ 0], 20, -373897302);
      a = GG(a, b, c, d, m[i+ 5],  5, -701558691);
      d = GG(d, a, b, c, m[i+10],  9,  38016083);
      c = GG(c, d, a, b, m[i+15], 14, -660478335);
      b = GG(b, c, d, a, m[i+ 4], 20, -405537848);
      a = GG(a, b, c, d, m[i+ 9],  5,  568446438);
      d = GG(d, a, b, c, m[i+14],  9, -1019803690);
      c = GG(c, d, a, b, m[i+ 3], 14, -187363961);
      b = GG(b, c, d, a, m[i+ 8], 20,  1163531501);
      a = GG(a, b, c, d, m[i+13],  5, -1444681467);
      d = GG(d, a, b, c, m[i+ 2],  9, -51403784);
      c = GG(c, d, a, b, m[i+ 7], 14,  1735328473);
      b = GG(b, c, d, a, m[i+12], 20, -1926607734);

      a = HH(a, b, c, d, m[i+ 5],  4, -378558);
      d = HH(d, a, b, c, m[i+ 8], 11, -2022574463);
      c = HH(c, d, a, b, m[i+11], 16,  1839030562);
      b = HH(b, c, d, a, m[i+14], 23, -35309556);
      a = HH(a, b, c, d, m[i+ 1],  4, -1530992060);
      d = HH(d, a, b, c, m[i+ 4], 11,  1272893353);
      c = HH(c, d, a, b, m[i+ 7], 16, -155497632);
      b = HH(b, c, d, a, m[i+10], 23, -1094730640);
      a = HH(a, b, c, d, m[i+13],  4,  681279174);
      d = HH(d, a, b, c, m[i+ 0], 11, -358537222);
      c = HH(c, d, a, b, m[i+ 3], 16, -722521979);
      b = HH(b, c, d, a, m[i+ 6], 23,  76029189);
      a = HH(a, b, c, d, m[i+ 9],  4, -640364487);
      d = HH(d, a, b, c, m[i+12], 11, -421815835);
      c = HH(c, d, a, b, m[i+15], 16,  530742520);
      b = HH(b, c, d, a, m[i+ 2], 23, -995338651);

      a = II(a, b, c, d, m[i+ 0],  6, -198630844);
      d = II(d, a, b, c, m[i+ 7], 10,  1126891415);
      c = II(c, d, a, b, m[i+14], 15, -1416354905);
      b = II(b, c, d, a, m[i+ 5], 21, -57434055);
      a = II(a, b, c, d, m[i+12],  6,  1700485571);
      d = II(d, a, b, c, m[i+ 3], 10, -1894986606);
      c = II(c, d, a, b, m[i+10], 15, -1051523);
      b = II(b, c, d, a, m[i+ 1], 21, -2054922799);
      a = II(a, b, c, d, m[i+ 8],  6,  1873313359);
      d = II(d, a, b, c, m[i+15], 10, -30611744);
      c = II(c, d, a, b, m[i+ 6], 15, -1560198380);
      b = II(b, c, d, a, m[i+13], 21,  1309151649);
      a = II(a, b, c, d, m[i+ 4],  6, -145523070);
      d = II(d, a, b, c, m[i+11], 10, -1120210379);
      c = II(c, d, a, b, m[i+ 2], 15,  718787259);
      b = II(b, c, d, a, m[i+ 9], 21, -343485551);

      a = (a + aa) >>> 0;
      b = (b + bb) >>> 0;
      c = (c + cc) >>> 0;
      d = (d + dd) >>> 0;
    }

    return crypt$$1.endian([a, b, c, d]);
  };

  // Auxiliary functions
  md5._ff  = function (a, b, c, d, x, s, t) {
    var n = a + (b & c | ~b & d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._gg  = function (a, b, c, d, x, s, t) {
    var n = a + (b & d | c & ~d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._hh  = function (a, b, c, d, x, s, t) {
    var n = a + (b ^ c ^ d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._ii  = function (a, b, c, d, x, s, t) {
    var n = a + (c ^ (b | ~d)) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };

  // Package private blocksize
  md5._blocksize = 16;
  md5._digestsize = 16;

  module.exports = function (message, options) {
    if (message === undefined || message === null)
      throw new Error('Illegal argument ' + message);

    var digestbytes = crypt$$1.wordsToBytes(md5(message, options));
    return options && options.asBytes ? digestbytes :
        options && options.asString ? bin.bytesToString(digestbytes) :
        crypt$$1.bytesToHex(digestbytes);
  };

})();
});

const __$1 = {
  fetch: (tag, key) => {
    fetch(app$1.api[key]).then(res => res.json()).then(res => {
      tag[key] = res;
      tag.completed++;
      if (key === 'profile') {
        const ghash = md5(res.email.toLowerCase().trim()),
              gravatar = `![${tag[key].first_name} ${tag[key].last_name}](https://www.gravatar.com/avatar/${ghash}?s=400)`;
        tag[key].summary = gravatar + tag[key].summary;
      }
      if (tag.completed > 4) {
        tag.loaded = true;
        setTimeout(() => {
          tag.update();
        }, 2500);
      } else {
        tag.update();
      }
    });
  },
  section: () => {
    const hash = location.hash.split('/')[1];
    return hash !== '' && hash !== undefined ? hash : 'profile';
  },
  id: () => {
    const id = location.hash.split('/')[2];
    return id !== '' && id !== undefined ? decodeURI(id) : false;
  }
};

const html$8 = `
  <ui-menu section="{{section}}"></ui-menu>
  <div content hidden="{{!loaded}}" section="{{section}}">
    <logo></logo>
    <h1 if="{{profile}}">{{profile.first_name}}<strong>{{profile.last_name}}</strong></h1>
    <div contact>
      <div email>{{profile.email}}</div>
      <div phone>{{profile.phone}}</div>
    </div>
    <ui-profile gravatar="{{gravatar}}" profile="{{profile}}" if="{{loaded && section === 'profile'}}"></ui-profile>
    <ui-experience experience="{{experience}}" if="{{loaded && section === 'experience'}}"></ui-experience>
    <ui-technology tid="{{id}}" technology="{{technology}}" if="{{loaded && section === 'technology'}}"></ui-technology>
    <ui-education education="{{education}}" if="{{loaded && section === 'education'}}"></ui-education>
    <ui-portfolio portfolio="{{portfolio}}" if="{{loaded && section === 'portfolio'}}"></ui-education>
  </div>
  <ui-throbber hidden="{{loaded}}"></ui-throbber>
`;

riot$1.tag('ui-app', html$8, function (opts) {
  const tag = this,
        root = tag.root;

  tag.completed = 0;
  tag.loaded = false;
  tag.profile = false;
  tag.education = false;
  tag.experience = false;
  tag.technology = false;
  tag.portfolio = false;
  tag.section = __$1.section() || 'profile';
  tag.id = __$1.id();

  tag.on('mount', () => {
    const endpoints = ['profile', 'education', 'experience', 'technology', 'portfolio'],
          content = root.querySelector('[content]');

    endpoints.forEach(ep => {
      __$1.fetch(tag, ep);
    });

    content.addEventListener('click', () => {
      if (document.body.hasAttribute('open')) {
        PubSub.fire('menu:close');
      }
    });

    window.addEventListener('hashchange', () => {
      content.scrollTop = 0;
    });
  });

  window.addEventListener('hashchange', () => {
    tag.section = __$1.section();
    tag.id = __$1.id();
    tag.update();
    PubSub.fire('menu:close');
  });
});

const html$9 = `
  <div if="{{opts.profile}}">
    <h2>Professional Summary</h2>
    <div class="profile-wrapper">
      <markdown code="{{opts.profile.summary}}"></markdown>
    </div>
  </div>
`;

riot$1.tag('ui-profile', html$9, function (opts) {});

const html$a = `
  <h2>Education</h2>
  <education-block education="{{opts.education}}"></education-block>
`;

riot$1.tag('ui-education', html$a, function (opts) {});

const html$b = `
  <h2>Experience</h2>
  <experience-block experience="{{opts.experience}}"></education-block>
`;

riot$1.tag('ui-experience', html$b, function (opts) {});

const html$c = `
  <h2>Technology</h2>
  <grid compact if="{{opts.technology}}">
    <span each="{{tech in opts.technology}}" level="{{tech.level}}">
      <a active="{{opts.tid === tech.name}}" href="#/technology/{{tech.name}}">{{tech.name}}</a>
    </span>
  </grid>
  <div if="{{opts.tid}}">
    <h3>{{opts.tid}}</h2>
    <span each="{{tech in opts.technology}}" level="{{tech.level}}">
      <a active="{{opts.tid === tech.name}}" href="#/technology/{{tech.name}}">{{tech.name}}</a>
    </span>
  </div>
`;

riot$1.tag('ui-technology', html$c, function (opts) {});

const html$d = `
  <h2>Portfolio</h2>
  <portfolio-block portfolio="{{opts.portfolio}}"></portfolio-block>
`;

riot$1.tag('ui-portfolio', html$d, function (opts) {});

// ELEMENTS

// Import all the components

riot$1.settings.skipAnonymousTags = true;
riot$1.settings.brackets = '{{ }}';
riot$1.mount('*');

const __$2 = {
  uid: (topic) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let i = 0, txt = topic.toLowerCase().replace(/[-:\ ]/ig, '_') +'__';
    for (i < 6; i++;) { txt += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return txt;
  },

  publish: (el, topic, info) => {
    if (!el.hOP.call(el.topics, topic)) { return }
    const topics = el.topics[topic],
          keys = Object.keys(topics);
    keys.forEach(key => {
      topics[key](info !== undefined ? info : {});
    });
  },

  subscribe: (el, topic, listener) => {
    const tpc = topic.replace(/[-:\ ]/g, '_'),
          index = __$2.uid(topic);
    if (!el.hOP.call(el.topics, topic)) { el.topics[topic] = {}; }
    el.topics[topic][index] = listener;
    return index;
  },

  unsubscribe: (el, topic, index) => {
    delete el.topics[topic][index];
    if (el.topics[topic] === {}) {
      delete el.topics[topic];
    }
  },

  off: (component, topic, index) => {
    component.on('unmount', () => {
      __$2.unsubscribe(topic, index);
    });
  }
};

class PubSubClass {
  constructor(alias = 'PubSub') {
    this.topics = {};
    this.hOP = this.topics.hasOwnProperty;
    if (!window[alias]) { window[alias] = this; }
  }

  fire(topic, info) { __$2.publish(this, topic, info); }

  on(topic, listener, component = false) {
    const index = __$2.subscribe(this, topic, listener);
    if (component) { __$2.off(component, topic, index); }
  }

  off(topic, index) { __$2.unsubscribe(topic, index); }
}

const __$3 = {
  open: (event) => {
    event.preventDefault();
    const src = event.target.getAttribute('href');
    document.body.insertAdjacentHTML('beforeend', `<div modal><img src="${src}"/><icon is="close" close-modal></icon></div>`);
    riot$1.mount('icon');
    setTimeout(() => {
      document.body.setAttribute('has-modal', '');
    }, 100);
  },
  close: () => {
    document.body.removeAttribute('has-modal');
    setTimeout(() => {
      document.body.removeChild(document.querySelector('[modal]'));
    }, 200);
  }
};

const Modal = () => {
  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
      const t = e.target,
            b = document.body;
      // Open Modal
      if (t.hasAttribute('to-modal')) {
        __$3.open(e);
      }
      // Close Modal
      if (
        t.nodeName !== 'IMG' &&
        t.parentNode === document.querySelector('[modal]') ||
        (t.parentNode === b && b.hasAttribute('has-modal'))
      ) {
        __$3.close();
      }
    });
  });
};

new PubSubClass();
Modal();

PubSub.on('menu:toggle', () => {
  if (document.body.hasAttribute('open')) {
    document.body.removeAttribute('open');
  } else {
    document.body.setAttribute('open', '');
  }
});

PubSub.on('menu:close', () => {
  if (document.body.hasAttribute('open')) {
    document.body.removeAttribute('open');
  }
});
//# sourceMappingURL=base.resumeh.js.map
