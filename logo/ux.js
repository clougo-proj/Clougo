//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's runtime library
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

/* global jQuery, $, ace, createTurtleCanvas, Constants */

const TURTLE_CANVAS_SIZE = 1000;

const TURTLE_CANVAS_OFFSET = -500;

const LOGO_EVENT = Constants.LOGO_EVENT;

const LOGO_METHOD = Constants.LOGO_METHOD;

function assert(cond, msg) {
    if (!cond) {
        throw Error(msg);
    }
}

function createLogoTerminal(eventHandler) {

    let curLine = "";

    let thisTerm = {
        "echo": function() {},
        "set_prompt": function() {},
        "pause": function() {},
        "resume": function() {},
        "clear": function() {}
    };

    const isReady = {
        "logo": true,
        "canvas": true
    };

    function setReady(id, val) {
        if (id in isReady) {
            isReady[id] = val;
        }
    }

    function getAllReady() {
        return Object.keys(isReady)
            .map(e => isReady[e])
            .reduce(
                function(acc, cur) { return acc && cur; }
            );
    }

    jQuery(document).ready($ => {
        $("#term").terminal(command => {
            if (getAllReady()) {
                thisTerm.pause();
                eventHandler.console(command);
            }
        }, {
            greetings: "Welcome to Logo",
            name: "LogoTerm",
            onInit : function (term) {
                thisTerm = term;
            },
            clear: false,
            prompt: "? "
        });
    });

    return {
        "write": function(text) {
            curLine += text;
        },
        "writeln": function(text) {
            thisTerm.echo(curLine + text);
            curLine = "";
        },
        "prompt": function(text) {
            thisTerm.echo(curLine);
            curLine = "";
            thisTerm.set_prompt(text);
        },
        "user": function() {
            thisTerm.set_prompt(curLine);
            curLine = "";
        },
        "setBusy": function(id) {
            setReady(id, false);
            thisTerm.pause();
        },
        "setReady": function(id) {
            setReady(id, true);
            if (getAllReady()) {
                thisTerm.resume();
            }
        },
        "cleartext": function() {
            thisTerm.clear();
        }
    };
}

const logoTerminal0 = createLogoTerminal({
    "console": function(text) {
        logoWorker.console(text);
    }
});

function readLogoStorage(key, defaultValue) {
    let ret = localStorage.getItem(key);
    if (ret === null) {
        return defaultValue;
    }

    return ret;
}

function writeLogoStorage(key, value) {
    localStorage.setItem(key, value);
}

// http://localhost:8080/?on=unitTestButton
const getUrlParams = (() => {
    let urlParams = typeof URLSearchParams !== "undefined" ? new URLSearchParams(window.location.search) : undefined;
    return function(key) {
        return urlParams && urlParams.get(key);
    };
})();

function runProgram(transpile) { // eslint-disable-line no-unused-vars
    saveEditorContent();
    let src = editor.getValue();
    logoTerminal0.setBusy("logo");
    if (transpile) {
        logoWorker.exec(src);
    } else {
        logoWorker.run(src);
    }
}

function clearWorkspace() { // eslint-disable-line no-unused-vars
    logoWorker.clearWorkspace();
    editor.setValue("");
    logoTerminal0.cleartext();
    writeLogoStorage("logoSrc", "");
}

function runLogoTest() { // eslint-disable-line no-unused-vars
    logoTerminal0.setBusy("logo");
    logoWorker.test();
}

const editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.setBehavioursEnabled(false);
editor.getSession().setMode("ace/mode/logo");

editor.setValue(readLogoStorage("logoSrc", ""));
editor.setOptions({
    fontSize: "12pt",
    tabSize: 2,
    useSoftTabs: true
});

function saveEditorContent() {
    writeLogoStorage("logoSrc", editor.getValue());
}

window.setInterval(saveEditorContent, 1000);


