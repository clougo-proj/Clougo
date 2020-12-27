//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var $classObj = {};
$classObj.create = function(logo, sys) {
    const traceKeys = [
        "parse",
        "parse.result",
        "evx",
        "evalJs",
        "codegen",
        "codegen.genLocal",
        "codegen.lambda",
        "console",
        "lrt",
        "time",
        "draw",
        "tmp"
    ];

    const Trace = {};

    const traceTable = {};
    traceKeys.forEach(v => traceTable[v] = () => {});

    Trace.setTraceOptions = function(keysOn) {
        const reKeysOn = sys.makeMatchListRegexp(keysOn);
        traceKeys.filter(v => v.match(reKeysOn))
            .forEach(v => traceTable[v] = console.error); // eslint-disable-line no-console
    };

    Trace.info = function(text, key) {
        sys.assert(key in traceTable, "Unknown trace key: " + key);
        if (logo.config.get("trace")) {
            traceTable[key](text);
        }
    };

    Trace.getTraceStream = function(key) {
        return traceTable[key];
    };

    return Trace;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
