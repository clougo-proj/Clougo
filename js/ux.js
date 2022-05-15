//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Clougo's UX

/* global $ */

import Logojs from "./logojs.js";

import LogoTerminal from "./logoTerminal.js";

import LogoEditor from "./logoEditor.js";

import Canvas from "./canvas.js";

import logoStorage from "./logoStorage.js";

const TURTLE_CANVAS_SIZE = 1000;

const TURTLE_CANVAS_OFFSET = -500;

function assert(cond, msg) {
    if (!cond) {
        throw Error(msg);
    }
}

const logoTerminal0 = LogoTerminal.create("term", {
    "console": function(text) {
        logojs.console(text);
    }
});

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
        logojs.exec(src);
    } else {
        logojs.run(src);
    }
}

function clearWorkspace() { // eslint-disable-line no-unused-vars
    logojs.clearWorkspace();
    editor.setValue("");
    logoTerminal0.cleartext();
    logoStorage.write("logoSrc", "");
}

function runLogoTest() { // eslint-disable-line no-unused-vars
    logoTerminal0.setBusy("logo");
    logojs.test();
}

const editor = LogoEditor.create("editor");
editor.setValue(logoStorage.read("logoSrc", ""));

function saveEditorContent() {
    logoStorage.write("logoSrc", editor.getValue());
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

    let state = logoStorage.read(settingKey, "fit");

    const zoomTurtleCanvas = function(stateOverride) {
        state = (stateOverride !== undefined) ? stateOverride :
            Object.hasOwn(nextState, state) ? nextState[state] : "fit";

        logoStorage.write(settingKey, state);
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

    let state = logoStorage.read(settingKey, "turtle");

    const changeUpperPane = function(stateOverride) {
        state = (stateOverride !== undefined) ? stateOverride :
            Object.hasOwn(nextState, state) ? nextState[state] : "turtle";

        logoStorage.write(settingKey, state);
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
        "full": "95vh",
        "quarter": "24vh",
        "hidden": "0px"};

    const nextState = {
        "full": "quarter",
        "quarter": "hidden",
        "hidden": "full"};

    let state = logoStorage.read(settingKey, "quarter");

    const adjustTerminal = function(stateOverride) {
        state = (stateOverride !== undefined) ? stateOverride :
            Object.hasOwn(nextState, state) ? nextState[state] : "quarter";

        logoStorage.write(settingKey, state);
        $("#topPane").css("height", topPaneHeight[state]);
        $("#canvasPane").css("height", topPaneHeight[state]);
        $("#editor").css("height", topPaneHeight[state]);
        $("#term").css("height", terminalHeight[state]);
        editor.resize();
    };

    adjustTerminal(state);
    return adjustTerminal;
})();

function turtleUndo() { // eslint-disable-line no-unused-vars
    logojs.turtleUndo();
    turtleCanvas.undo();
}

function canvasSnapshot() {
    turtleCanvas.snapshot();
}

const logojs = Logojs.create({
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

const turtleCanvas = Canvas.create("turtleCanvas", {
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
        logojs.onKeyboardEvent(createKeyboardMsg("down", e.key, e.code));
    }
});

document.addEventListener("keyup", (e) => {
    if (allowKeyboardEvents(e)) {
        logojs.onKeyboardEvent(createKeyboardMsg("up", e.key, e.code));
    }
});

function allowKeyboardEvents() {
    return document.activeElement.id === "canvasPane";
}

function createKeyboardMsg(msgType, key, code) {
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
    logojs.onMouseEvent(createMouseMsg(e, "move"));
}

function onMouseClick(e) { // eslint-disable-line no-unused-vars
    logojs.onMouseEvent(createMouseMsg(e, "click"));
}

function onMouseDown(e) { // eslint-disable-line no-unused-vars
    logojs.onMouseEvent(createMouseMsg(e, "down"));
}

function onMouseUp(e) { // eslint-disable-line no-unused-vars
    logojs.onMouseEvent(createMouseMsg(e, "up"));
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
    let configOverride = JSON.parse(logoStorage.read("configOverride", "{}"));
    let onParams = getUrlParams("on");
    let offParams = getUrlParams("off");
    if (onParams !== null) {
        onParams.split(/ /).forEach(key =>{ configOverride[key] = true; });
    }

    if (offParams !== null) {
        offParams.split(/ /).forEach(key =>{ configOverride[key] = false; });
    }

    logoStorage.write("configOverride", JSON.stringify(configOverride));
    return configOverride;
}

window.addEventListener("load", () => {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register(new URL("/service-worker.js", import.meta.url), {type: "module"});
    }
});

let configOverride = getConfigOverride();
logojs.config(configOverride);

if (configOverride["unitTestButton"]) {
    $("#menubar").append("<li><a id=\"runLogoTestBtn\" data-toggle=\"tab\"><span class=\"glyphicon glyphicon-wrench\"></span></a></li>");
}

$("#clearWorkspaceBtn")[0].onclick = () => {
    if (confirm("Are you sure you wish to ERASE ALL?")) {
        clearWorkspace();
    }
};

$("#zoomTurtleCanvasBtn")[0].onclick = () => zoomTurtleCanvas();

$("#changeUpperPaneBtn")[0].onclick = () => changeUpperPane();

$("#adjustTerminalBtn")[0].onclick = () => adjustTerminal();

$("#turtleUndoBtn")[0].onclick = () => turtleUndo();

$("#runProgramBtn")[0].onclick = () => runProgram(true);

$("#runLogoTestBtn")[0].onclick = () => runLogoTest();

$("#canvasPane")[0].oncontextmenu = onContextMenu;

$("#canvasPane")[0].onmousemove = onMouseMove;

$("#canvasPane")[0].onmousedown = onMouseDown;

$("#canvasPane")[0].onmouseup = onMouseUp;

$("#canvasPane")[0].onclick = onMouseClick;