const zoomTurtleCanvas = (() => {  // eslint-disable-line no-unused-vars
    const settingKey = "$settings$turtleCanvasZoom$";
    const turtleCanvasHeight = {
        "fit": "92vh",
        "pixel": "1000px" };

    const turtleGlyphicon = {
        "fit": "glyphicon glyphicon-zoom-in",
        "pixel": "glyphicon glyphicon-zoom-out" };

    const nextState = {
        "fit": "pixel",
        "pixel": "fit"};

    let state = readLogoStorage(settingKey, "fit");

    const zoomTurtleCanvas = function(stateOverride) {
        state = (stateOverride === undefined) ? nextState[state] : stateOverride;
        writeLogoStorage(settingKey, state);
        $("#turtleCanvas").css("height", turtleCanvasHeight[state]);
        $("#zoomTurtleCanvasButton").attr("class", turtleGlyphicon[state]);
    };

    zoomTurtleCanvas(state);
    return zoomTurtleCanvas;
})();

const changeUpperPane = (() => { // eslint-disable-line no-unused-vars
    const settingKey = "$settings$viewState$";
    const canvasPaneWidth = {
        "turtle": "99vw",
        "editor": "0px",
        "split": "50vw" };

    const editorWidth = {
        "turtle": "0px",
        "editor": "99vw",
        "split": "49vw" };

    const nextState = {
        "turtle": "editor",
        "editor": "split",
        "split": "turtle"};

    let state = readLogoStorage(settingKey, "turtle");

    const changeUpperPane = function(stateOverride) {
        state = (stateOverride === undefined) ? nextState[state] : stateOverride;
        writeLogoStorage(settingKey, state);
        $("#canvasPane").css("width", canvasPaneWidth[state]);
        $("#editor").css("width", editorWidth[state]);
        editor.resize();
    };

    changeUpperPane(state);
    return changeUpperPane;
})();

const adjustTerminal = (() => { // eslint-disable-line no-unused-vars
    const settingKey = "$settings$terminalState$";
    const topPaneHeight = {
        "full": "0px",
        "quarter": "71vh",
        "hidden": "93vh"};

    const terminalHeight = {
        "full": "93vh",
        "quarter": "22vh",
        "hidden": "0px"};

    const terminalClass = {
        "full": "col span12 terminal",
        "quarter": "col span12 terminal",
        "hidden": "col span12 terminal hidden"};

    const nextState = {
        "full": "quarter",
        "quarter": "hidden",
        "hidden": "full"};

    let state = readLogoStorage(settingKey, "quarter");

    const adjustTerminal = function(stateOverride) {
        state = (stateOverride === undefined) ? nextState[state] : stateOverride;
        writeLogoStorage(settingKey, state);
        $("#topPane").css("height", topPaneHeight[state]);
        $("#canvasPane").css("height", topPaneHeight[state]);
        $("#editor").css("height", topPaneHeight[state]);
        $("#term").attr("class", terminalClass[state]);
        $("#term").css("height", terminalHeight[state]);
        editor.resize();
    };

    adjustTerminal(state);
    return adjustTerminal;
})();

