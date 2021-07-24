//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's runtime library
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

var $obj = {};
$obj.create = function(logo, sys) {
    const lrt = {};

    const LOGO_LIBRARY = logo.constants.LOGO_LIBRARY;

    function containsFormalString(entry) {
        return Array.isArray(entry) && entry.length >= 2;
    }

    function getPrimitive(entry) {
        return entry[0];
    }

    function getFormal(entry) {
        return entry[1];
    }

    function bindMethods(methods) {
        for (let name in methods) {
            let entry = methods[name];
            if (containsFormalString(entry)) {
                logo.env.bindPrimitive(name, getPrimitive(entry), logo.parse.parseSignature(getFormal(entry)));
            } else {
                logo.env.bindPrimitive(name, entry);
            }
        }
    }

    let logoLibrary = {};

    function bindPrimitiveMethods(libName, path) {
        if (path === undefined) {
            path = "./lib/" + libName + ".js";
        }

        let namespaceObject = sys.util.fromJs(path).create(logo, sys);
        logoLibrary[libName] = namespaceObject;
        bindMethods(namespaceObject.methods);
    }

    Object.values(LOGO_LIBRARY).forEach((libName) => bindPrimitiveMethods(libName));

    lrt.util = {};

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
        "+" :[2, logo.env.getPrimitive("sum")],
        "-" :[2, logo.env.getPrimitive("difference")],
        "*" :[3, logo.env.getPrimitive("product")],
        "/" :[3, logo.env.getPrimitive("quotient")],
        "==":[1, logo.env.getPrimitive("equalp"), "equalp"],
        "<>":[1, logo.env.getPrimitive("notequalp"), "notequalp"],
        ">=":[1, logo.env.getPrimitive("greaterequalp")],
        ">" :[1, logo.env.getPrimitive("greaterp")],
        "<=":[1, logo.env.getPrimitive("lessequalp")],
        "<" :[1, logo.env.getPrimitive("lessp")]
    };

    function isBinaryOperator(op) {
        return op in binaryOperator;
    }
    lrt.util.isBinaryOperator = isBinaryOperator;

    function isOnlyBinaryOperator(op) {
        return isBinaryOperator(op) && !isUnaryOperator(op);
    }
    lrt.util.isOnlyBinaryOperator = isOnlyBinaryOperator;

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

    function getLibrary(libName) {
        sys.assert(libName in logoLibrary);
        return logoLibrary[libName];
    }
    lrt.util.getLibrary = getLibrary;

    return lrt;
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
