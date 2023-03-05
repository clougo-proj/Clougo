//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Clougo's UX

/* global $ */

import Logojs from "../logo/logojs.js";

import LogoTerminal from "./logoTerminal.js";

import LogoEditor from "./logoEditor.js";

import Canvas from "./canvas.js";

import logoStorage from "./logoStorage.js";

import Constants from "../logo/constants.js";

const TURTLE_CANVAS_SIZE = 1000;

const TURTLE_CANVAS_OFFSET = -500;

const TOP_FOCUS_NAME = "Clougo";

const LOGO_EVENT = Constants.LOGO_EVENT;

const FOCUS_ID = {
    "Empty": "",
    "Terminal": "term",
    "Terminal Input": "term-input",
    "Canvas": "canvasPane",
};

const FOCUS_CLASS = {
    "Editor": "ace_text-input"
};

const FOCUS_BY_ID = swapKeyValue(FOCUS_ID);

const FOCUS_BY_CLASS = swapKeyValue(FOCUS_CLASS);

function swapKeyValue(obj) {
    const ret = {};
    Object.keys(obj).forEach(key => {
        ret[obj[key]] = key;
    });

    return ret;
}

function assert(cond, msg) {
    if (!cond) {
        throw Error(msg);
    }
}

const logoTerminal0 = LogoTerminal.create("term", {
    "console": function(text) {
        logojs.method.console(text);
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
        logojs.method.exec(src);
    } else {
        logojs.method.run(src);
    }
}

function clearWorkspace() { // eslint-disable-line no-unused-vars
    logojs.method.clearWorkspace();
    editor.setValue("");
    logoTerminal0.cleartext();
    logoStorage.write("logoSrc", "");
}

function runLogoTest() { // eslint-disable-line no-unused-vars
    logoTerminal0.setBusy("logo");
    logojs.method.test();
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

function canSplitElement(id) {
    let element = document.getElementById(id);
    return element.clientWidth > element.clientHeight * 1.5;
}

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

        if (state == "split" && !canSplitElement("topPane")) {
            state = nextState[state];
        }

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
    logojs.method.turtleUndo();
    turtleCanvas.undo();
}

const turtleCanvas = Canvas.create("turtleCanvas", {
    "turtleReady": function() { logoTerminal0.setReady("canvas"); },
    "turtleBusy": function() { logoTerminal0.setBusy("canvas"); },
    "setBackgroundColor": function(color) {
        $("#turtleCanvas").css("background-color", color);
        $("#canvasPane").css("background-color", color);
    },
    "assert": assert
});

const logoEvent = {
    "ready": ready,
    "multiline": multiline,
    "verticalBar": verticalBar,
    "continue": _continue,
    "busy": busy,
    "exit": exit,
    "out": logoTerminal0.writeln,
    "err": logoTerminal0.writeln,
    "outn": logoTerminal0.write,
    "errn": logoTerminal0.write,
    "draw": turtleCanvas.receive,
    "canvasSnapshot": turtleCanvas.snapshot,
    "cleartext": logoTerminal0.cleartext,
    "editorLoad": (src) => editor.setValue(editor.getValue() + "\n" + src),
    "getfocus": getFocus,
    "setfocus": setFocus
};

const logoHost = {
    "call": (...args) => {
        let callId = args.shift();
        let procName = args.shift();
        if (procName in logoEvent) {
            logojs.method.returnValue(logoEvent[procName].apply(null, args), callId);
        }
    }
};

let configOverride = getConfigOverride();
if (configOverride["unitTestButton"]) {
    $("#menubar").append("<li><a id=\"runLogoTestBtn\" data-toggle=\"tab\"><span class=\"glyphicon glyphicon-wrench\"></span></a></li>");
}

const logojs = Logojs.create(logoHost, configOverride);

function ready() {
    logoTerminal0.setReady("logo");
    logoTerminal0.prompt("? ");
}

function multiline() {
    logoTerminal0.setReady("logo");
    logoTerminal0.prompt("> ");
}

function verticalBar() {
    logoTerminal0.setReady("logo");
    logoTerminal0.prompt("| ");
}

function _continue() {
    logoTerminal0.setReady("logo");
    logoTerminal0.user();
}

function busy() {
    logoTerminal0.setBusy("logo");
}

function exit() {
    logoTerminal0.writeln("(You can now close the window)");
    logoTerminal0.setBusy("logo");
}

function setFocus(name) {
    if (Object.hasOwn(FOCUS_ID, name)) {
        document.getElementById(FOCUS_ID[name]).focus();
    } else if (Object.hasOwn(FOCUS_CLASS, name)) {
        document.getElementsByClassName(FOCUS_CLASS[name])[0].focus();
    }
}

function getFocus() {
    let focusId = document.activeElement.id;
    if (focusId && Object.hasOwn(FOCUS_BY_ID, focusId)) {
        return FOCUS_BY_ID[focusId];
    }

    let focusClass = document.activeElement.className;
    if (focusClass && Object.hasOwn(FOCUS_BY_CLASS, focusClass)) {
        return FOCUS_BY_CLASS[focusClass];
    }

    return TOP_FOCUS_NAME;
}

function autoFocusCommandLine() {
    return document.activeElement.id == FOCUS_ID.Terminal ||
        ((document.activeElement.id == FOCUS_ID.Empty && document.activeElement.className != FOCUS_CLASS.Editor));
}

function focusTerminalInput() {
    document.getElementById(FOCUS_ID["Terminal Input"]).focus();
}

document.addEventListener("keydown", (e) => {
    if (allowKeyboardEvents(e)) {
        logojs.method.keyboardEvent(createKeyboardMsg("down", e.key, e.code));
        e.preventDefault();
    }

    if (autoFocusCommandLine()) {
        focusTerminalInput();
    }
});

document.addEventListener("keyup", (e) => {
    if (allowKeyboardEvents(e)) {
        logojs.method.keyboardEvent(createKeyboardMsg("up", e.key, e.code));
        e.preventDefault();
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
    logojs.method.mouseEvent(createMouseMsg(e, "move"));
}

function onMouseClick(e) { // eslint-disable-line no-unused-vars
    logojs.method.mouseEvent(createMouseMsg(e, "click"));
}

function onMouseDown(e) { // eslint-disable-line no-unused-vars
    logojs.method.mouseEvent(createMouseMsg(e, "down"));
}

function onMouseUp(e) { // eslint-disable-line no-unused-vars
    logojs.method.mouseEvent(createMouseMsg(e, "up"));
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

$("#term")[0].onclick = focusTerminalInput;
