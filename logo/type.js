//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var $classObj = {};
$classObj.create = function(logo, sys) {
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

    const PALETTE = {
        0: [0, 0, 0],
        1: [0, 0, 255],
        2: [0, 255, 0],
        3: [0, 255, 255],
        4: [255, 0, 0],
        5: [255, 0, 255],
        6: [255, 255, 0],
        15: [255, 255, 255],
        7: [155, 96, 59],
        8: [197, 136, 18],
        9: [100, 162, 64],
        10: [120, 187, 187],
        11: [255, 149, 119],
        12: [144, 113, 208],
        13: [255, 163, 0],
        14: [183, 183, 183],
    };

    const NAMED_COLOR = {
        "aliceblue": [240, 248, 255],
        "antiquewhite": [250, 235, 215],
        "aqua": [0, 255, 255],
        "aquamarine": [127, 255, 212],
        "azure": [240, 255, 255],
        "beige": [245, 245, 220],
        "bisque": [255, 228, 196],
        "black": [0, 0, 0],
        "blanchedalmond": [255, 235, 205],
        "blue": [0, 0, 255],
        "blueviolet": [138, 43, 226],
        "brown": [165, 42, 42],
        "burlywood": [222, 184, 135],
        "cadetblue": [95, 158, 160],
        "chartreuse": [127, 255, 0],
        "chocolate": [210, 105, 30],
        "coral": [255, 127, 80],
        "cornflowerblue": [100, 149, 237],
        "cornsilk": [255, 248, 220],
        "crimson": [220, 20, 60],
        "cyan": [0, 255, 255],
        "darkblue": [0, 0, 139],
        "darkcyan": [0, 139, 139],
        "darkgoldenrod": [184, 134, 11],
        "darkgray": [169, 169, 169],
        "darkgreen": [0, 100, 0],
        "darkgrey": [169, 169, 169],
        "darkkhaki": [189, 183, 107],
        "darkmagenta": [139, 0, 139],
        "darkolivegreen": [85, 107, 47],
        "darkorange": [255, 140, 0],
        "darkorchid": [153, 50, 204],
        "darkred": [139, 0, 0],
        "darksalmon": [233, 150, 122],
        "darkseagreen": [143, 188, 143],
        "darkslateblue": [72, 61, 139],
        "darkslategray": [47, 79, 79],
        "darkslategrey": [47, 79, 79],
        "darkturquoise": [0, 206, 209],
        "darkviolet": [148, 0, 211],
        "deeppink": [255, 20, 147],
        "deepskyblue": [0, 191, 255],
        "dimgray": [105, 105, 105],
        "dimgrey": [105, 105, 105],
        "dodgerblue": [30, 144, 255],
        "firebrick": [178, 34, 34],
        "floralwhite": [255, 250, 240],
        "forestgreen": [34, 139, 34],
        "fuchsia": [255, 0, 255],
        "gainsboro": [220, 220, 220],
        "ghostwhite": [248, 248, 255],
        "gold": [255, 215, 0],
        "goldenrod": [218, 165, 32],
        "gray": [128, 128, 128],
        "green": [0, 128, 0],
        "greenyellow": [173, 255, 47],
        "grey": [128, 128, 128],
        "honeydew": [240, 255, 240],
        "hotpink": [255, 105, 180],
        "indianred": [205, 92, 92],
        "indigo": [75, 0, 130],
        "ivory": [255, 255, 240],
        "khaki": [240, 230, 140],
        "lavender": [230, 230, 250],
        "lavenderblush": [255, 240, 245],
        "lawngreen": [124, 252, 0],
        "lemonchiffon": [255, 250, 205],
        "lightblue": [173, 216, 230],
        "lightcoral": [240, 128, 128],
        "lightcyan": [224, 255, 255],
        "lightgoldenrodyellow": [250, 250, 210],
        "lightgray": [211, 211, 211],
        "lightgreen": [144, 238, 144],
        "lightgrey": [211, 211, 211],
        "lightpink": [255, 182, 193],
        "lightsalmon": [255, 160, 122],
        "lightseagreen": [32, 178, 170],
        "lightskyblue": [135, 206, 250],
        "lightslategray": [119, 136, 153],
        "lightslategrey": [119, 136, 153],
        "lightsteelblue": [176, 196, 222],
        "lightyellow": [255, 255, 224],
        "lime": [0, 255, 0],
        "limegreen": [50, 205, 50],
        "linen": [250, 240, 230],
        "magenta": [255, 0, 255],
        "maroon": [128, 0, 0],
        "mediumaquamarine": [102, 205, 170],
        "mediumblue": [0, 0, 205],
        "mediumorchid": [186, 85, 211],
        "mediumpurple": [147, 112, 216],
        "mediumseagreen": [60, 179, 113],
        "mediumslateblue": [123, 104, 238],
        "mediumspringgreen": [0, 250, 154],
        "mediumturquoise": [72, 209, 204],
        "mediumvioletred": [199, 21, 133],
        "midnightblue": [25, 25, 112],
        "mintcream": [245, 255, 250],
        "mistyrose": [255, 228, 225],
        "moccasin": [255, 228, 181],
        "navajowhite": [255, 222, 173],
        "navy": [0, 0, 128],
        "oldlace": [253, 245, 230],
        "olive": [128, 128, 0],
        "olivedrab": [107, 142, 35],
        "orange": [255, 165, 0],
        "orangered": [255, 69, 0],
        "orchid": [218, 112, 214],
        "palegoldenrod": [238, 232, 170],
        "palegreen": [152, 251, 152],
        "paleturquoise": [175, 238, 238],
        "palevioletred": [216, 112, 147],
        "papayawhip": [255, 239, 213],
        "peachpuff": [255, 218, 185],
        "peru": [205, 133, 63],
        "pink": [255, 192, 203],
        "plum": [221, 160, 221],
        "powderblue": [176, 224, 230],
        "purple": [128, 0, 128],
        "red": [255, 0, 0],
        "rosybrown": [188, 143, 143],
        "royalblue": [65, 105, 225],
        "saddlebrown": [139, 69, 19],
        "salmon": [250, 128, 114],
        "sandybrown": [244, 164, 96],
        "seagreen": [46, 139, 87],
        "seashell": [255, 245, 238],
        "sienna": [160, 82, 45],
        "silver": [192, 192, 192],
        "skyblue": [135, 206, 235],
        "slateblue": [106, 90, 205],
        "slategray": [112, 128, 144],
        "slategrey": [112, 128, 144],
        "snow": [255, 250, 250],
        "springgreen": [0, 255, 127],
        "steelblue": [70, 130, 180],
        "tan": [210, 180, 140],
        "teal": [0, 128, 128],
        "thistle": [216, 191, 216],
        "tomato": [255, 99, 71],
        "turquoise": [64, 224, 208],
        "violet": [238, 130, 238],
        "wheat": [245, 222, 179],
        "white": [255, 255, 255],
        "whitesmoke": [245, 245, 245],
        "yellow": [255, 255, 0],
        "yellowgreen": [154, 205, 50],
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

    function annotateSrcmap(obj, srcmap) {
        obj[0] = srcmap;
        return obj;
    }
    type.annotateSrcmap = annotateSrcmap;

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

    function isRGB(rgb) {
        return Array.isArray(rgb) && rgb.length == 3 &&
                sys.isInteger(rgb[0]) && rgb[0] >= 0 && rgb[0] <= 255 &&
                sys.isInteger(rgb[1]) && rgb[1] >= 0 && rgb[1] <= 255 &&
                sys.isInteger(rgb[2]) && rgb[2] >= 0 && rgb[2] <= 255;
    }
    type.isRGB = isRGB;

    function isRGBList(val) {
        return isLogoList(val) && listLength(val) == 3 &&
                sys.isInteger(listItem(1, val)) && listItem(1, val) >= 0 && listItem(1, val) <= 255 &&
                sys.isInteger(listItem(2, val)) && listItem(1, val) >= 0 && listItem(2, val) <= 255 &&
                sys.isInteger(listItem(3, val)) && listItem(1, val) >= 0 && listItem(3, val) <= 255;
    }
    type.isRGBList = isRGBList;

    function isPaletteIndex(color) {
        return color in PALETTE;
    }
    type.isPaletteIndex = isPaletteIndex;

    function getPaletteRGB(index) {
        return PALETTE[index];
    }
    type.getPaletteRGB = getPaletteRGB;

    function isNamedColor(color) {
        return typeof color === "string" && color.toLowerCase() in NAMED_COLOR;
    }
    type.isNamedColor = isNamedColor;

    function isColor(color) {
        return isPaletteIndex(color) || logo.type.isRGBList(color) || isNamedColor(color);
    }
    type.isColor = isColor;

    function isEmptyString(value) {
        return typeof value === "string" && value.length === 0;
    }
    type.isEmptyString = isEmptyString;

    function isEmptyList(value) {
        return isLogoList(value) && listLength(value) === 0;
    }
    type.isEmptyList = isEmptyList;

    function getRGB(color) {
        if (isPaletteIndex(color)) {
            return logo.type.getPaletteRGB(color);
        }

        if (isNamedColor(color)) {
            return NAMED_COLOR[color];
        }

        sys.assert(isRGBList(color));
        return unbox(color);
    }
    type.getRGB = getRGB;

    type.LIST_ORIGIN = 1;

    function listButFirst(list) {
        return makeLogoList(list.slice(2));
    }
    type.listButFirst = listButFirst;

    function listButLast(list) {
        return makeLogoList(list.slice(1, list.length - 1));
    }
    type.listButLast = listButLast;

    function listMaxIndex(list) {
        return list.length - 1;
    }
    type.listMaxIndex = listMaxIndex;

    function listIndexWithinRange(index, list) {
        return index >= type.LIST_ORIGIN && index <= listMaxIndex(list);
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

    function listEqual(a, b) {
        let length = listLength(a);
        for (let i = 0; i < length; i++) {
            if (!equal(listItem(i, a), listItem(i, b))) {
                return false;
            }
        }

        return true;
    }
    type.listEqual = listEqual;

    function booleanEqual(a, b) {
        return isLogoBoolean(a) && isLogoBoolean(b) && asLogoBoolean(a) === asLogoBoolean(b);
    }
    type.booleanEqual = booleanEqual;

    function arrayOrigin(array) {
        return array[1];
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
        array[index - arrayOrigin(array) + 2] = val;
    }
    type.arraySetItem = arraySetItem;

    function arrayItem(index, array) {
        return array[index - arrayOrigin(array) + 2];
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
        ret.splice(1, 0, origin);
        return ret;
    }
    type.makeLogoArray = makeLogoArray;

    function makeLogoArrayBySize(size, origin) {
        let ret = makeObject(OBJTYPE.ARRAY, Array.apply(null, Array(size)).map(function() { return null; }));
        ret.splice(1, 0, origin);
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

    function checkAndThrow(predicate, exception, value) {
        if (predicate) {
            throw logo.type.LogoException.create(exception, [logo.env.getPrimitiveName(), logo.type.toString(value, true)], null, Error().stack);
        }
    }
    type.checkAndThrow = checkAndThrow;

    function checkMinInputCount(value) {
        checkAndThrow(!(value >= logo.lrt.util.getPrimitiveParamMinCount(logo.env.getPrimitiveName())),
            "NOT_ENOUGH_INPUTS", value);
    }
    type.checkMinInputCount = checkMinInputCount;

    function checkInputBoolean(value) {
        checkAndThrow(!logo.type.isLogoBoolean(value), "INVALID_INPUT", value);
    }
    type.checkInputBoolean = checkInputBoolean;

    function checkInputWord(value) {
        checkAndThrow(!logo.type.isLogoWord(value), "INVALID_INPUT", value);
    }
    type.checkInputWord = checkInputWord;

    function checkInputInteger(value) {
        checkAndThrow(!sys.isInteger(value), "INVALID_INPUT", value);
    }
    type.checkInputInteger = checkInputInteger;

    function checkInputNumber(value) {
        checkAndThrow(!logo.type.isLogoNumber(value), "INVALID_INPUT", value);
    }
    type.checkInputNumber = checkInputNumber;

    function checkInputNonNegNumber(value) {
        checkAndThrow(!(logo.type.isLogoNumber(value) && value >= 0), "INVALID_INPUT", value);
    }
    type.checkInputNonNegNumber = checkInputNonNegNumber;

    function checkInputPosNumber(value) {
        checkAndThrow(!(logo.type.isLogoNumber(value) && value > 0), "INVALID_INPUT", value);
    }
    type.checkInputPosNumber = checkInputPosNumber;

    function checkInputNonEmptyWord(value) {
        checkAndThrow(!(logo.type.isLogoWord(value) && value.length >= 1), "INVALID_INPUT", value);
    }
    type.checkInputNonEmptyWord = checkInputNonEmptyWord;

    function checkInputOneLetterWord(value) {
        checkAndThrow(!(logo.type.isLogoWord(value) && value.length == 1), "INVALID_INPUT", value);
    }
    type.checkInputOneLetterWord = checkInputOneLetterWord;

    function checkIndexWithinWordRange(index, word) {
        checkAndThrow(index < 1 || index > word.length, "INVALID_INPUT", index);
    }
    type.checkIndexWithinWordRange = checkIndexWithinWordRange;

    function checkInputList(value) {
        checkAndThrow(!logo.type.isLogoList(value), "INVALID_INPUT", value);
    }
    type.checkInputList = checkInputList;

    function checkInputNonEmptyList(value) {
        checkAndThrow(!(logo.type.isLogoList(value) && logo.type.length(value) >= 1), "INVALID_INPUT", value);
    }
    type.checkInputNonEmptyList = checkInputNonEmptyList;

    function checkInputColor(value) {
        checkAndThrow(!logo.type.isColor(value), "INVALID_INPUT", value);
    }
    type.checkInputColor = checkInputColor;

    function checkInputPensize(value) {
        checkAndThrow(!((sys.isInteger(value) && value > 0) || (logo.type.isLogoList(value) &&
            logo.type.length(value) == 2 && listItem(1, value) > 0 && listItem(2, value) > 0)),
        "INVALID_INPUT", value);
    }
    type.checkInputPensize = checkInputPensize;

    function checkInput2DCartesianCoordinate(value) {
        checkAndThrow(!(logo.type.isLogoList(value) && logo.type.length(value) == 2 && logo.type.isLogoNumber(
            logo.type.listItem(1, value)) && logo.type.isLogoNumber(logo.type.listItem(2, value))),
        "INVALID_INPUT", value);
    }
    type.checkInput2DCartesianCoordinate = checkInput2DCartesianCoordinate;

    function checkIndexWithinListRange(index, list) {
        checkAndThrow(!logo.type.listIndexWithinRange(index, list), "INVALID_INPUT", index);
    }
    type.checkIndexWithinListRange = checkIndexWithinListRange;

    function checkInputArray(value) {
        checkAndThrow(!logo.type.isLogoArray(value), "INVALID_INPUT", value);
    }
    type.checkInputArray = checkInputArray;

    function checkIndexWithinArrayRange(index, array) {
        checkAndThrow(!logo.type.arrayIndexWithinRange(index, array), "INVALID_INPUT", index);
    }
    type.checkIndexWithinArrayRange = checkIndexWithinArrayRange;

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
        return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
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
        return v.substring(1).replace(/\\/g, "");
    }
    type.unquoteLogoWord = unquoteLogoWord;

    function isStringLiteral(token) {
        return (typeof token == "string" && token.charAt(0) == "\"" && !isLogoBoolean(token));
    }
    type.isStringLiteral = isStringLiteral;

    function isLogoBoolean(token) {
        return typeof token === "boolean" || sys.equalToken(token, "true") || sys.equalToken(token, "false");
    }
    type.isLogoBoolean = isLogoBoolean;

    function asLogoBoolean(value) {
        return typeof value === "boolean" ? value :
            (sys.equalToken(value, "true")) ? true : false;
    }
    type.asLogoBoolean = asLogoBoolean;

    function isLogoVarRef(token) {
        return (typeof token == "string" && token.charAt(0) == ":");
    }
    type.isLogoVarRef = isLogoVarRef;

    function isNotLogoFalse(val) {
        return val != false && val != "false";
    }
    type.isNotLogoFalse = isNotLogoFalse;

    function isNonNegInteger(value) {
        return sys.isInteger(value) && value >= 0;
    }
    type.isNonNegInteger = isNonNegInteger;

    function srcmapToString(srcmap) {
        return isCompositeSrcmap(srcmap) ? compositeSrcmapToString(srcmap) : simpleSrcmapToString(srcmap);
    }
    type.srcmapToString = srcmapToString;

    function isCompositeSrcmap(value) {
        return Array.isArray(value) && value.length > 0 && Array.isArray(value[0]);
    }
    type.isCompositeSrcmap = isCompositeSrcmap;

    function isSimpleSrcmap(value) {
        return Array.isArray(value) && value.length == 3 &&
            isNonNegInteger(value[0]) && isNonNegInteger(value[1]) && isNonNegInteger(value[2]);
    }
    type.isSimpleSrcmap = isSimpleSrcmap;

    function compositeSrcmapToString(srcmap) {
        return simpleSrcmapToString(srcmap[0]);
    }
    type.compositeSrcmapToString = compositeSrcmapToString;

    function simpleSrcmapToString(srcmap) {
        return srcmap[1] + "," + srcmap[2];
    }
    type.simpleSrcmapToString = simpleSrcmapToString;

    function getVarValue(varname, srcmap) {
        const curScope = logo.env.findLogoVarScope(varname);
        if (!(varname in curScope)) {
            throw logo.type.LogoException.create("VAR_HAS_NO_VALUE", [varname], srcmap, Error().stack);
        }

        return curScope[varname];
    }
    type.getVarValue = getVarValue;

    function equal(a, b) {
        if (isLogoList(a) && isLogoList(b) && listLength(a) == listLength(b)) {
            return listEqual(a, b);
        }

        if (isLogoBoolean(a) || isLogoBoolean(b)) {
            return booleanEqual(a,b);
        }

        return a == b;
    }
    type.equal = equal;

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

        if (sys.isNumber(v)) {
            return (+(v.toPrecision(15))).toString();
        }

        if (!(isLogoList(v) || isLogoArray(v))) {
            return v;
        }

        function toStringHelper(v) {
            return type.isLogoList(v) ? "[" +  v.slice(1).map(toStringHelper).join(" ") + "]" :
                type.isLogoArray(v) ? "{" +  v.slice(2, v.length).map(toStringHelper).join(" ") + "}" :
                    sys.isNull(v) ? "[]" : v;
        }

        return type.isLogoArray(v) || (outterBracket && type.isLogoList(v)) ? toStringHelper(v) :
            v.slice(1).map(toStringHelper).join(" ");
    }
    type.toString = toString;

    const LogoException = (function() {
        const codemap = {
            // name : code
            "NOT_ENOUGH_INPUTS"     : 6,
            "INVALID_INPUT"         : 7,
            "TOO_MUCH_INSIDE_PAREN" : 8,
            "UNACTIONABLE_DATUM"    : 9,
            "VAR_HAS_NO_VALUE"      : 11,
            "UNKNOWN_PROC"          : 13,
            "CANT_OPEN_FILE"        : 40,
            "LAST_ERROR_CODE"       : 1024,
            "STOP"                  : 65535,
            "OUTPUT"                : 65534,
            "YIELD"                 : 65533,
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
            40 : "I can't open file {0}",
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
    exports.$classObj = $classObj;
}
