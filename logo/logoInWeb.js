//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's IO and system driver for browser
// Runs in browser's Logo worker thread

"use strict";

/* global importScripts, CanvasCommon */

var $classObj = {};
$classObj.create = function logoInWeb(Logo, sys) { // eslint-disable-line no-unused-vars

    importScripts("CanvasCommon.js");

    Logo.io = {
        "stdout": webStdout,
        "stdoutn": webStdoutn,
        "stderr": webStderr,
        "stderrn": webStderrn
    };

    const ext = makeLogoDependencies();
    const logo = Logo.create(ext);

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

    function webEditorLoad(src) {
        postMessage(["editorload", src]);
    }

    function webExit(batchMode) {
        if (!batchMode) {
            postMessage(["out", "Thank you for using Logo. Bye!"]);
            postMessage(["out", "(You may now close the window)"]);
        }
    }

    function webEnvState(envState) {
        postMessage([envState]);
    }

    async function webExec(src, srcidx) {
        postMessage(["busy"]);
        await logo.env.exec(src, true, srcidx);
        postMessage([logo.env.getEnvState()]);
    }

    async function webRunSingleTest(testName, testMethod) {
        await Logo.testRunner.runSingleTest(Logo.getUnitTests(), testName, testMethod, logo);
        postMessage([logo.env.getEnvState()]);
    }

    function registerEventHandler(logoUserInputListener) {
        const webMsgHandler = {
            "test": async () => {
                postMessage(["busy"]);
                await Logo.testRunner.runTests(Logo.getUnitTests(), undefined, logo);
                postMessage(["ready"]);
            },
            "run": async (e) => {
                postMessage(["busy"]);
                await logo.env.exec(getMsgBody(e), false, getMsgId(e));
                postMessage([logo.env.getEnvState()]);
            },
            "exec": async (e) => webExec(getMsgBody(e), getMsgId(e)),
            "console": async (e) => {
                postMessage(["busy"]);
                logo.env.setInteractiveMode();
                await logoUserInputListener(getMsgBody(e) + logo.type.NEWLINE);  // needs new line to be treated as completed command
                postMessage([logo.env.getEnvState()]);
            },
            "clearWorkspace": async () => {
                postMessage(["busy"]);
                logo.env.clearWorkspace();
                logo.turtle.draw();
                postMessage(["ready"]);
            },
            "mouseEvent": async (e) => {
                logo.turtle.onMouseEvent(getMsgBody(e));
            }
        };

        self.addEventListener("message",
            async function(e) {
                logo.env.setEnvState("ready");
                sys.assert(getMsgType(e) in webMsgHandler);
                await webMsgHandler[getMsgType(e)](e);
                ext.canvas.flush();
            }, false);
    }

    function getMsgType(e) {
        return e.data[0];
    }

    function getMsgBody(e) {
        return e.data[1];
    }

    function getMsgId(e) {
        return e.data[2];
    }

    function makeLogoDependencies() {
        const canvas = makeCanvas();
        return {
            "entry": {
                "exec": webExec,
                "runSingleTest": webRunSingleTest
            },
            "io": {
                "stdout": webStdout,
                "stdoutn": webStdoutn,
                "stderr": webStderr,
                "stderrn": webStderrn,
                "cleartext": webCleartext,
                "editorload": webEditorLoad,
                "drawflush": function() {
                    ext.canvas.flush();
                },
                "exit": webExit,
                "envstate": webEnvState,
                "onstdin": registerEventHandler
            },
            "canvas": canvas
        };
    }

    function makeCanvas() {
        const canvas = {};
        const tqCacheSize = 128;
        let tqCacheArray = new Float32Array(tqCacheSize);
        let tqCachePtr = 0;

        canvas.sendCmd = function(cmd, args = []) {
            let code = CanvasCommon.getPrimitiveCode(cmd);
            if (code in CanvasCommon.primitivecode) {
                if (tqCachePtr + args.length >= tqCacheSize - 1) {
                    canvas.flush();
                }

                tqCacheArray[++tqCachePtr] = code;
                for (let i = 0; i < args.length; i++) {
                    tqCacheArray[++tqCachePtr] = args[i];
                }
            }
        };

        canvas.sendCmdAsString = function(cmd, args = []) {
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
    }
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
