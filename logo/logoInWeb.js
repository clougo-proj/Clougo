//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's IO and system driver for browser
// Runs in browser's Logo worker thread

"use strict";

/* global importScripts, Float32Array, CanvasCommon, unittests */

var classObj = {};
classObj.create = function logoInWeb(Logo, sys) {

    importScripts("CanvasCommon.js");

    function webStdout(text) {
        postMessage(["out", text]);
    }

    function webStdoutn(text) {
        postMessage(["outn", text]);
    }

    function webStderr(text) {
        postMessage(["err", text]);
    }

    function webStderrn(text) {
        postMessage(["errn", text]);
    }

    function webCleartext() {
        postMessage(["cleartext"]);
    }

    Logo.io = {
        "stdout": webStdout,
        "stdoutn": webStdoutn,
        "stderr": webStderr,
        "stderrn": webStderrn,
        "cleartext": webCleartext
    };

    let canvas = (function() {
        const canvas = {};
        const tqCacheSize = 128;
        let tqCacheArray = new Float32Array(tqCacheSize);
        let tqCachePtr = 0;

        canvas.sendCmd = function(cmd, args) {
            if (sys.isUndefined(args)) {
                args = [];
            }

            let code = CanvasCommon.getPrimitiveCode(cmd);
            if (code in CanvasCommon.primitivecode) {
                if (tqCachePtr + args.length >= tqCacheSize) {
                    canvas.flush();
                }

                tqCacheArray[++tqCachePtr] = code;
                for (let i = 0; i < args.length; i++) {
                    tqCacheArray[++tqCachePtr] = args[i];
                }
            }
        };

        canvas.sendCmdAsString = function(cmd, args) {
            if (sys.isUndefined(args)) {
                args = [];
            }

            let code = CanvasCommon.getPrimitiveCode(cmd);
            if (code in CanvasCommon.primitivecode) {
                let length = args.length + 2;
                canvas.flush();
                postMessage(["canvas", [].concat(length, code, args)]);
            }
        };

        canvas.flush = function() {
            if (tqCachePtr==0) return;
            tqCacheArray[0] = tqCachePtr + 1; // store the length as first element;
            postMessage(tqCacheArray.buffer, [tqCacheArray.buffer]); // pass by reference
            tqCacheArray = new Float32Array(tqCacheSize);
            tqCachePtr = 0;
        };

        return canvas;
    })();

    const ext = {
        "io": {
            "stdout": webStdout,
            "stdoutn": webStdoutn,
            "stderr": webStderr,
            "stderrn": webStderrn,
            "cleartext": webCleartext
        },
        "canvas": canvas
    };

    ext.io.onstdin = function(logoUserInputListener) {
        self.addEventListener("message",
            function(e) {
                let op = e.data[0];
                let data = e.data[1];
                let srcidx = e.data[2];
                let ret = undefined;
                logo.env.setParserState("ready");

                postMessage(["busy"]);
                if (op == "test") {
                    importScripts(Logo.unitTestsJsSrcFile);
                    Logo.testJsSrcFileHelper(unittests, undefined, ext);
                    postMessage(["ready"]);
                } else if (op == Logo.mode.RUN) {
                    ret = logo.env.exec(data, false, srcidx);
                    postMessage(["ready"]);
                } else if (op == "exec") {
                    ret = logo.env.exec(data, true, srcidx);
                    postMessage(["ready"]);
                } else if (op == "console") {  // command entered in console
                    logo.env.setInteractiveMode();

                    let logoStatus = logoUserInputListener(data + "\n");  // needs "\n" to be treated as completed command
                    postMessage([logoStatus]);
                }

                if (!sys.isUndefined(ret)) {
                    sys.stdout("Result:"  + logo.type.logoToString(ret));
                }

                ext.canvas.flush();
            }, false);
    };

    // logo environment for interative mode and run/exec
    const logo = Logo.create(ext);
};

if (typeof exports != "undefined") {
    exports.classObj = classObj;
}
