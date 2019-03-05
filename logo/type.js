//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var classObj = {};
classObj.create = function(logo, sys) {
    const type = {};

    const OBJTYPE = {
        MIN_VALUE: 0,
        COMPOUND: 0, // [body, srcmap]
        LIST: 1,
        ARRAY: 2,
        PROC: 3,
        BLOCK: 4,
        ASYNC_RETURN: 7,
        MAX_VALUE: 7
    };

    function makeObject(t, val) {
        if (sys.isUndefined(val)) {
            return [t];
        }

        sys.assert(Array.isArray(val));

        let ret = val.slice(0);
        ret.unshift(t);
        return ret;
    }

    function getObjType(obj) {
        return obj[0];
    }
    type.getObjType = getObjType;

    function makeCompound(val) {
        return makeObject(OBJTYPE.COMPOUND, val);
    }
    type.makeCompound = makeCompound;

    function isCompound(token) {
        return (token instanceof Array && token[0] == OBJTYPE.COMPOUND);
    }
    type.isCompound = isCompound;

    function makeLogoList(val) {
        return makeObject(OBJTYPE.LIST, val);
    }
    type.makeLogoList = makeLogoList;

    function isLogoObj(val) {
        return Array.isArray(val) && val.length > 0 &&
            val[0] >= OBJTYPE.MIN_VALUE & val[0] <= OBJTYPE.MAX_VALUE;
    }
    type.isLogoObj = isLogoObj;

    function isLogoList(token) {
        return (token instanceof Array && token[0] == OBJTYPE.LIST);
    }
    type.isLogoList = isLogoList;

    function listOrigin() {
        return 1;
    }
    type.listOrigin = listOrigin;

    function listButFirst(list) {
        return makeLogoList(list.slice(2));
    }
    type.listButFirst = listButFirst;

    function listMaxIndex(list) {
        return list.length - 1;
    }
    type.listMaxIndex = listMaxIndex;

    function listIndexWithinRange(index, list) {
        return index >= listOrigin() && index <= listMaxIndex(list);
    }
    type.listIndexWithinRange = listIndexWithinRange;

    function listSetItem(index, list, val) {
        list[index] = val;
    }
    type.listSetItem = listSetItem;

    function listItem(index, list) {
        return list[index];
    }
    type.listItem = listItem;

    function listLength(list) {
        return list.length - 1;
    }
    type.listLength = listLength;

    function arrayOrigin(array) {
        return array[array.length - 1];
    }
    type.arrayOrigin = arrayOrigin;

    function arrayMaxIndex(array) {
        return arrayOrigin(array) + array.length - 3;
    }
    type.arrayMaxIndex = arrayMaxIndex;

    function arrayIndexWithinRange(index, array) {
        return index >= arrayOrigin(array) && index <= arrayMaxIndex(array);
    }
    type.arrayIndexWithinRange = arrayIndexWithinRange;

    function arraySetItem(index, array, val) {
        array[index - arrayOrigin(array) + 1] = val;
    }
    type.arraySetItem = arraySetItem;

    function arrayItem(index, array) {
        return array[index - arrayOrigin(array) + 1];
    }
    type.arrayItem = arrayItem;

    function arrayLength(array) {
        return array.length - 2;
    }
    type.arrayLength = arrayLength;

    const length = (function() {
        const getLengthHelper = {};

        getLengthHelper[OBJTYPE.LIST] = listLength;
        getLengthHelper[OBJTYPE.ARRAY] = arrayLength;

        return function(thing) {
            if (isLogoWord(thing)) {
                return 1;
            }

            sys.assert(isLogoObj(thing) && thing[0] in getLengthHelper);
            return getLengthHelper[thing[0]](thing);
        };
    })();
    type.length = length;

    const unbox = (function() {
        const unboxHelper = {};

        unboxHelper[OBJTYPE.LIST] = function(obj) { return obj.slice(1); };

        unboxHelper[OBJTYPE.ARRAY] =
            function(obj) {
                return obj.slice(1, obj.length - 1);
            };

        return function(thing) {
            if (isLogoWord(thing)) {
                return thing;
            }

            sys.assert(isLogoObj(thing) && thing[0] in unboxHelper);
            return unboxHelper[thing[0]](thing);
        };
    })();
    type.unbox = unbox;

    function makeLogoArray(val, origin) {
        if (sys.isUndefined(origin)) {
            origin = 1;
        }

        let ret = makeObject(OBJTYPE.ARRAY, val);
        ret.push(origin);
        return ret;
    }
    type.makeLogoArray = makeLogoArray;

    function makeLogoArrayBySize(size, origin) {
        let ret = makeObject(OBJTYPE.ARRAY, Array.apply(null, Array(size)).map(function() { return null; }));
        ret.push(origin);
        return ret;
    }
    type.makeLogoArrayBySize = makeLogoArrayBySize;

    function isLogoArray(token) {
        return (token instanceof Array && token[0] == OBJTYPE.ARRAY);
    }
    type.isLogoArray = isLogoArray;

    function makeLogoProc(val) {
        return makeObject(OBJTYPE.PROC, val);
    }
    type.makeLogoProc = makeLogoProc;

    function isLogoProc(token) {
        return (token instanceof Array && token[0] == OBJTYPE.PROC);
    }
    type.isLogoProc = isLogoProc;

    function makeLogoBlock(val) {
        return makeObject(OBJTYPE.BLOCK, val);
    }
    type.makeLogoBlock = makeLogoBlock;

    function isLogoBlock(token) {
        return (token instanceof Array && token[0] == OBJTYPE.BLOCK);
    }
    type.isLogoBlock = isLogoBlock;

    function makeLogoAsyncReturn(val) {
        return makeObject(OBJTYPE.ASYNC_RETURN, val);
    }
    type.makeLogoAsyncReturn = makeLogoAsyncReturn;

    function isLogoAsyncReturn(obj) {
        return (obj instanceof Array && obj[0] == OBJTYPE.ASYNC_RETURN);
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

    function isLogoWord(v){
        return typeof v === "string" || typeof v === "number";
    }
    type.isLogoWord = isLogoWord;

    function wordGetItem(index, word) {
        return word[index - 1];
    }
    type.wordGetItem = wordGetItem;

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

    function toString(v, outterBracket) {
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

        if (!(isLogoList(v) || isLogoArray(v))) {
            return v;
        }

        function toStringHelper(v) {
            return type.isLogoList(v) ? "[" +  v.slice(1).map(toStringHelper).join(" ") + "]" :
                type.isLogoArray(v) ? "{" +  v.slice(1, v.length - 1).map(toStringHelper).join(" ") + "}" :
                    sys.isNull(v) ? "[]" : v;
        }

        return type.isLogoArray(v) || (outterBracket && type.isLogoList(v)) ? toStringHelper(v) :
            v.slice(1).map(toStringHelper).join(" ");
    }
    type.toString = toString;

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
                    msg.replace(/\{0\}/g, logo.type.toString(this._value[0], true))
                        .replace(/\{1\}/g, logo.type.toString(this._value[1], true));
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
