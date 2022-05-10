//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

import Constants from "./constants.js";

const LOGO_EVENT = Constants.LOGO_EVENT;

const LOGO_METHOD = Constants.LOGO_METHOD;

export default {
    "create": function create(eventHandler) {
        if(typeof(Worker) === "undefined") {
            return undefined;
        }

        let worker =new Worker(new URL("logoWorker.js", import.meta.url), {type: "module"});

        // handles messages from logo worker
        worker.onmessage = function(event) {
            let msg = event.data;

            if (msg instanceof ArrayBuffer) {
                let tqcache = new Float32Array(msg);
                eventHandler.canvas(tqcache);
                return;
            }

            switch(msg[0]) {
            case LOGO_EVENT.CANVAS:
                // message for turtle canvas
                eventHandler.canvas(msg[1]);
                break;
            case LOGO_EVENT.READY:
            case LOGO_EVENT.MULTILINE:
            case LOGO_EVENT.VERTICAL_BAR:
            {
                // ready for logo command line input
                let prompt = (msg[0] == LOGO_EVENT.MULTILINE) ? "> " :
                    (msg[0] == LOGO_EVENT.VERTICAL_BAR) ? "| " :
                        (msg[0] == LOGO_EVENT.READY) ? "? " : "";

                eventHandler.ready();
                eventHandler.prompt(prompt);
                break;
            }
            case LOGO_EVENT.CONTINUE:
                // ready for user interative input (e.g. readword)
                eventHandler.ready();
                eventHandler.user();
                break;
            case LOGO_EVENT.OUT:
            case LOGO_EVENT.ERR:
                // out/err stream with newline
                eventHandler.writeln(msg[1]);
                break;
            case LOGO_EVENT.OUTN:
            case LOGO_EVENT.ERRN:
                // out/err stream w/o newline
                eventHandler.write(msg[1]);
                break;
            case LOGO_EVENT.CLEAR_TEXT:
                // cleartext in terminal
                eventHandler.cleartext();
                break;
            case LOGO_EVENT.BUSY:
                // logo work is busy (vs. ready)
                eventHandler.busy();
                break;
            case LOGO_EVENT.EXIT:
                eventHandler.prompt("You can now close the window");
                eventHandler.exit();
                break;
            case LOGO_EVENT.EDITOR_LOAD:
                eventHandler.editorLoad(msg[1]);
                break;
            case LOGO_EVENT.CANVAS_SNAPSHOT:
                eventHandler.canvasSnapshot();
                break;
            default:
            }
        };

        return {
            "console": function(param) {
                worker.postMessage([LOGO_METHOD.CONSOLE, param]);
            },
            "exec": function(param) {
                worker.postMessage([LOGO_METHOD.EXEC, param, "** Editor **"]);
            },
            "run": function(param) {
                worker.postMessage([LOGO_METHOD.RUN, param, 1]);
            },
            "test": function() {
                worker.postMessage([LOGO_METHOD.TEST]);
            },
            "config": function(config) {
                worker.postMessage([LOGO_METHOD.CONFIG, config]);
            },
            "clearWorkspace": function() {
                worker.postMessage([LOGO_METHOD.CLEAR_WORKSPACE]);
            },
            "onKeyboardEvent": function(event) {
                worker.postMessage([LOGO_METHOD.KEYBOARD_EVENT, event]);
            },
            "onMouseEvent": function(event) {
                worker.postMessage([LOGO_METHOD.MOUSE_EVENT, event]);
            },
            "turtleUndo": function() {
                worker.postMessage([LOGO_METHOD.TURTLE_UNDO]);
            }
        };
    }
};