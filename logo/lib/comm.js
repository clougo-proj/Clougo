//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements Logo's communication (I/O) primitives
// Runs in Logo worker thread

"use strict";

var $obj = {};
$obj.create = function(logo) {
    const comm = {};

    const methods = {
        "print": [primitivePrint, "[args] 1"],
        "pr": [primitivePrint, "[args] 1"],

        "type": [primitiveType, "[args] 1"],

        "show": [primitiveShow, "[args] 1"],

        "readword": primitiveReadword,

        "readlist": primitiveReadlist,
        "rl": primitiveReadlist,

        "cleartext": primitiveCleartext,
        "ct": primitiveCleartext,

    };
    comm.methods = methods;

    function primitivePrint(...args) {
        logo.io.stdout(args.map(v => logo.type.toString(v)).join(" "));
    }

    function primitiveShow(...args) {
        logo.io.stdout(args.map(v => logo.type.toString(v, true)).join(" "));
    }

    function primitiveType(...args) {
        logo.io.stdoutn(args.map(v => logo.type.toString(v)).join(""));
    }

    async function primitiveReadword() {
        return await readHelper();
    }

    async function primitiveReadlist() {
        let userInput = await readHelper();
        return logo.type.makeLogoList(userInput.split(" "));
    }

    async function readHelper() {
        if (logo.env.hasUserInput()) {
            return logo.env.getUserInput();
        }

        logo.env.prepareToBeBlocked();
        do {
            await new Promise((resolve) => {
                logo.env.registerUserInputResolver(resolve);
            });
        } while (!logo.env.hasUserInput());

        return logo.env.getUserInput();
    }

    function primitiveCleartext() {
        logo.io.cleartext();
    }

    return comm;
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
