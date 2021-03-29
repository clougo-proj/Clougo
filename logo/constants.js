//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var Constants = {};
Constants.LOGO_EVENT = {
    "BUSY": "busy",
    "READY": "ready",
    "MULTI_LINE": "multiline",
    "CONTINUE": "continue",
    "CANVAS": "canvas",
    "OUT": "out",
    "OUTN": "outn",
    "ERR": "err",
    "ERRN": "errn",
    "EXIT": "exit",
    "CLEAR_TEXT": "cleartext",
    "EDITOR_LOAD": "editorload"
};
Object.freeze(Constants.LOGO_EVENT);

Constants.LOGO_METHOD = {
    "CONSOLE": "console",
    "EXEC": "exec",
    "RUN": "run",
    "TEST": "test",
    "CLEAR_WORKSPACE": "clearWorkspace",
    "MOUSE_EVENT": "mouseEvent"
};
Object.freeze(Constants.LOGO_METHOD);

if (typeof exports != "undefined") {
    exports.Constants = Constants;
}