function createLogoWorker(eventHandler) {
    if(typeof(Worker) === "undefined") {
        return undefined;
    }

    let worker = new Worker("logo/logo.js");

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

function turtleUndo() { // eslint-disable-line no-unused-vars
    logoWorker.turtleUndo();
    turtleCanvas.undo();
}

function canvasSnapshot() {
    turtleCanvas.snapshot();
}

const logoWorker = createLogoWorker({
    "canvas": function(tqcache) {
        turtleCanvas.receive(tqcache);
    },
    "ready": function() {
        logoTerminal0.setReady("logo");
    },
    "busy": function() {
        logoTerminal0.setBusy("logo");
    },
    "prompt": function(prompt) {
        logoTerminal0.prompt(prompt);
    },
    "user": function() {
        logoTerminal0.user();
    },
    "write": function(text) {
        logoTerminal0.write(text);
    },
    "writeln": function(text) {
        logoTerminal0.writeln(text);
    },
    "cleartext": function() {
        logoTerminal0.cleartext();
    },
    "exit": function() {
        logoTerminal0.setBusy("logo");
    },
    "editorLoad": function(src) {
        editor.setValue(editor.getValue() + "\n" + src);
    },
    "canvasSnapshot": function() {
        canvasSnapshot();
    }
});

const turtleCanvas = createTurtleCanvas("turtleCanvas", {
    "turtleReady": function() { logoTerminal0.setReady("canvas"); },
    "turtleBusy": function() { logoTerminal0.setBusy("canvas"); },
    "setBackgroundColor": function(color) {
        $("#turtleCanvas").css("background-color", color);
        $("#canvasPane").css("background-color", color);
    },
    "assert": assert
});

document.addEventListener("keydown", (e) => {
    if (allowKeyboardEvents(e)) {
        logoWorker.onKeyboardEvent(createKeyboarMsg("down", e.key, e.code));
    }
});

document.addEventListener("keyup", (e) => {
    if (allowKeyboardEvents(e)) {
        logoWorker.onKeyboardEvent(createKeyboarMsg("up", e.key, e.code));
    }
});

function allowKeyboardEvents() {
    return document.activeElement.id === "canvasPane";
}

function createKeyboarMsg(msgType, key, code) {
    return [
        msgType,
        {
            "key": key,
            "code": code
        }
    ];
}

function onContextMenu(e) { // eslint-disable-line no-unused-vars
    e.preventDefault();
    return false;
}

function onMouseMove(e) { // eslint-disable-line no-unused-vars
    logoWorker.onMouseEvent(createMouseMsg(e, "move"));
}

function onMouseClick(e) { // eslint-disable-line no-unused-vars
    logoWorker.onMouseEvent(createMouseMsg(e, "click"));
}

function onMouseDown(e) { // eslint-disable-line no-unused-vars
    logoWorker.onMouseEvent(createMouseMsg(e, "down"));
}

function onMouseUp(e) { // eslint-disable-line no-unused-vars
    logoWorker.onMouseEvent(createMouseMsg(e, "up"));
}

function createMouseMsg(e, msgType) {
    let canvasPane = $("#canvasPane");
    let position = canvasPane.position();
    let x0 = position.left;
    let y0 = position.top;
    let x = canvasPane.scrollLeft();
    let y = canvasPane.scrollTop();
    let w = canvasPane[0].scrollWidth;
    let h =  $("#turtleCanvas").height();

    let posX = toTurtleCoord(e.clientX, x0 + (w - h) * 0.5, x, h, TURTLE_CANVAS_SIZE, TURTLE_CANVAS_OFFSET);
    let posY = -toTurtleCoord(e.clientY, y0, y, h, TURTLE_CANVAS_SIZE, TURTLE_CANVAS_OFFSET);

    return [msgType, posX, posY, e.button];
}

function toTurtleCoord(pixPos, edge, scrollPos, pixRange, logicRange, logicOffset) {
    return Math.round((pixPos - edge + scrollPos) * logicRange / pixRange + logicOffset);
}

function getConfigOverride() {
    let configOverride = JSON.parse(readLogoStorage("configOverride", "{}"));
    let onParams = getUrlParams("on");
    let offParams = getUrlParams("off");
    if (onParams !== null) {
        onParams.split(/ /).forEach(key =>{ configOverride[key] = true; });
    }

    if (offParams !== null) {
        offParams.split(/ /).forEach(key =>{ configOverride[key] = false; });
    }

    writeLogoStorage("configOverride", JSON.stringify(configOverride));
    return configOverride;
}

let configOverride = getConfigOverride();
logoWorker.config(configOverride);

if (configOverride["unitTestButton"]) {
    $("#menubar").append("<li><a onclick=\"runLogoTest()\" data-toggle=\"tab\"><span class=\"glyphicon glyphicon-wrench\"></span></a></li>");
}
