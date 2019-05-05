//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's runtime library
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

var $classObj = {};
$classObj.create = function(logo, sys) {
    const lrt = {};

    function primitivePi() {
        return Math.PI;
    }

    function primitiveCleartext() {
        logo.io.cleartext();
    }

    function primitiveList() {
        const args = Array.prototype.slice.call(arguments);
        logo.env.setPrimitiveName(args.shift());
        return logo.type.makeLogoList(args);
    }

    function primitiveSentence() {
        const args = Array.prototype.slice.call(arguments);
        logo.env.setPrimitiveName(args.shift());
        const sentence = logo.type.makeLogoList();

        for (let i in args) {
            let item = args[i];
            if (logo.type.isLogoWord(item)) {
                sentence.push(item);
                continue;
            }

            logo.type.checkInputList(item);
            for (let j = 1; j < item.length; j++) {
                sentence.push(item[j]);
            }
        }

        return sentence;
    }

    function primitiveWord() {
        const args = Array.prototype.slice.call(arguments);
        logo.env.setPrimitiveName(args.shift());
        let word = "";

        for (let i in args) {
            let item = args[i];
            logo.type.checkInputWord(item);
            word += item;
        }

        return word;
    }

    function primitiveArray(primitiveName, size, origin) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputNonNegInteger(size);
        if (sys.isUndefined(origin)) {
            origin = 1;
        }

        logo.type.checkInputInteger(origin);
        return logo.type.makeLogoArrayBySize(size, origin);
    }

    function primitiveListToArray(primitiveName, value, origin) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputList(value);
        if (origin === undefined) {
            origin = 1;
        }

        logo.type.checkInputInteger(origin);
        return logo.type.listToArray(value, origin);
    }

    function primitiveArrayToList(primitiveName, value) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputArray(value);
        return logo.type.arrayToList(value);
    }

    function primitiveAscii(primitiveName, value) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputCharacter(value);
        return logo.type.charToAscii(value);
    }

    function primitiveChar(primitiveName, value) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputIsByteValue(value);
        return logo.type.asciiToChar(value);
    }

    function mdarrayHelper(sizeList, index, maxIndex, origin) {
        let size = logo.type.listItem(index, sizeList);
        let ret = logo.type.makeLogoArrayBySize(size, origin);
        if (index != maxIndex) {
            for (let i = logo.type.arrayOrigin(ret); i <= logo.type.arrayMaxIndex(ret); i++) {
                logo.type.arraySetItem(i, ret, mdarrayHelper(sizeList, index + 1, maxIndex, origin));
            }
        }

        return ret;
    }

    function primitiveMdarray(primitiveName, sizeList, origin) {
        logo.env.setPrimitiveName(primitiveName);
        if (sys.isUndefined(origin)) {
            origin = 1;
        }

        logo.type.checkInputNonEmptyList(sizeList);
        return mdarrayHelper(sizeList, logo.type.LIST_ORIGIN, logo.type.listMaxIndex(sizeList), origin);
    }

    function primitiveMdsetitem(primitiveName, indexList, array, value) {
        logo.env.setPrimitiveName(primitiveName);

        logo.type.checkInputNonEmptyList(indexList);
        logo.type.checkInputArray(array);

        let currentItem = array;
        let sizeListMaxIndex = logo.type.listMaxIndex(indexList);
        for (let i = logo.type.LIST_ORIGIN; i < sizeListMaxIndex; i++) {
            let index = logo.type.listItem(i, indexList);
            logo.type.checkInputArray(currentItem);
            logo.type.checkIndexWithinArrayRange(index, currentItem);
            currentItem = logo.type.arrayItem(index, currentItem);
        }

        let index = logo.type.listItem(sizeListMaxIndex, indexList);
        logo.type.checkInputArray(currentItem);
        logo.type.checkIndexWithinArrayRange(index, currentItem);
        logo.type.arraySetItem(index, currentItem, value);
    }

    function primitiveMditem(primitiveName, indexList, array) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputNonEmptyList(indexList);
        logo.type.checkInputArray(array);

        let currentItem = array;
        let origin = logo.type.arrayOrigin(array);
        let sizeListMaxIndex = logo.type.listMaxIndex(indexList);
        for (let i = logo.type.LIST_ORIGIN; i <= sizeListMaxIndex; i++) {
            let index = logo.type.listItem(i, indexList);
            logo.type.checkInputArray(currentItem);
            logo.type.checkIndexWithinArrayRange(index, currentItem);
            currentItem = logo.type.arrayItem(index, currentItem, origin);
        }

        return currentItem;
    }

    function primitiveFirst(primitiveName, thing) {
        logo.env.setPrimitiveName(primitiveName);
        if (logo.type.isLogoWord(thing)) {
            if (typeof thing === "boolean") {
                return thing ? "t" : "f";
            }

            if (typeof thing === "number") {
                thing = logo.type.toString(thing);
            }

            logo.type.checkInputNonEmptyWord(thing);
            return thing.substring(0, 1);
        }

        if (logo.type.isLogoList(thing)) {
            logo.type.checkInputNonEmptyList(thing);
            return logo.type.listItem(logo.type.LIST_ORIGIN, thing);
        }

        logo.type.checkInputArray(thing);
        return logo.type.arrayOrigin(thing);
    }

    function primitiveLast(primitiveName, thing) {
        logo.env.setPrimitiveName(primitiveName);
        if (logo.type.isLogoWord(thing)) {
            if (typeof thing === "boolean") {
                return "e";
            }

            if (typeof thing === "number") {
                thing = logo.type.toString(thing);
            }

            logo.type.checkInputNonEmptyWord(thing);
            let length = thing.length;
            return thing.substring(length - 1, length);
        }

        logo.type.checkInputNonEmptyList(thing);
        return logo.type.listItem(logo.type.listLength(thing), thing);
    }

    function primitiveEmptyp(primitiveName, value) {
        logo.env.setPrimitiveName(primitiveName);
        return logo.type.isEmptyString(value) || logo.type.isEmptyList(value);
    }

    function primitiveWordp(primitiveName, thing) {
        logo.env.setPrimitiveName(primitiveName);
        return logo.type.isLogoWord(thing);
    }

    function primitiveNumberp(primitiveName, thing) {
        logo.env.setPrimitiveName(primitiveName);
        return logo.type.isLogoNumber(thing);
    }

    function primitiveListp(primitiveName, thing) {
        logo.env.setPrimitiveName(primitiveName);
        return logo.type.isLogoList(thing);
    }

    function primitiveArrayp(primitiveName, thing) {
        logo.env.setPrimitiveName(primitiveName);
        return logo.type.isLogoArray(thing);
    }

    function primitiveButfirst(primitiveName, thing) {
        logo.env.setPrimitiveName(primitiveName);
        if (logo.type.isLogoWord(thing)) {
            if (typeof thing === "boolean") {
                return thing ? "rue" : "alse";
            }

            if (typeof thing === "number") {
                thing = logo.type.toString(thing);
            }

            logo.type.checkInputNonEmptyWord(thing);
            return thing.substring(1);
        }

        logo.type.checkInputNonEmptyList(thing);
        return logo.type.listButFirst(thing);
    }

    function primitiveButlast(primitiveName, thing) {
        logo.env.setPrimitiveName(primitiveName);
        if (logo.type.isLogoWord(thing)) {
            if (typeof thing === "boolean") {
                return thing ? "tru" : "fals";
            }

            if (typeof thing === "number") {
                thing = logo.type.toString(thing);
            }

            logo.type.checkInputNonEmptyWord(thing);
            return thing.substring(0, thing.length - 1);
        }

        logo.type.checkInputNonEmptyList(thing);
        return logo.type.listButLast(thing);
    }

    function primitiveCount(primitiveName, thing) {
        logo.env.setPrimitiveName(primitiveName);
        if (logo.type.isLogoWord(thing)) {
            if (typeof thing === "boolean") {
                return thing ? 4 : 5;
            }

            if (typeof thing === "number") {
                thing = logo.type.toString(thing);
            }

            return thing.length;
        }

        if (logo.type.isLogoList(thing)) {
            return logo.type.listLength(thing);
        }

        logo.type.checkInputArray(thing);
        return logo.type.arrayLength(thing);
    }

    function primitiveFput(primitiveName, thing, list) {
        logo.env.setPrimitiveName(primitiveName);
        if (logo.type.isLogoWord(list)) {
            logo.type.checkInputOneLetterWord(thing);
            return thing.concat(list);
        }

        logo.type.checkInputList(list);
        let newlist = list.slice(0);
        newlist.splice(1, 0, thing);
        return newlist;
    }

    function primitiveLput(primitiveName, thing, list) {
        logo.env.setPrimitiveName(primitiveName);
        if (logo.type.isLogoWord(list)) {
            logo.type.checkInputOneLetterWord(thing);
            return list.concat(thing);
        }

        logo.type.checkInputList(list);
        let newlist = list.slice(0);
        newlist.push(thing);
        return newlist;
    }

    function primitiveMake(primitiveName, varname, val) {
        logo.env.setPrimitiveName(primitiveName);
        logo.env.findLogoVarScope(varname)[varname.toLowerCase()] = val;
    }

    function primitiveAnd() {
        const args = Array.prototype.slice.call(arguments);
        logo.env.setPrimitiveName(args.shift());
        args.forEach(logo.type.checkInputBoolean);
        return args.reduce(function(accumulator, currentValue) { return accumulator && logo.type.asLogoBoolean(currentValue); }, true);
    }

    function primitiveOr() {
        const args = Array.prototype.slice.call(arguments);
        logo.env.setPrimitiveName(args.shift());
        args.forEach(logo.type.checkInputBoolean);
        return args.reduce(function(accumulator, currentValue) { return accumulator || logo.type.asLogoBoolean(currentValue); }, false);
    }

    function primitiveNot(primitiveName, value) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputBoolean(value);
        return !logo.type.asLogoBoolean(value);
    }

    function primitiveLocal() {
        let args = Array.prototype.slice.call(arguments);
        logo.env.setPrimitiveName(args.shift());
        let ptr = logo.env._scopeStack.length - 1;

        args.forEach(function(varname){
            logo.env._scopeStack[ptr][varname.toLowerCase()] = undefined;
        });
    }

    function primitiveLocalmake(primitiveName, varname, val) {
        logo.env.setPrimitiveName(primitiveName);
        let ptr = logo.env._scopeStack.length - 1;
        logo.env._scopeStack[ptr][varname.toLowerCase()] = val;
    }

    function primitiveSetitem(primitiveName, index, array, val) {
        logo.env.setPrimitiveName(primitiveName);

        logo.type.checkInputArray(array);
        logo.type.checkInputInteger(index);
        logo.type.checkIndexWithinArrayRange(index, array);
        logo.type.arraySetItem(index, array, val);
    }

    function primitiveItem(primitiveName, index, thing) {
        logo.env.setPrimitiveName(primitiveName);

        if (logo.type.isLogoList(thing)) {
            logo.type.checkIndexWithinListRange(index, thing);
            return logo.type.listItem(index, thing);
        }

        if (logo.type.isLogoWord(thing)) {
            logo.type.checkIndexWithinWordRange(index, thing);
            return logo.type.wordGetItem(index, thing);
        }

        logo.type.checkInputArray(thing);
        logo.type.checkIndexWithinArrayRange(index, thing);
        return logo.type.arrayItem(index, thing);
    }

    function primitivePrint() {
        let args = Array.prototype.slice.call(arguments);
        logo.env.setPrimitiveName(args.shift());
        logo.io.stdout(args.map(function(v) { return logo.type.toString(v);}).join(" "));
    }

    function primitiveShow() {
        let args = Array.prototype.slice.call(arguments);
        logo.env.setPrimitiveName(args.shift());
        logo.io.stdout(args.map(function(v){ return logo.type.toString(v, true);}).join(" "));
    }

    function primitiveType() {
        let args = Array.prototype.slice.call(arguments);
        logo.env.setPrimitiveName(args.shift());
        logo.io.stdoutn(args.map(function(v) { return logo.type.toString(v);}).join(""));
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

    function primitiveLessp(primitiveName, a, b) {
        logo.env.setPrimitiveName(primitiveName);
        return a < b;
    }

    function primitiveLessequalp(primitiveName, a, b) {
        logo.env.setPrimitiveName(primitiveName);
        return a <= b;
    }

    function primitiveGreaterp(primitiveName, a, b) {
        logo.env.setPrimitiveName(primitiveName);
        return a > b;
    }

    function primitiveGreaterequalp(primitiveName, a, b) {
        logo.env.setPrimitiveName(primitiveName);
        return a >= b;
    }

    function primitiveEqualp(primitiveName, a, b) {
        logo.env.setPrimitiveName(primitiveName);
        return logo.type.equal(a, b);
    }

    function primitiveNotequalp(primitiveName, a, b) {
        logo.env.setPrimitiveName(primitiveName);
        return !logo.type.equal(a, b);
    }

    function primitiveMinus(primitiveName, a) {
        logo.env.setPrimitiveName(primitiveName);
        return -a;
    }

    function primitiveQuotient(primitiveName, opnd1, opnd2) {
        logo.env.setPrimitiveName(primitiveName);
        return opnd1 / opnd2;
    }

    function primitiveProduct(primitiveName, opnd1, opnd2) {
        logo.env.setPrimitiveName(primitiveName);
        return opnd1 * opnd2;
    }

    function primitiveRemainder(primitiveName, opnd1, opnd2) {
        logo.env.setPrimitiveName(primitiveName);
        return opnd1 % opnd2;
    }

    function primitiveSum(primitiveName, opnd1, opnd2) {
        logo.env.setPrimitiveName(primitiveName);
        return opnd1 + opnd2;
    }

    function primitiveDifference(primitiveName, opnd1, opnd2) {
        logo.env.setPrimitiveName(primitiveName);
        return opnd1 - opnd2;
    }

    function primitiveSqrt(primitiveName, opnd) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputNonNegNumber(opnd);
        return Math.sqrt(opnd);
    }

    function primitivePower(primitiveName, base, exp) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputNumber(base);
        if (base < 0) {
            logo.type.checkInputInteger(exp);
        } else {
            logo.type.checkInputNumber(exp);
        }

        return Math.pow(base, exp);
    }

    function primitiveLog10(primitiveName, opnd) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputPosNumber(opnd);
        return Math.log10(opnd);
    }

    function primitiveRound(primitiveName, opnd) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputNumber(opnd);
        let sign = Math.sign(opnd);
        return sign == 0 ? 0 :
            sign > 0 ? Math.round(opnd) :
                - Math.round(-opnd);
    }

    function primitiveInt(primitiveName, opnd) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputNumber(opnd);
        let sign = Math.sign(opnd);
        return sign == 0 ? 0 :
            sign > 0 ? Math.floor(opnd) :
                - Math.floor(-opnd);
    }

    function primitiveAbs(primitiveName, opnd) {
        logo.env.setPrimitiveName(primitiveName);
        logo.type.checkInputNumber(opnd);
        return Math.abs(opnd);
    }

    function primitiveRandom(primitiveName, range) {
        logo.env.setPrimitiveName(primitiveName);
        return Math.floor(Math.random() * Math.floor(range));
    }

    function primitiveThrow(primitiveName, tag, value) {
        logo.env.setPrimitiveName(primitiveName);
        throw logo.type.LogoException.create("CUSTOM", [tag, value], null, Error().stack);
    }

    function primitiveReadword() {
        if (logo.env.hasUserInput()) {
            return logo.env.getUserInput();
        }

        let ret = logo.type.makeLogoAsyncReturn();
        function doWhileLoopBody() {
            logo.env.async(function() {
                throw logo.type.LogoException.create("YIELD", ["continue"]);
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

    function primitiveWait(primitiveName, delay) {
        logo.env.setPrimitiveName(primitiveName);
        setTimeout(logo.env.resumeAfterWait, 50 / 3 * delay);
        logo.env.setEnvState("timeout");
        logo.env.async(function() {
            throw logo.type.LogoException.create("YIELD", ["timeout"]);
        });
    }

    const primitiveDemo = (function() {
        let demo = undefined;
        return function(primitiveName, name) {
            logo.env.setPrimitiveName(primitiveName);

            if (demo === undefined) {
                demo = sys.util.jsonFromJs(sys.Config.get("demoJsSrcFile"));
            }

            let option = undefined;
            if (logo.type.isLogoList(name)) {
                option = logo.type.listItem(2, name).toLowerCase();
                name = logo.type.listItem(1, name).toLowerCase();
            } else {
                name = name.toLowerCase();
            }

            if (!(name in demo && "__lgo__" in demo[name])) {
                throw logo.type.LogoException.create("CANT_OPEN_FILE", [name]);
            }

            let src = demo[name]["__lgo__"];

            if (option !== undefined && option == "load") {
                logo.io.editorload(src);
            }

            logo.entry.exec(src);
        };
    })();

    function dotTest(primitiveName, testName, testMethod) {
        logo.entry.runSingleTest(testName, testMethod);
    }

    let primitive = {
        "pi": primitivePi,

        "cleartext": primitiveCleartext,
        "ct": primitiveCleartext,

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

        "draw": logo.turtle.draw,

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

        "pensize": logo.turtle.pensize,

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

        " -": primitiveMinus,  // unary minus operator in ambiguous context

        "-": primitiveMinus,

        "minus": primitiveMinus,

        "sum": primitiveSum,

        "quotient": primitiveQuotient,

        "product": primitiveProduct,

        "remainder": primitiveRemainder,

        "sqrt": primitiveSqrt,

        "power": primitivePower,

        "log10": primitiveLog10,

        "round": primitiveRound,

        "int": primitiveInt,

        "abs": primitiveAbs,

        "random": primitiveRandom,

        "lessp": primitiveLessp,

        "lessequalp": primitiveLessequalp,

        "greaterp": primitiveGreaterp,

        "greaterequalp": primitiveGreaterequalp,

        "equalp": primitiveEqualp,
        "equal?": primitiveEqualp,

        "notequalp": primitiveNotequalp,
        "notequal?": primitiveNotequalp,

        "emptyp": primitiveEmptyp,
        "empty?": primitiveEmptyp,

        "wordp": primitiveWordp,
        "word?": primitiveWordp,

        "numberp": primitiveNumberp,
        "number?": primitiveNumberp,

        "listp": primitiveListp,
        "list?": primitiveListp,

        "arrayp": primitiveArrayp,
        "array?": primitiveArrayp,

        "show": primitiveShow,

        "print": primitivePrint,
        "pr": primitivePrint,

        "type": primitiveType,

        "make": primitiveMake,

        "local": primitiveLocal,

        "localmake": primitiveLocalmake,

        "item": primitiveItem,

        "mditem": primitiveMditem,

        "setitem": primitiveSetitem,

        "mdsetitem": primitiveMdsetitem,

        "word": primitiveWord,

        "list": primitiveList,

        "sentence": primitiveSentence,
        "se": primitiveSentence,

        "array": primitiveArray,

        "mdarray": primitiveMdarray,

        "listtoarray": primitiveListToArray,

        "arraytolist": primitiveArrayToList,

        "ascii": primitiveAscii,

        "char": primitiveChar,

        "first": primitiveFirst,

        "last": primitiveLast,

        "butfirst": primitiveButfirst,
        "bf": primitiveButfirst,

        "butlast": primitiveButlast,
        "bl": primitiveButlast,

        "count": primitiveCount,

        "fput": primitiveFput,

        "lput": primitiveLput,

        "and": primitiveAnd,

        "or": primitiveOr,

        "not": primitiveNot,

        "readword": primitiveReadword,

        "timemilli": primitiveTimeMilli,

        "throw": primitiveThrow,

        "wait": primitiveWait,

        "demo": primitiveDemo,

        ".test": dotTest
    };
    lrt.primitive = primitive;

    lrt.util = {};

    const primitiveParamCount = {};
    Object.keys(primitive).map(
        function(k) {
            let l = primitive[k].length - 1;
            primitiveParamCount[k] = [l, l, l]; // [def, min, max]
        });

    // can take infinite inputs inside ()
    primitiveParamCount.local =
    primitiveParamCount.show =
    primitiveParamCount.pr =
    primitiveParamCount.print =
    primitiveParamCount.type = [1, 0, -1];

    primitiveParamCount.se =
    primitiveParamCount.sentence =
    primitiveParamCount.list =
    primitiveParamCount.word = [2, 0, -1];

    primitiveParamCount.and =
    primitiveParamCount.or = [2, 0, -1];

    primitiveParamCount.listtoarray =
    primitiveParamCount.mdarray =
    primitiveParamCount.throw =
    primitiveParamCount.array = [1, 1, 2];

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
        " -" : 2, // unary minus operator in ambiguous context
        "-" : 2
    };

    function isUnaryOperator(op) {
        return op in unaryOperator;
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
        "==":[1, primitiveEqualp, "equalp"],
        "<>":[1, primitiveNotequalp, "notequalp"],
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

    function getBinaryOperatorPrimitiveName(op) {
        return binaryOperator[op][2];
    }
    lrt.util.getBinaryOperatorPrimitiveName = getBinaryOperatorPrimitiveName;

    return lrt;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
