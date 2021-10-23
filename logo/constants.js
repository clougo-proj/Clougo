//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var Constants = {};

Constants.MAX_UNDO_DEPTH = 100;

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
    "OS": "os",
    "MISC": "misc"
};
Object.freeze(Constants.LOGO_LIBRARY);

Constants.LOGO_EXCEPTIONS = {
    NO_OUTPUT             : [5, "{0} didn't output to {1}"],
    NOT_ENOUGH_INPUTS     : [6, "Not enough inputs to {0}"],
    INVALID_INPUT         : [7, "{0} doesn't like {1} as input"],
    TOO_MUCH_INSIDE_PAREN : [8, "Too much inside ()'s"],
    UNACTIONABLE_DATUM    : [9, "You don't say what to do with {0}"],
    VAR_HAS_NO_VALUE      : [11, "{0} has no value"],
    UNEXPECTED_TOKEN      : [12, "Unexpected '{0}'"],
    UNKNOWN_PROC          : [13, "I don't know how to {0}"],
    NESTED_TO             : [23, "Can't use TO inside a procedure"],
    INVALID_MACRO_RETURN  : [29, "Macro {1} returned {0} instead of a list."],
    CANT_OPEN_FILE        : [40, "I can't open file {0}"],
    NOT_MACRO             : [101, "{1} is not a macro."],
    NOT_SAME_LENGTH       : [1022, "Inputs of {0} have different lengths"],
    TOO_MANY_INPUTS       : [1023, "Too many inputs to {0}"],
    LAST_ERROR_CODE       : [1024],
    NO_HELP_AVAILABLE     : [65531, "No help available on {0}."],
    CUSTOM                : [65532, "Can't find catch tag for {0}"],
    OUTPUT                : [65534, "Can only use output inside a procedure"],
    STOP                  : [65535, "Can only use stop inside a procedure"]
};
Object.freeze(Constants.LOGO_EXCEPTIONS);

const PROC_ATTRIBUTE = {
    EMPTY                   : 0,
    PRIMITIVE               : 1,
    RETURNS_IN_LAMBDA       : 1 << 1,
    STASH_LOCAL_VAR         : 1 << 2,
    MACRO                   : 1 << 3
};
Object.freeze(PROC_ATTRIBUTE);
Constants.PROC_ATTRIBUTE = PROC_ATTRIBUTE;

const PROC_PARAM = {
    UNLIMITED               : -1,
    DEFAULT_MIN             : 0,
    DEFAULT                 : 2
};
Object.freeze(PROC_PARAM);
Constants.PROC_PARAM = PROC_PARAM;

if (typeof exports != "undefined") {
    exports.Constants = Constants;
}
