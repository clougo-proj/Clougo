//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's runtime library
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

/* global jQuery, $, ArrayBuffer, Float32Array, ace, createTurtleCanvas */

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
            .map(function(e){ return isReady[e]; })
            .reduce(
                function(acc, cur) { return acc && cur; }
            );
    }

    jQuery(document).ready(function($) {
        $("#term").terminal(function(command) {
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

// http://localhost:8080/?mode=beta&lpk=unittest
const getUrlParams = (function() {
    let urlParams = typeof URLSearchParams !== "undefined" ? new URLSearchParams(window.location.search) : undefined;
    return function(key) {
        return urlParams && urlParams.get(key);
    };
})();

function runProgram(compile) { // eslint-disable-line no-unused-vars
    let text = editor.getValue();
    writeLogoStorage("logoSrc", text);

    logoTerminal0.setBusy("logo");
    if (compile) {
        logoWorker.exec(text);
    } else {
        logoWorker.run(text);
    }
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

const zoomTurtleCanvas = (function() {  // eslint-disable-line no-unused-vars
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

const changeUpperPane = (function() { // eslint-disable-line no-unused-vars
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

const adjustTerminal = (function() { // eslint-disable-line no-unused-vars
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

    worker.onmessage = function(event) {
        let msg = event.data;

        if (msg instanceof ArrayBuffer) {
            let tqcache = new Float32Array(msg);
            eventHandler.canvas(tqcache);
            return;
        }

        switch(msg[0]) {
        case "canvas":
            eventHandler.canvas(msg[1]);
            break;
        case "ready":
        case "multiline":
        {
            let prompt = (msg[0] == "ready") ? "? " : "> ";
            eventHandler.ready();
            eventHandler.prompt(prompt);
            break;
        }
        case "continue":
            eventHandler.ready();
            eventHandler.user();
            break;
        case "out":
        case "err":
            eventHandler.writeln(msg[1]);
            break;
        case "outn":
        case "errn":
            eventHandler.write(msg[1]);
            break;
        case "busy":
            eventHandler.busy();
            break;
        case "cleartext":
            eventHandler.cleartext();
            break;
        default:
        }
    };

    return {
        "console": function(param) {
            worker.postMessage(["console", param, 0]);
        },
        "exec": function(param) {
            worker.postMessage(["exec", param, 1]);
        },
        "run": function(param) {
            worker.postMessage(["run", param, 1]);
        },
        "test": function() {
            worker.postMessage(["test"]);
        }
    };
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

if (getUrlParams("mode") == "beta") {
    $("#menubar").append("<li><a onclick=\"runLogoTest()\" data-toggle=\"tab\"><span class=\"glyphicon glyphicon-wrench\"></span></a></li>");
}
