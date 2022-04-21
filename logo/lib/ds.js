//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements Logo's data structure primitives
// Runs in Logo worker thread

export default {
    "create": function(logo, sys) {
        const ds = {};

        const LOGO_DEFAULT_PRECISION = 6;

        const JS_MAX_PRECISION = 100;

        const SPACE = " ";

        const methods = {
            "word": [primitiveWord, "[args] 2"],

            "list": [primitiveList, "[args] 2"],

            "sentence": [primitiveSentence, "[args] 2"],
            "se": [primitiveSentence, "[args] 2"],

            "fput": primitiveFput,

            "lput": primitiveLput,

            "array": [primitiveArray, "size [origin 1]"],

            "mdarray": [primitiveMdarray, "sizeList [origin 1]"],

            "listtoarray": [primitiveListToArray, "value [origin 1]"],

            "arraytolist": primitiveArrayToList,

            "listtoplist": primitiveListtoplist,

            "reverse": primitiveReverse,

            "first": primitiveFirst,

            "last": primitiveLast,

            "butfirst": primitiveButfirst,
            "bf": primitiveButfirst,

            "butlast": primitiveButlast,
            "bl": primitiveButlast,

            "item": primitiveItem,

            "mditem": primitiveMditem,

            "remove": primitiveRemove,

            "remdup": primitiveRemdup,

            "setitem": primitiveSetitem,

            "mdsetitem": primitiveMdsetitem,

            "wordp": primitiveWordp,
            "word?": primitiveWordp,

            "listp": primitiveListp,
            "list?": primitiveListp,

            "arrayp": primitiveArrayp,
            "array?": primitiveArrayp,

            "emptyp": primitiveEmptyp,
            "empty?": primitiveEmptyp,

            "numberp": primitiveNumberp,
            "number?": primitiveNumberp,

            "memberp": primitiveMemberp,
            "member?": primitiveMemberp,

            "member": primitiveMember,

            "plistp": primitivePlistp,
            "plist?": primitivePlistp,

            "count": primitiveCount,

            "ascii": primitiveAscii,

            "char": primitiveChar,

            "form": primitiveForm,

            "lowercase": primitiveLowercase,

            "uppercase": primitiveUppercase,
        };
        ds.methods = methods;

        function primitiveList(...args) {
            return logo.type.makeLogoList(args);
        }

        function primitiveSentence(...args) {
            return logo.type.makeLogoList(logo.type.flattenList(args));
        }

        function primitiveWord(...args) {
            let word = "";
            for (let i in args) {
                let item = args[i];
                logo.type.validateInputWord(item);
                word += item;
            }

            return word;
        }

        function primitiveArray(size, origin = logo.type.ARRAY_DEFAULT_ORIGIN) {
            logo.type.validateInputNonNegInteger(size);
            logo.type.validateInputInteger(origin);
            return logo.type.makeLogoArrayBySize(size, origin);
        }

        function primitiveListToArray(value, origin = logo.type.ARRAY_DEFAULT_ORIGIN) {
            logo.type.validateInputList(value);
            logo.type.validateInputInteger(origin);
            return logo.type.listToArray(value, origin);
        }

        function primitiveArrayToList(value) {
            logo.type.validateInputArray(value);
            return logo.type.arrayToList(value);
        }

        function primitiveListtoplist(value) {
            logo.type.validateInputList(value);
            return logo.type.listToPlist(value);
        }

        function primitiveAscii(value) {
            logo.type.validateInputCharacter(value);
            return logo.type.charToAscii(value);
        }

        function primitiveChar(value) {
            logo.type.validateInputByte(value);
            return logo.type.asciiToChar(value);
        }

        function primitiveForm(num, width, precision) {
            logo.type.validateInputNumber(num);
            logo.type.validateInputInteger(width);
            if (sys.isInteger(precision)) {
                return toFixed(num, precision).padStart(width, SPACE);
            }

            if (width >= 0) {
                logo.type.validateInputInteger(precision);
            }

            logo.type.validateInputWord(precision);
            return formDebug(num, width, precision);
        }

        function formDebug(num, width, format) {
            let words = float64ToUint32Array(num);
            return formatString(format.toString(), words[0], words[1]);
        }

        function formatString(format, ...params) {
            let result = format;
            while (params.length > 0) {
                let param = params.shift();
                result = result.replace(/%(0?)(\d+)([bBdDoOxX])/, (match, zero, precision, base) => {
                    switch(base) {
                    case "x":
                        return param.toString(16).padStart(precision, zero).padStart(precision, SPACE);
                    case "X":
                        return param.toString(16).padStart(precision, zero).toUpperCase().padStart(precision, SPACE);
                    case "b":
                    case "B":
                        return param.toString(2).padStart(precision, zero).padStart(precision, SPACE);
                    case "o":
                    case "O":
                        return param.toString(8).padStart(precision, zero).padStart(precision, SPACE);
                    case "d":
                    case "D":
                        return param.toString(10).padStart(precision, zero).padStart(precision, SPACE);
                    }
                });
            }

            return result;
        }

        function float64ToUint32Array(num) {
            var buffer = new ArrayBuffer(8);
            var bytes = new Uint8Array(buffer);
            var words = new Uint32Array(buffer);
            var view = new DataView(buffer);
            view.setFloat64(0, num);
            bytes.reverse();
            return words;
        }

        function toFixed(num, precision) {
            if (precision < 0) {
                precision = LOGO_DEFAULT_PRECISION;
            }

            if (precision <= JS_MAX_PRECISION) {
                return num.toFixed(precision);
            }

            let fixed = num.toFixed(JS_MAX_PRECISION);
            return fixed.padEnd(fixed.length + precision - JS_MAX_PRECISION, "0");
        }

        function primitiveLowercase(value) {
            logo.type.validateInputWord(value);
            return logo.type.wordLowerCase(value);
        }

        function primitiveUppercase(value) {
            logo.type.validateInputWord(value);
            return logo.type.wordUpperCase(value);
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

        function primitiveMdarray(sizeList, origin = logo.type.ARRAY_DEFAULT_ORIGIN) {
            logo.type.validateInputNonEmptyList(sizeList);
            return mdarrayHelper(sizeList, logo.type.ARRAY_DEFAULT_ORIGIN, logo.type.listMaxIndex(sizeList), origin);
        }

        function primitiveMdsetitem(indexList, array, value) {
            logo.type.validateInputNonEmptyList(indexList);
            logo.type.validateInputArray(array);

            let currentItem = array;
            let sizeListMaxIndex = logo.type.listMaxIndex(indexList);
            for (let i = logo.type.LIST_ORIGIN; i < sizeListMaxIndex; i++) {
                let index = logo.type.listItem(i, indexList);
                logo.type.validateInputArray(currentItem);
                logo.type.validateIndexWithinArrayRange(index, currentItem);
                currentItem = logo.type.arrayItem(index, currentItem);
            }

            let index = logo.type.listItem(sizeListMaxIndex, indexList);
            logo.type.validateInputArray(currentItem);
            logo.type.validateIndexWithinArrayRange(index, currentItem);
            logo.type.arraySetItem(index, currentItem, value);
        }

        function primitiveMditem(indexList, array) {
            logo.type.validateInputNonEmptyList(indexList);
            logo.type.validateInputArray(array);

            let currentItem = array;
            let origin = logo.type.arrayOrigin(array);
            let sizeListMaxIndex = logo.type.listMaxIndex(indexList);
            for (let i = logo.type.LIST_ORIGIN; i <= sizeListMaxIndex; i++) {
                let index = logo.type.listItem(i, indexList);
                logo.type.validateInputArray(currentItem);
                logo.type.validateIndexWithinArrayRange(index, currentItem);
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

                logo.type.validateInputNonEmptyWord(thing);
                return thing.substring(0, 1);
            }

            if (logo.type.isLogoList(thing)) {
                logo.type.validateInputNonEmptyList(thing);
                return logo.type.listFirst(thing);
            }

            logo.type.validateInputArray(thing);
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

                logo.type.validateInputNonEmptyWord(thing);
                let length = thing.length;
                return thing.substring(length - 1, length);
            }

            logo.type.validateInputNonEmptyList(thing);
            return logo.type.listItem(logo.type.listLength(thing), thing);
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
                logo.type.validateInputCharacter(candidate);
                return logo.type.wordFindItem(candidate, group) !== -1;
            }

            if (logo.type.isLogoList(group)) {
                return logo.type.listFindItem(candidate, group) !== -1;
            }

            logo.type.validateInputArray(group);
            return logo.type.arrayFindItem(candidate, group) !== -1;
        }

        function primitiveMember(candidate, group) {
            if (logo.type.isLogoWord(group)) {
                if (!logo.type.isLogoCharacter(candidate)) {
                    return logo.type.EMPTY_WORD;
                }

                let indexStart = logo.type.wordFindItem(candidate, group);
                return (indexStart === logo.type.INDEX_NOT_FOUND) ? logo.type.EMPTY_WORD : logo.type.wordSubset(group, indexStart);
            }

            logo.type.validateInputList(group);
            let indexStart = logo.type.listFindItem(candidate, group);
            return (indexStart === logo.type.INDEX_NOT_FOUND) ? logo.type.EMPTY_LIST : logo.type.listSubset(group, indexStart);
        }

        function primitivePlistp(val) {
            return logo.type.isLogoPlist(val);
        }

        function primitiveButfirst(thing) {
            if (logo.type.isLogoWord(thing)) {
                if (typeof thing === "boolean") {
                    return thing ? "rue" : "alse";
                }

                if (typeof thing === "number") {
                    thing = logo.type.toString(thing);
                }

                logo.type.validateInputNonEmptyWord(thing);
                return thing.substring(1);
            }

            logo.type.validateInputNonEmptyList(thing);
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

                logo.type.validateInputNonEmptyWord(thing);
                return thing.substring(0, thing.length - 1);
            }

            logo.type.validateInputNonEmptyList(thing);
            return logo.type.listButLast(thing);
        }

        function primitiveRemove(thing, list) {
            if (logo.type.isLogoWord(list)) {
                let thingString = (logo.type.isLogoWord(thing)) ? logo.type.wordToString(thing) : thing;
                return logo.type.wordToString(list)
                    .split("")
                    .filter((c) => (c !== thingString))
                    .join("");
            }

            logo.type.validateInputList(list);
            return logo.type.makeLogoList(
                logo.type.unboxList(list)
                    .filter((item) => !logo.type.equal(item, thing)));
        }

        function primitiveRemdup(value) {
            if (logo.type.isLogoList(value)) {
                return logo.type.listRemdup(value);
            }

            logo.type.validateInputWord(value);
            return logo.type.wordRemdup(value);
        }

        function primitiveReverse(value) {
            if (logo.type.isLogoWord(value)) {
                return logo.type.toString(value).split("").reverse().join("");
            }

            logo.type.validateInputList(value);
            return logo.type.makeLogoList(
                logo.type.unboxList(value).reverse());
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

            logo.type.validateInputArray(thing);
            return logo.type.arrayLength(thing);
        }

        function primitiveFput(thing, list) {
            if (logo.type.isLogoWord(list)) {
                logo.type.validateInputCharacter(thing);
                return thing.concat(list);
            }

            logo.type.validateInputList(list);
            let newlist = list.slice(0);
            newlist.splice(logo.type.LIST_HEAD_SIZE, 0, thing);
            return newlist;
        }

        function primitiveLput(thing, list) {
            if (logo.type.isLogoWord(list)) {
                logo.type.validateInputCharacter(thing);
                return list.concat(thing);
            }

            logo.type.validateInputList(list);
            let newlist = list.slice(0);
            newlist.push(thing);
            return newlist;
        }

        function primitiveSetitem(index, array, val) {
            logo.type.validateInputArray(array);
            logo.type.validateInputInteger(index);
            logo.type.validateIndexWithinArrayRange(index, array);
            logo.type.arraySetItem(index, array, val);
        }

        function primitiveItem(index, thing) {
            if (logo.type.isLogoList(thing)) {
                logo.type.validateIndexWithinListRange(index, thing);
                return logo.type.listItem(index, thing);
            }

            if (logo.type.isLogoWord(thing)) {
                logo.type.validateIndexWithinWordRange(index, thing);
                return logo.type.wordGetItem(index, thing);
            }

            logo.type.validateInputArray(thing);
            logo.type.validateIndexWithinArrayRange(index, thing);
            return logo.type.arrayItem(index, thing);
        }

        function primitiveEmptyp(value) {
            return logo.type.isEmptyString(value) || logo.type.isEmptyList(value);
        }

        return ds;
    }
};
