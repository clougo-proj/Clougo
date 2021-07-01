//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var Constants = {};
Constants.LOGO_EVENT = {
    "BUSY": "busy",
    "READY": "ready",
    "MULTILINE": "multiline",
    "VERTICAL_BAR" : "vbar",
    "CONTINUE": "continue",
    "CANVAS": "canvas",
    "CANVAS_SNAPSHOT": "canvasSnapshot",
    "OUT": "out",
    "OUTN": "outn",
    "ERR": "err",
    "ERRN": "errn",
    "EXIT": "exit",
    "CONFIG": "config",
    "CLEAR_TEXT": "cleartext",
    "EDITOR_LOAD": "editorLoad"
};
Object.freeze(Constants.LOGO_EVENT);

Constants.LOGO_METHOD = {
    "CONSOLE": "console",
    "EXEC": "exec",
    "RUN": "run",
    "TEST": "test",
    "CLEAR_WORKSPACE": "clearWorkspace",
    "TURTLE_UNDO": "turtleUndo",
    "MOUSE_EVENT": "mouseEvent"
};
Object.freeze(Constants.LOGO_METHOD);

Constants.LOGO_LIBRARY = {
    "DATA_STRUCT": "ds",
    "COMMM": "comm",
    "ARITHMETIC_LOGIC": "al",
    "GRAPHICS": "graphics",
    "WORKSPACE_MGMT": "ws",
    "CTRL_STRUCT": "ctrl",
    "OS": "os"
};
Object.freeze(Constants.LOGO_LIBRARY);

Constants.MAX_UNDO_DEPTH = 100;

if (typeof exports != "undefined") {
    exports.Constants = Constants;
}
