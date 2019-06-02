//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's IO and system driver for browser
// Runs in browser's Logo worker thread

"use strict";

/* global importScripts, Float32Array, CanvasCommon */

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

    return;

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

    async function webTest() {
        await Logo.testRunner.runTests(Logo.getUnitTests(), undefined, ext);
        postMessage(["ready"]);
    }

    async function webRun(src, srcidx) {
        await logo.env.exec(src, false, srcidx);
        postMessage([logo.env.getEnvState()]);
    }

    async function webExec(src, srcidx) {
        await logo.env.exec(src, true, srcidx);
        postMessage([logo.env.getEnvState()]);
    }

    async function webRunSingleTest(testName, testMethod) {
        await Logo.testRunner.runSingleTest(Logo.getUnitTests(), testName, testMethod, ext);
        postMessage([logo.env.getEnvState()]);
    }

    async function webOnConsole(data, logoUserInputListener) {
        logo.env.setInteractiveMode();
        await logoUserInputListener(data + "\n");  // needs "\n" to be treated as completed command
        postMessage([logo.env.getEnvState()]);
    }

    function webClearWorkspace() {
        logo.env.clearWorkspace();
        logo.turtle.draw();
        postMessage(["ready"]);
    }

    function registerEventHandler(logoUserInputListener) {
        self.addEventListener("message",
            async function(e) {
                let op = e.data[0];
                let data = e.data[1];
                let srcidx = e.data[2];
                logo.env.setEnvState("ready");

                postMessage(["busy"]);
                switch(op) {
                case "test":
                    await webTest();
                    break;
                case "run":
                    await webRun(data, srcidx);
                    break;
                case "exec":
                    await webExec(data, srcidx);
                    break;
                case "console":
                    await webOnConsole(data, logoUserInputListener);
                    break;
                case "clearWorkspace":
                    webClearWorkspace();
                    break;
                default:
                }

                ext.canvas.flush();
            }, false);
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
