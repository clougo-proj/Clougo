//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's runtime library
// Runs in browser's Logo worker thread or Node's main thread

import Ds from "./lib/ds.js";
import Comm from "./lib/comm.js";
import Al from "./lib/al.js";
import Graphics from "./lib/graphics.js";
import Ws from "./lib/ws.js";
import Ctrl from "./lib/ctrl.js";
import Os from "./lib/os.js";
import Misc from "./lib/misc.js";
import Clougo from "./lib/clougo.js";

export default {
    "create": function(logo, sys) {
        const lrt = {};

        const PROC_ATTRIBUTE = logo.constants.PROC_ATTRIBUTE;

        function isSimplePrimitiveDef(entry) {
            return entry instanceof Function;
        }

        function getMethodName(entry) {
            return Array.isArray(entry) ? entry[0] : entry.jsFunc;
        }

        function getMethodFormalString(entry) {
            return Array.isArray(entry) ? entry[1] : entry.formal;
        }

        function getMethodAttributes(entry) {
            return Array.isArray(entry) ? PROC_ATTRIBUTE.PRIMITIVE : entry.attributes;
        }

        function getMethodPrecedence(entry) {
            return Array.isArray(entry) ? 0 : entry.precedence;
        }

        function bindMethods(methods) {
            for (let name in methods) {
                let entry = methods[name];
                if (isSimplePrimitiveDef(entry)) {
                    logo.env.bindPrimitive(name, entry);
                } else {
                    let primitive = getMethodName(entry);
                    let formalString = getMethodFormalString(entry);
                    let formal = formalString ? logo.parse.parseSignature(formalString) : undefined;
                    let attributes = getMethodAttributes(entry);
                    let precedence = getMethodPrecedence(entry);

                    if (formal || attributes || precedence) {
                        logo.env.bindPrimitive(name, primitive, formal, attributes, precedence);
                    } else {
                        logo.env.bindPrimitive(name, primitive);
                    }
                }
            }
        }

        let logoLibrary = {};

        logoLibrary.ds = Ds.create(logo, sys);
        logoLibrary.comm = Comm.create(logo, sys);
        logoLibrary.al = Al.create(logo, sys);
        logoLibrary.graphics = Graphics.create(logo, sys);
        logoLibrary.ws = Ws.create(logo, sys);
        logoLibrary.ctrl = Ctrl.create(logo, sys);
        logoLibrary.os = Os.create(logo, sys);
        logoLibrary.misc = Misc.create(logo, sys);
        logoLibrary.clougo = Clougo.create(logo, sys);

        bindMethods(logoLibrary.ds.methods);
        bindMethods(logoLibrary.comm.methods);
        bindMethods(logoLibrary.al.methods);
        bindMethods(logoLibrary.graphics.methods);
        bindMethods(logoLibrary.ws.methods);
        bindMethods(logoLibrary.ctrl.methods);
        bindMethods(logoLibrary.os.methods);
        bindMethods(logoLibrary.misc.methods);
        bindMethods(logoLibrary.clougo.methods);

        lrt.util = {};

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
            return isBinaryOperator(op) && !logo.env.isProc(op);
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
    }
};
