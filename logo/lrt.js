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

    function primitiveList(...args) {
        return logo.type.makeLogoList(args);
    }

    function primitiveSentence(...args) {
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

    function primitiveWord(...args) {
        let word = "";
        for (let i in args) {
            let item = args[i];
            logo.type.checkInputWord(item);
            word += item;
        }

        return word;
    }

    function primitiveArray(size, origin) {
        logo.type.checkInputNonNegInteger(size);
        if (sys.isUndefined(origin)) {
            origin = 1;
        }

        logo.type.checkInputInteger(origin);
        return logo.type.makeLogoArrayBySize(size, origin);
    }

    function primitiveListToArray(value, origin) {
        logo.type.checkInputList(value);
        if (origin === undefined) {
            origin = 1;
        }

        logo.type.checkInputInteger(origin);
        return logo.type.listToArray(value, origin);
    }

    function primitiveArrayToList(value) {
        logo.type.checkInputArray(value);
        return logo.type.arrayToList(value);
    }

    function primitiveAscii(value) {
        logo.type.checkInputCharacter(value);
        return logo.type.charToAscii(value);
    }

    function primitiveChar(value) {
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

    function primitiveMdarray(sizeList, origin) {
        if (sys.isUndefined(origin)) {
            origin = 1;
        }

        logo.type.checkInputNonEmptyList(sizeList);
        return mdarrayHelper(sizeList, logo.type.LIST_ORIGIN, logo.type.listMaxIndex(sizeList), origin);
    }

    function primitiveMdsetitem(indexList, array, value) {
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

    function primitiveMditem(indexList, array) {
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

    function primitiveFirst(thing) {
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

    function primitiveLast(thing) {
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

    function primitiveEmptyp(value) {
        return logo.type.isEmptyString(value) || logo.type.isEmptyList(value);
    }

    function primitiveWordp(thing) {
        return logo.type.isLogoWord(thing);
    }

    function primitiveNumberp(thing) {
        return logo.type.isLogoNumber(thing);
    }

    function primitiveListp(thing) {
        return logo.type.isLogoList(thing);
    }

    function primitiveArrayp(thing) {
        return logo.type.isLogoArray(thing);
    }

    function primitiveMemberp(candidate, group) {
        if (logo.type.isLogoWord(group)) {
            logo.type.checkInputCharacter(candidate);
            return logo.type.wordFindItem(candidate, group) != -1;
        }

        if (logo.type.isLogoList(group)) {
            return logo.type.listFindItem(candidate, group) != -1;
        }

        logo.type.checkInputArray(group);
        return logo.type.arrayFindItem(candidate, group) != -1;
    }

    function primitiveButfirst(thing) {
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

    function primitiveButlast(thing) {
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

    function primitiveCount(thing) {
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

    function primitiveFput(thing, list) {
        if (logo.type.isLogoWord(list)) {
            logo.type.checkInputOneLetterWord(thing);
            return thing.concat(list);
        }

        logo.type.checkInputList(list);
        let newlist = list.slice(0);
        newlist.splice(1, 0, thing);
        return newlist;
    }

    function primitiveLput(thing, list) {
        if (logo.type.isLogoWord(list)) {
            logo.type.checkInputOneLetterWord(thing);
            return list.concat(thing);
        }

        logo.type.checkInputList(list);
        let newlist = list.slice(0);
        newlist.push(thing);
        return newlist;
    }

    function primitiveMake(varname, val) {
        logo.env.findLogoVarScope(varname)[varname.toLowerCase()] = val;
    }

    function primitiveAnd(...args) {
        args.forEach(logo.type.checkInputBoolean);
        return args.reduce(function(accumulator, currentValue) { return accumulator && logo.type.asLogoBoolean(currentValue); }, true);
    }

    function primitiveOr(...args) {
        args.forEach(logo.type.checkInputBoolean);
        return args.reduce(function(accumulator, currentValue) { return accumulator || logo.type.asLogoBoolean(currentValue); }, false);
    }

    function primitiveNot(value) {
        logo.type.checkInputBoolean(value);
        return !logo.type.asLogoBoolean(value);
    }

    function primitiveLocal(...args) {
        let ptr = logo.env._scopeStack.length - 1;

        args.forEach(function(varname){
            logo.env._scopeStack[ptr][varname.toLowerCase()] = undefined;
        });
    }

    function primitiveLocalmake(varname, val) {
        let ptr = logo.env._scopeStack.length - 1;
        logo.env._scopeStack[ptr][varname.toLowerCase()] = val;
    }

    function primitiveSetitem(index, array, val) {
        logo.type.checkInputArray(array);
        logo.type.checkInputInteger(index);
        logo.type.checkIndexWithinArrayRange(index, array);
        logo.type.arraySetItem(index, array, val);
    }

    function primitiveItem(index, thing) {
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

    function primitivePrint(...args) {
        logo.io.stdout(args.map(function(v) { return logo.type.toString(v);}).join(" "));
    }

    function primitiveShow(...args) {
        logo.io.stdout(args.map(function(v){ return logo.type.toString(v, true);}).join(" "));
    }

    function primitiveType(...args) {
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
        return logo.type.equal(a, b);
    }

    function primitiveNotequalp(a, b) {
        return !logo.type.equal(a, b);
    }

    function primitiveMinus(a) {
        return -a;
    }

    function primitiveQuotient(opnd1, opnd2) {
        return opnd1 / opnd2;
    }

    function primitiveProduct(opnd1, opnd2) {
        logo.type.checkInputNumber(opnd1);
        logo.type.checkInputNumber(opnd2);
        return opnd1 * opnd2;
    }

    function primitiveRemainder(opnd1, opnd2) {
        return opnd1 % opnd2;
    }

    function primitiveSum(opnd1, opnd2) {
        logo.type.checkInputNumber(opnd1);
        logo.type.checkInputNumber(opnd2);
        return opnd1 + opnd2;
    }

    function primitiveDifference(opnd1, opnd2) {
        return opnd1 - opnd2;
    }

    function primitiveSqrt(opnd) {
        logo.type.checkInputNonNegNumber(opnd);
        return Math.sqrt(opnd);
    }

    function primitivePower(base, exp) {
        logo.type.checkInputNumber(base);
        if (base < 0) {
            logo.type.checkInputInteger(exp);
        } else {
            logo.type.checkInputNumber(exp);
        }

        return Math.pow(base, exp);
    }

    function primitiveLog10(opnd) {
        logo.type.checkInputPosNumber(opnd);
        return Math.log10(opnd);
    }

    function primitiveSin(deg) {
        logo.type.checkInputNumber(deg);
        return Math.sin(logo.type.degToRad(normalizeDegree(deg)));
    }

    function primitiveCos(deg) {
        logo.type.checkInputNumber(deg);
        return Math.sin(logo.type.degToRad(normalizeDegree(deg + 90)));
    }

    function normalizeDegree(deg) {
        let degAbs = Math.abs(deg) % 360;
        let degSign = Math.sign(deg);
        if (degAbs > 180) {
            degAbs -= 180;
            degSign = -degSign;
        }

        if (degAbs > 90) {
            degAbs = 180 - degAbs;
        }

        return degSign * degAbs;
    }

    function primitiveRound(opnd) {
        logo.type.checkInputNumber(opnd);
        let sign = Math.sign(opnd);
        return sign == 0 ? 0 :
            sign > 0 ? Math.round(opnd) :
                - Math.round(-opnd);
    }

    function primitiveInt(opnd) {
        logo.type.checkInputNumber(opnd);
        let sign = Math.sign(opnd);
        return sign == 0 ? 0 :
            sign > 0 ? Math.floor(opnd) :
                - Math.floor(-opnd);
    }

    function primitiveAbs(opnd) {
        logo.type.checkInputNumber(opnd);
        return Math.abs(opnd);
    }

    function primitiveSign(opnd) {
        logo.type.checkInputNumber(opnd);
        return Math.sign(opnd);
    }

    function primitiveRandom(range) {
        return Math.floor(Math.random() * Math.floor(range));
    }

    function primitiveThrow(tag, value) {
        throw logo.type.LogoException.create("CUSTOM", [tag, value], logo.env.getPrimitiveSrcmap(), logo.env._curProc);
    }

    async function primitiveReadword() {
        if (logo.env.hasUserInput()) {
            return logo.env.getUserInput();
        }

        logo.env.prepareToBeBlocked();
        let oldEnvState = logo.env.getEnvState();
        logo.env.setEnvState("continue");
        do {
            await new Promise((resolve) => {
                logo.env.registerUserInputResolver(resolve);
            });
        } while (!logo.env.hasUserInput());

        logo.env.setEnvState(oldEnvState);
        return logo.env.getUserInput();
    }

    function primitiveTimeMilli() {
        return new Date().getTime();
    }

    async function primitiveWait(delay) {
        logo.env.prepareToBeBlocked();
        await new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, 50 / 3 * delay);
        });

        return;
    }

    const primitiveDemo = (function() {
        let demo = undefined;
        return function(name) {
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

    async function dotTest(testName, testMethod) {
        await logo.entry.runSingleTest(testName, testMethod);
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

        "sin": primitiveSin,

        "cos": primitiveCos,

        "round": primitiveRound,

        "int": primitiveInt,

        "abs": primitiveAbs,

        "sign": primitiveSign,

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

        "memberp": primitiveMemberp,
        "member?": primitiveMemberp,

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
            let l = primitive[k].length;
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

    function logoVar(v, varname, srcmap) {
        if (v === undefined) {
            throw logo.type.LogoException.create("VAR_HAS_NO_VALUE", [varname], srcmap);
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
