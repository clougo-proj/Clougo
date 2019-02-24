//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var classObj = {};
classObj.create = function(logo, sys) {
    const type = {};

    const OBJTYPE_COMPOUND = 0;  // [body, srcmap]
    const OBJTYPE_LIST = 1;
    const OBJTYPE_ARRAY = 2;
    const OBJTYPE_PROC = 3;
    const OBJTYPE_BLOCK = 4;
    const OBJTYPE_ASYNC_RETURN = 7;
    const OBJTYPE_ARRAY_WITH_ORIGIN = 8;

    function makeObject(t, val) {
        if (sys.isUndefined(val)) {
            return [t];
        }

        sys.assert(Array.isArray(val));

        let ret = val.slice(0);
        ret.unshift(t);
        return ret;
    }

    function makeCompound(val) {
        return makeObject(OBJTYPE_COMPOUND, val);
    }
    type.makeCompound = makeCompound;

    function isCompound(token) {
        return (token instanceof Array && token[0] == OBJTYPE_COMPOUND);
    }
    type.isCompound = isCompound;

    function makeLogoList(val) {
        return makeObject(OBJTYPE_LIST, val);
    }
    type.makeLogoList = makeLogoList;

    function isLogoList(token) {
        return (token instanceof Array && token[0] == OBJTYPE_LIST);
    }
    type.isLogoList = isLogoList;

    function length(thing) {
        if (isLogoList(thing) || isLogoArray(thing)) {
            return thing.length - 1;
        }

        if (isLogoArrayWithOrigin(thing)) {
            return thing.length - 2;
        }

        sys.assert(isLogoWord(thing));
        return 1;
    }
    type.length = length;

    function unbox(thing) {
        if (isLogoList(thing) || isLogoArray(thing)) {
            return thing.slice(1);
        }

        if (isLogoArrayWithOrigin(thing)) {
            return thing.slice(1, thing.length - 1);
        }

        sys.assert(isLogoWord(thing));
        return thing;
    }
    type.unbox = unbox;

    function makeLogoArray(val) {
        return makeObject(OBJTYPE_ARRAY, val);
    }
    type.makeLogoArray = makeLogoArray;

    function makeLogoArrayWithOrigin(val, origin) {
        let ret = makeObject(OBJTYPE_ARRAY_WITH_ORIGIN, val);
        ret.push(origin);
        return ret;
    }
    type.makeLogoArrayWithOrigin = makeLogoArrayWithOrigin;

    function getOriginOfLogoArrayWithOrigin(val) {
        return val[val.length - 1];
    }
    type.getOriginOfLogoArrayWithOrigin = getOriginOfLogoArrayWithOrigin;

    function isLogoArray(token) {
        return (token instanceof Array && token[0] == OBJTYPE_ARRAY);
    }
    type.isLogoArray = isLogoArray;

    function isLogoArrayWithOrigin(token) {
        return (token instanceof Array && token[0] == OBJTYPE_ARRAY_WITH_ORIGIN);
    }
    type.isLogoArrayWithOrigin = isLogoArrayWithOrigin;

    function makeLogoProc(val) {
        return makeObject(OBJTYPE_PROC, val);
    }
    type.makeLogoProc = makeLogoProc;

    function isLogoProc(token) {
        return (token instanceof Array && token[0] == OBJTYPE_PROC);
    }
    type.isLogoProc = isLogoProc;

    function makeLogoBlock(val) {
        return makeObject(OBJTYPE_BLOCK, val);
    }
    type.makeLogoBlock = makeLogoBlock;

    function isLogoBlock(token) {
        return (token instanceof Array && token[0] == OBJTYPE_BLOCK);
    }
    type.isLogoBlock = isLogoBlock;

    function makeLogoAsyncReturn(val) {
        return makeObject(OBJTYPE_ASYNC_RETURN, val);
    }
    type.makeLogoAsyncReturn = makeLogoAsyncReturn;

    function isLogoAsyncReturn(obj) {
        return (obj instanceof Array && obj[0] == OBJTYPE_ASYNC_RETURN);
    }
    type.isLogoAsyncReturn = isLogoAsyncReturn;

    function getLogoAsyncReturnValue(obj) {
        sys.assert(isLogoAsyncReturn(obj));
        return obj[1];
    }
    type.getLogoAsyncReturnValue = getLogoAsyncReturnValue;

    function setLogoAsyncReturnValue(obj, val) {
        sys.assert(isLogoAsyncReturn(obj));
        obj[1] = val;
    }
    type.setLogoAsyncReturnValue = setLogoAsyncReturnValue;

    const isLogoWord = (function(){
        return function(v) {
            return typeof v === "string" || typeof v === "number";
        };
    })();
    type.isLogoWord = isLogoWord;

    function isLogoNumber(s) {
        return (typeof s === "number") || (typeof s=== "string" && !isNaN(Number(s)));
    }
    type.isLogoNumber = isLogoNumber;

    const isQuotedLogoWord = (function(){
        const reIsWord = /^"\S*$/;
        return function(v) {
            return typeof v !== "object" && reIsWord.test(v);
        };
    })();
    type.isQuotedLogoWord = isQuotedLogoWord;

    function unquoteLogoWord(v) {
        return v.substr(1).replace(/\\/g, "");
    }
    type.unquoteLogoWord = unquoteLogoWord;

    function isStringLiteral(token) {
        return (typeof token == "string" && token.charAt(0) == "\"" && !isLogoBoolean(token));
    }
    type.isStringLiteral = isStringLiteral;

    function isLogoBoolean(token) {
        return (sys.equalToken(token, "\"true") || sys.equalToken(token, "\"false"));
    }
    type.isLogoBoolean = isLogoBoolean;

    function isLogoVarRef(token) {
        return (typeof token == "string" && token.charAt(0) == ":");
    }
    type.isLogoVarRef = isLogoVarRef;

    function isNotLogoFalse(val) {
        return val != false && val != "false";
    }
    type.isNotLogoFalse = isNotLogoFalse;

    function getVarValue(varname, srcmap) {
        const curScope = logo.env.findLogoVarScope(varname);
        if (!(varname in curScope)) {
            throw logo.type.LogoException.create("VAR_HAS_NO_VALUE", [varname], srcmap, Error().stack);
        }

        return curScope[varname];
    }
    type.getVarValue = getVarValue;

    function logoToString(v, outterBracket) {
        if (sys.isUndefined(outterBracket)) {
            outterBracket = false;
        }

        if (isCompound(v)) {
            v = v[1];
        }

        if (isQuotedLogoWord(v)) {
            return unquoteLogoWord(v);
        }

        if (sys.isNull(v)) {
            return outterBracket ? "[]" : "";
        }

        if (!(isLogoArray(v) || isLogoList(v) || isLogoArrayWithOrigin(v))) {
            return v;
        }

        function logoToStringHelper(v) {
            return type.isLogoArray(v) ? "{" +  v.slice(1).map(logoToStringHelper).join(" ") + "}" :
                type.isLogoList(v) ? "[" +  v.slice(1).map(logoToStringHelper).join(" ") + "]" :
                    type.isLogoArrayWithOrigin(v) ? "{" +  v.slice(1, v.length - 1).map(logoToStringHelper).join(" ") + "}" :
                        sys.isNull(v) ? "[]" : v;
        }

        return type.isLogoArray(v) || type.isLogoArrayWithOrigin(v) || (outterBracket && type.isLogoList(v)) ? logoToStringHelper(v) :
            v.slice(1).map(logoToStringHelper).join(" ");
    }
    type.logoToString = logoToString;

    function verifyOrThrow(predicate, exceptionType, getMessage) {
        if (!predicate) {
            throw logo.type.LogoException.create(exceptionType, getMessage(), null, Error().stack);
        }
    }
    type.verifyOrThrow = verifyOrThrow;

    const LogoException = (function() {
        const codemap = {
            // name : code
            "NOT_ENOUGH_INPUTS"     : 6,
            "INVALID_INPUT"         : 7,
            "TOO_MUCH_INSIDE_PAREN" : 8,
            "UNACTIONABLE_DATUM"    : 9,
            "VAR_HAS_NO_VALUE"      : 11,
            "UNKNOWN_PROC"          : 13,
            "LAST_ERROR_CODE"       : 1024,
            "STOP"                  : 65535,
            "OUTPUT"                : 65534,
            "READX"                 : 65533,
            "CUSTOM"                : 65532
        };

        const msgmap = {
            // code : message
            6  : "Not enough inputs to {0}",
            7  : "{0} doesn't like {1} as input",
            8  : "Too much inside ()'s",
            9  : "You don't say what to do with {0}",
            11 : "{0} has no value",
            13 : "I don't know how to {0}",
            65532 : "Can't find catch tag for {0}"
        };

        const LogoException = {};

        function getCode(name) {
            return (name in codemap) ? codemap[name] : undefined;
        }
        LogoException.getCode = getCode;

        function getMessage(code) {
            return (code in msgmap) ? msgmap[code] : undefined;
        }
        LogoException.getMessage = getMessage;

        LogoException.prototype = {
            isError: function() { return this._code < codemap.LAST_ERROR_CODE; },
            isCustom: function() { return this._code == codemap.CUSTOM; },
            codeEquals: function(name) { return this._code == getCode(name); },
            getCode: function() { return this._code; },
            getValue: function() { return this._value; },
            getSrcmap: function() { return this._srcmap; },
            getStack : function() { return this._stack; },
            withSrcmap: function(srcmap) { this._srcmap = srcmap; return this; },
            formatMessage: function() {
                const msg = getMessage(this._code);
                if (typeof msg !== "string") {
                    return "";
                }

                if (sys.isUndefined(this._value)) {
                    return msg;
                }

                if (!Array.isArray(this._value)) {
                    return msg.replace(/\{0\}/g, this._value);
                }

                return sys.isUndefined(this._value) ? msg :
                    msg.replace(/\{0\}/g, logo.type.logoToString(this._value[0], true))
                        .replace(/\{1\}/g, logo.type.logoToString(this._value[1], true));
            }
        };

        LogoException.create = function(name, value, srcmap, stack) {
            const obj = Object.create(LogoException.prototype);
            sys.assert(name in codemap);
            obj._code = getCode(name);
            obj._value = value;
            obj._srcmap = srcmap;
            obj._stack = sys.isUndefined(stack) ? undefined : logo.env.getLogoStack(stack);
            return obj;
        };

        LogoException.is = function(obj) {
            return obj.__proto__ === LogoException.prototype;
        };

        return LogoException;
    })();
    type.LogoException = LogoException;

    return type;
};

if (typeof exports != "undefined") {
    exports.classObj = classObj;
}
