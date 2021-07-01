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
                primitive[name] = getPrimitive(entry);
                primitiveFormalString[name] = getFormal(entry);
            } else {
                primitive[name] = entry;
            }
        }
    }

    async function primitiveDemo(name) {
        let option = undefined;
        if (logo.type.isLogoList(name)) {
            option = logo.type.listItem(2, name).toLowerCase();
            name = logo.type.listItem(1, name).toLowerCase();
        } else {
            name = name.toLowerCase();
        }

        let demoFileName = name + ".lgo";

        let src = logo.logofs.get("/demo/" + demoFileName);

        if (option !== undefined && option == "load") {
            logo.io.editorLoad(src);
        }

        await logo.entry.exec(src);
    }

    async function dotTest(testName, testMethod) {
        await logo.entry.runSingleTest(testName, testMethod);
    }

    let primitiveFormalString = {};

    let primitive = {

        "demo": primitiveDemo,

        ".test": dotTest
    };
    lrt.primitive = primitive;

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

    lrt.getPrimitiveFormal = (function() {
        const primitiveFormal = {};
        return function getPrimitiveFormal(primitiveName) {
            if (!(primitiveName in primitiveFormal)) {
                if (primitiveName in primitiveFormalString) {
                    primitiveFormal[primitiveName] =
                        logo.env.captureFormalParams(logo.parse.parseSignature(primitiveFormalString[primitiveName]));
                } else {
                    sys.assert(primitiveName in primitive);
                    primitiveFormal[primitiveName] = logo.env.makeDefaultFormal(primitive[primitiveName].length);
                }
            }

            return primitiveFormal[primitiveName];
        };
    })();

    lrt.util = {};

    function getPrimitiveCallTarget(name) {
        return (name in lrt.primitive) ? lrt.primitive[name] : undefined;
    }
    lrt.util.getPrimitiveCallTarget = getPrimitiveCallTarget;

    function logoVar(v, varname, srcmap) {
        if (v === undefined) {
            throw logo.type.LogoException.VAR_HAS_NO_VALUE.withParam([varname], srcmap);
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
        "+" :[2, primitive.sum],
        "-" :[2, primitive.difference],
        "*" :[3, primitive.product],
        "/" :[3, primitive.quotient],
        "==":[1, primitive.equalp, "equalp"],
        "<>":[1, primitive.notequalp, "notequalp"],
        ">=":[1, primitive.greaterequalp],
        ">" :[1, primitive.greaterp],
        "<=":[1, primitive.lessequalp],
        "<" :[1, primitive.lessp]
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
