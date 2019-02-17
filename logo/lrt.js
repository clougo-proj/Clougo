//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's runtime library
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

var classObj = {};
classObj.create = function(logo, sys) {
    const lrt = {};

    function primitivePi() {
        return Math.PI;
    }

    function primitiveSentence() {

        const args = Array.prototype.slice.call(arguments);
        const sentence = logo.type.makeLogoList();

        for (let i in args) {
            let item = args[i];
            if (logo.type.isLogoList(item)) {
                for (let j = 1; j < item.length; j++) {
                    sentence.push(item[j]);
                }
            } else if (logo.type.isLogoWord(item)) {
                sentence.push(item);
            } else {
                throw logo.type.LogoException.create("INVALID_INPUT", ["setence", logo.type.logoToString(item, true)], null, Error().stack);
            }
        }

        return sentence;
    }

    function primitiveWord() {
        const args = Array.prototype.slice.call(arguments);
        let word = "";

        for (let i in args) {
            let item = args[i];
            if (!logo.type.isLogoWord(item)) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["word", logo.type.logoToString(item, true)], null, Error().stack);
            }

            word += item;
        }

        return word;
    }

    function primitiveArray(size, origin) {
        if (sys.isUndefined(origin)) {
            return logo.type.makeLogoArray(Array.apply(null, Array(size)).map(function() { return null; }));
        }

        return logo.type.makeLogoArrayWithOrigin(Array.apply(null, Array(size)).map(function() { return null; }), origin);
    }

    function primitiveFirst(thing) {
        if (logo.type.isLogoWord(thing)) {
            if (typeof thing === "number") {
                thing = thing.toString();
            }

            if (thing.length < 1) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["first", "||"], null, Error().stack);
            }

            return thing.substr(0, 1);
        }

        if (logo.type.isLogoList(thing)) {
            if (thing.length < 2) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["first", "[]"], null, Error().stack);
            }

            return thing[1];
        }

        if (logo.type.isLogoArray(thing)) {
            return 1; // index of first element;
        }

        throw logo.type.LogoException.create("INVALID_INPUT", ["first", logo.type.logoToString(thing)], null, Error().stack);
    }

    function primitiveEmptyp(thing) {
        return (typeof thing === "string" && thing.length == 0) ||
            (logo.type.isLogoList(thing) && thing.length < 2);
    }

    function primitiveButfirstHelper(primitiveName, thing) {
        if (logo.type.isLogoWord(thing)) {
            if (typeof thing === "number") {
                thing = thing.toString();
            }

            if (thing.length < 1) {
                throw logo.type.LogoException.create("INVALID_INPUT", [primitiveName, "||"], null, Error().stack);
            }

            return thing.substr(1);
        }

        if (logo.type.isLogoList(thing)) {
            if (thing.length < 2) {
                throw logo.type.LogoException.create("INVALID_INPUT", [primitiveName, "[]"], null, Error().stack);
            }

            let ret = thing.slice(2);
            ret.unshift(thing[0]);

            return ret;
        }

        throw logo.type.LogoException.create("INVALID_INPUT", [primitiveName, logo.type.logoToString(thing)], null, Error().stack);
    }

    function primitiveButfirst(thing) {
        return primitiveButfirstHelper("butfirst", thing);
    }

    function primitiveBf(thing) {
        return primitiveButfirstHelper("bf", thing);
    }

    function primitiveFput(thing, list) {
        if (logo.type.isLogoWord(list)) {
            if (!logo.type.isLogoWord(thing) || thing.length != 1) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["fput", logo.type.logoToString(list)], null, Error().stack);
            }

            return thing.concat(list);
        }

        if (!logo.type.isLogoList(list)) {
            throw logo.type.LogoException.create("INVALID_INPUT", ["fput", logo.type.logoToString(list)], null, Error().stack);
        }

        let newlist = list.slice(0);
        newlist.splice(1, 0, thing);
        return newlist;
    }

    function primitiveLput(thing, list) {
        if (logo.type.isLogoWord(list)) {
            if (!logo.type.isLogoWord(thing) || thing.length != 1) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["lput0", logo.type.logoToString(list)], null, Error().stack);
            }

            return list.concat(thing);
        }

        if (!logo.type.isLogoList(list)) {
            throw logo.type.LogoException.create("INVALID_INPUT", ["lput1", logo.type.logoToString(list)], null, Error().stack);
        }

        let newlist = list.slice(0);
        newlist.push(thing);
        return newlist;
    }

    function primitiveMake(varname, val) {
        logo.env.findLogoVarScope(varname)[varname] = val;
    }

    function primitiveAnd(a, b) {
        return a && b;
    }

    function primitiveOr(a, b) {
        return a || b;
    }

    function primitiveLocal() {
        let args = Array.prototype.slice.call(arguments);
        let ptr = logo.env._scopeStack.length - 1;

        args.forEach(function(varname){
            logo.env._scopeStack[ptr][varname] = undefined;
        });
    }

    function primitiveMakelocal(varname, val) {
        let ptr = logo.env._scopeStack.length - 1;
        logo.env._scopeStack[ptr][varname] = val;
    }

    function primitiveSetitem(index, array, val) {
        if (logo.type.isLogoArray(array)) {
            if (!(index > 0 && index < array.length)) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["setitem", logo.type.logoToString(index, true)], undefined, Error().stack);
            }

            array[index] = val;
            return;
        }

        if (!logo.type.isLogoArrayWithOrigin(array)) {
            throw logo.type.LogoException.create("INVALID_INPUT", ["setitem", logo.type.logoToString(array, true)], undefined, Error().stack);
        }

        let origin = array[array.length - 1];
        if (index - origin >= 0 && index - origin < array.length - 1) {
            array[index - origin + 1] = val;
        }
    }

    function primitiveItem(index, thing) {
        if (logo.type.isLogoArray(thing)) {
            let ret = thing[index];
            if (index == 0 || ret === undefined) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["item", index], undefined, Error().stack);
            }

            return ret;
        }

        if (logo.type.isLogoWord(thing)) {
            if (!(index >= 0 && index < thing.length)) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["item", index], undefined, Error().stack);
            }

            return thing[index - 1];
        }

        if (!logo.type.isLogoArrayWithOrigin(thing)) {
            index -= thing[-1][0] - 1;
            let ret = thing[index];
            if (index == -1 || index == 0 || ret === undefined) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["item", index], undefined, Error().stack);
            }

            return ret;
        }
    }

    function primitivePrint() {
        let args = Array.prototype.slice.call(arguments);
        logo.io.stdout(args.map(function(v) { return logo.type.logoToString(v);}).join(" "));
    }

    function primitiveShow() {
        let args = Array.prototype.slice.call(arguments);
        logo.io.stdout(args.map(function(v){ return logo.type.logoToString(v, true);}).join(" "));
    }

    function primitiveType() {
        let args = Array.prototype.slice.call(arguments);
        logo.io.stdoutn(args.map(function(v) { return logo.type.logoToString(v);}).join(""));
    }

    function primitiveReadlist() {  // eslint-disable-line no-unused-vars
        let userInput = "";
        function readListHelper() {
            if (userInput != "") {
                return userInput;
            }
        }

        return readListHelper();
    }

    function primitiveLessp(a, b) {
        return a < b;
    }

    function primitiveLessequalp(a, b) {
        return a <= b;
    }

    function primitiveGreaterp(a, b) {
        return a > b;
    }

    function primitiveGreaterequalp(a, b) {
        return a >= b;
    }

    function primitiveEqualp(a, b) {
        return a == b;
    }

    function primitiveMinus(a) {
        return -a;
    }

    function primitiveQuotient(opnd1, opnd2) {
        return opnd1 / opnd2;
    }

    function primitiveProduct(opnd1, opnd2) {
        return opnd1 * opnd2;
    }

    function primitiveRemainder(opnd1, opnd2) {
        return opnd1 % opnd2;
    }

    function primitiveSum(opnd1, opnd2) {
        return opnd1 + opnd2;
    }

    function primitiveDifference(opnd1, opnd2) {
        return opnd1 - opnd2;
    }

    function primitiveSqrt(opnd) {
        logo.type.verifyOrThrow(logo.type.isLogoNumber(opnd) && opnd >= 0, "INVALID_INPUT",
            function() { return ["sqrt", logo.type.logoToString(opnd, true)]; });

        return Math.sqrt(opnd);
    }

    function primitiveLog10(opnd) {
        logo.type.verifyOrThrow(logo.type.isLogoNumber(opnd) && opnd > 0, "INVALID_INPUT",
            function() { return ["log10", logo.type.logoToString(opnd, true)]; });

        return Math.log10(opnd);
    }

    function primitiveRound(opnd) {
        let sign = Math.sign(opnd);
        return sign == 0 ? 0 :
            sign > 0 ? Math.round(opnd) :
                - Math.round(-opnd);
    }

    function primitiveThrow(tag, value) {
        throw logo.type.LogoException.create("CUSTOM", [tag, value], null, Error().stack);
    }

    function primitiveReadword() {
        if (logo.env.hasUserInput()) {
            return logo.env.getUserInput();
        }

        let ret = logo.type.makeLogoAsyncReturn();
        function doWhileLoopBody() {
            logo.env.async(function() {
                throw logo.type.LogoException.create("READX");
            }, function() {
                if (!logo.env.hasUserInput()) {
                    doWhileLoopBody();
                }
            });
        }

        logo.env.async(function() {
            doWhileLoopBody();
        }, function() {
            let userInput = logo.env.getUserInput();
            sys.trace(JSON.stringify(userInput), "tmp");
            logo.type.setLogoAsyncReturnValue(ret, userInput);
        });

        return ret;
    }

    function primitiveTimeMilli() {
        return new Date().getTime();
    }

    let primitive = {
        "pi": primitivePi,

        "forward": logo.turtle.forward,
        "fd": logo.turtle.forward,

        "back": logo.turtle.back,
        "bk": logo.turtle.back,

        "left": logo.turtle.left,
        "lt": logo.turtle.left,

        "right": logo.turtle.right,
        "rt": logo.turtle.right,

        "home": logo.turtle.home,

        "clearscreen": logo.turtle.clearscreen,
        "cs": logo.turtle.clearscreen,
        "draw": logo.turtle.clearscreen,

        "clean": logo.turtle.clean,

        "hideturtle": logo.turtle.hideturtle,
        "ht": logo.turtle.hideturtle,

        "showturtle": logo.turtle.showturtle,
        "st": logo.turtle.showturtle,

        "shownp": logo.turtle.shownp,
        "shown?": logo.turtle.shownp,

        "pendown": logo.turtle.pendown,
        "pd": logo.turtle.pendown,

        "pendownp": logo.turtle.pendownp,
        "pendown?": logo.turtle.pendownp,

        "penup": logo.turtle.penup,
        "pu": logo.turtle.penup,

        "penpaint": logo.turtle.penpaint,
        "pp": logo.turtle.penpaint,
        "ppt": logo.turtle.penpaint,

        "penerase": logo.turtle.penerase,
        "pe": logo.turtle.penerase,

        "penreverse": logo.turtle.penreverse,
        "px": logo.turtle.penreverse,

        "penmode": logo.turtle.penmode,

        "setbackground": logo.turtle.setbackground,
        "setbg": logo.turtle.setbackground,

        "setscreencolor": logo.turtle.setbackground,
        "setsc": logo.turtle.setbackground,

        "setfloodcolor": logo.turtle.setfloodcolor,
        "setfc": logo.turtle.setfloodcolor,

        "setpencolor": logo.turtle.setpencolor,
        "setpc": logo.turtle.setpencolor,

        "setpensize": logo.turtle.setpensize,

        "circle": logo.turtle.circle,

        "circle2": logo.turtle.circle2,

        "arc": logo.turtle.arc,

        "arc2": logo.turtle.arc2,

        "ellipse": logo.turtle.ellipse,

        "ellipse2": logo.turtle.ellipse2,

        "ellipsearc": logo.turtle.ellipsearc,

        "ellipsearc2": logo.turtle.ellipsearc2,

        "label": logo.turtle.label,

        "fill": logo.turtle.fill,

        "setxy": logo.turtle.setxy,

        "setpos": logo.turtle.setpos,

        "setx": logo.turtle.setx,

        "sety": logo.turtle.sety,

        "setheading": logo.turtle.setheading,
        "seth": logo.turtle.setheading,

        "pos": logo.turtle.pos,

        "xcor": logo.turtle.xcor,

        "ycor": logo.turtle.ycor,

        "heading": logo.turtle.heading,

        "towards": logo.turtle.towards,

        "pencolor": logo.turtle.pencolor,

        "pc": logo.turtle.pencolor,

        "floodcolor": logo.turtle.floodcolor,

        "-": primitiveMinus,

        "minus": primitiveMinus,

        "sum": primitiveSum,

        "quotient": primitiveQuotient,

        "product": primitiveProduct,

        "remainder": primitiveRemainder,

        "sqrt": primitiveSqrt,

        "log10": primitiveLog10,

        "round": primitiveRound,

        "lessp": primitiveLessp,

        "lessequalp": primitiveLessequalp,

        "greaterp": primitiveGreaterp,

        "greaterequalp": primitiveGreaterequalp,

        "emptyp": primitiveEmptyp,

        "show": primitiveShow,

        "print": primitivePrint,
        "pr": primitivePrint,

        "type": primitiveType,

        "make": primitiveMake,

        "local": primitiveLocal,

        "makelocal": primitiveMakelocal,

        "item": primitiveItem,

        "setitem": primitiveSetitem,

        "word": primitiveWord,

        "sentence": primitiveSentence,
        "se": primitiveSentence,

        "array": primitiveArray,

        "first": primitiveFirst,

        "butfirst": primitiveButfirst,
        "bf": primitiveBf,

        "fput": primitiveFput,

        "lput": primitiveLput,

        "and": primitiveAnd,

        "or": primitiveOr,

        "readword": primitiveReadword,

        "timemilli": primitiveTimeMilli,

        "throw": primitiveThrow
    };
    lrt.primitive = primitive;

    lrt.util = {};

    const primitiveParamCount = {};
    Object.keys(primitive).map(
        function(k) {
            let l = primitive[k].length;
            primitiveParamCount[k] = [l, l, l]; // [def, min, max]
        });

    // can take infinite inputs inside ()
    primitiveParamCount.local =
    primitiveParamCount.show =
    primitiveParamCount.pr =
    primitiveParamCount.print =
    primitiveParamCount.type = [1, 1, -1];

    primitiveParamCount.se =
    primitiveParamCount.sentence =
    primitiveParamCount.word = [2, 1, -1];

    primitiveParamCount.throw =
    primitiveParamCount.array = [1, 1, 2];

    primitiveParamCount.ellipse =
    primitiveParamCount.ellipse2 =
    primitiveParamCount.arc =
    primitiveParamCount.arc2 = [2, 2, 2];

    primitiveParamCount.ellipsearc =
    primitiveParamCount.ellipsearc2 = [4, 4, 4];

    lrt.primitiveParamCount = primitiveParamCount;

    function getPrimitiveCallTarget(name) {
        return (name in lrt.primitive) ? lrt.primitive[name] : undefined;
    }
    lrt.util.getPrimitiveCallTarget = getPrimitiveCallTarget;

    function getPrimitiveParamCount(name) {
        return (name in lrt.primitiveParamCount) ? lrt.primitiveParamCount[name][0] : undefined;
    }
    lrt.util.getPrimitiveParamCount = getPrimitiveParamCount;

    function getPrimitiveParamMinCount(name) {
        return (name in lrt.primitiveParamCount) ? lrt.primitiveParamCount[name][1] : undefined;
    }
    lrt.util.getPrimitiveParamMinCount = getPrimitiveParamMinCount;

    function getPrimitiveParamMaxCount(name) {
        return (name in lrt.primitiveParamCount) ? lrt.primitiveParamCount[name][2] : undefined;
    }
    lrt.util.getPrimitiveParamMaxCount = getPrimitiveParamMaxCount;

    function getSrcmapFirstLeaf(srcmap) {
        while (srcmap.length > 1 && Array.isArray(srcmap[1])) {
            srcmap = srcmap[1];
        }

        return srcmap;
    }
    lrt.util.getSrcmapFirstLeaf = getSrcmapFirstLeaf;

    function logoVar(v, varname) {
        if (v === undefined) {
            throw logo.type.LogoException.create("VAR_HAS_NO_VALUE", [varname], undefined, Error().stack);
        }

        return v;
    }
    lrt.util.logoVar = logoVar;

    const unaryOperator = {
        "-" : 2
    };

    function isUnaryOperator(op) {
        return op in unaryOperator
    }
    lrt.util.isUnaryOperator = isUnaryOperator;

    function getPrimitivePrecedence(op) {
        return isUnaryOperator(op) ? unaryOperator[op] : 0;
    }
    lrt.util.getPrimitivePrecedence = getPrimitivePrecedence;

    const binaryOperator = {
        "+" :[2, primitiveSum],
        "-" :[2, primitiveDifference],
        "*" :[3, primitiveProduct],
        "/" :[3, primitiveQuotient],
        "==":[1, primitiveEqualp],
        ">=":[1, primitiveGreaterequalp],
        ">" :[1, primitiveGreaterp],
        "<=":[1, primitiveLessequalp],
        "<" :[1, primitiveLessp]
    };

    function isBinaryOperator(op) {
        return op in binaryOperator;
    }
    lrt.util.isBinaryOperator = isBinaryOperator;

    function getBinaryOperatorPrecedence(op) {
        return binaryOperator[op][0];
    }
    lrt.util.getBinaryOperatorPrecedence = getBinaryOperatorPrecedence;

    function getBinaryOperatorRuntimeFunc(op) {
        return binaryOperator[op][1];
    }
    lrt.util.getBinaryOperatorRuntimeFunc = getBinaryOperatorRuntimeFunc;

    return lrt;
};

if (typeof exports != "undefined") {
    exports.classObj = classObj;
}
