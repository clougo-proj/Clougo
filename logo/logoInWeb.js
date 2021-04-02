//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's IO and system driver for browser
// Runs in browser's Logo worker thread

"use strict";

/* global importScripts, CanvasCommon */

importScripts("CanvasCommon.js");

var $obj = {};
$obj.create = function logoInWeb(Logo, sys) { // eslint-disable-line no-unused-vars

    const LOGO_EVENT = Logo.constants.LOGO_EVENT;

    const LOGO_METHOD = Logo.constants.LOGO_METHOD;

    postMessage([LOGO_EVENT.BUSY]);

    Logo.io = {
        "stdout": webStdout,
        "stdoutn": webStdoutn,
        "stderr": webStderr,
        "stderrn": webStderrn
    };

    const ext = makeLogoDependencies();
    const logo = Logo.create(ext);

    logo.env.loadDefaultLogoModules()
        .then(() => postMessage([LOGO_EVENT.READY]));

    function webStdout(text) {
        postMessage([LOGO_EVENT.OUT, text]);
    }

    function webStdoutn(text) {
        postMessage([LOGO_EVENT.OUTN, text]);
    }

    function webStderr(text) {
        postMessage([LOGO_EVENT.ERR, text]);
    }

    function webStderrn(text) {
        postMessage([LOGO_EVENT.ERRN, text]);
    }

    function webCleartext() {
        postMessage([LOGO_EVENT.CLEAR_TEXT]);
    }

    function webEditorLoad(src) {
        postMessage([LOGO_EVENT.EDITOR_LOAD, src]);
    }

    function webExit(batchMode) {
        if (!batchMode) {
            postMessage([LOGO_EVENT.OUT, "Thank you for using Logo. Bye!"]);
            postMessage([LOGO_EVENT.OUT, "(You may now close the window)"]);
        }
    }

    function webEnvState(envState) {
        postMessage([envState]);
    }

    async function webExec(src, srcidx) {
        postMessage([LOGO_EVENT.BUSY]);
        await logo.env.exec(src, true, srcidx);
        postMessage([logo.env.getEnvState()]);
    }

    async function webRunSingleTest(testName, testMethod) {
        await Logo.testRunner.runSingleTest(Logo.getUnitTests(), testName, testMethod, logo);
        postMessage([logo.env.getEnvState()]);
    }

    function registerEventHandler(logoUserInputListener) {
        const webMsgHandler = {};

        webMsgHandler[LOGO_METHOD.TEST] = async function() {
            postMessage([LOGO_EVENT.BUSY]);
            await Logo.testRunner.runTests(Logo.getUnitTests(), undefined, logo);
            postMessage([LOGO_EVENT.READY]);

        };

        webMsgHandler[LOGO_METHOD.RUN] = async function(e) {
            postMessage([LOGO_EVENT.BUSY]);
            await logo.env.exec(getMsgBody(e), false, getMsgId(e));
            postMessage([logo.env.getEnvState()]);
        };

        webMsgHandler[LOGO_METHOD.EXEC] = async function(e) {
            webExec(getMsgBody(e), getMsgId(e));
        };

        webMsgHandler[LOGO_METHOD.CONSOLE] = async function(e) {
            postMessage([LOGO_EVENT.BUSY]);
            logo.env.setInteractiveMode();
            await logoUserInputListener(getMsgBody(e) + logo.type.NEWLINE);  // needs new line to be treated as completed command
            postMessage([logo.env.getEnvState()]);
        };

        webMsgHandler[LOGO_METHOD.CLEAR_WORKSPACE] = async function() {
            postMessage([LOGO_EVENT.BUSY]);
            logo.env.clearWorkspace();
            logo.env.loadDefaultLogoModules();
            logo.turtle.draw();
            postMessage([LOGO_EVENT.READY]);
        };

        webMsgHandler[LOGO_METHOD.MOUSE_EVENT] = async function(e) {
            logo.turtle.onMouseEvent(getMsgBody(e));
        };

        webMsgHandler[LOGO_METHOD.CONFIG] = async function(e) {
            logo.config.override(getMsgBody(e));
            logo.env.loadDefaultLogoModules();
        };

        // listen to events in the worker
        self.addEventListener("message",
            async function(e) {
                logo.env.setEnvState(LOGO_EVENT.READY);
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
                postMessage([LOGO_EVENT.CANVAS, [].concat(length, code, args)]);
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
    exports.$obj = $obj;
}
