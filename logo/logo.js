//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo top-level
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

/* global importScripts */

// detect Node by testing if variable 'process' exists - don't change it
const isNodeJsEnvFlag = (typeof process != "undefined" && process.argv) ? true : false;
const util = {
    "fromJs": fromJs
};

const sys = fromJs("./sys.js").create(isNodeJsEnvFlag, util);
const Logo = {};
const testRunner = fromJs("./testrunner.js").create(Logo, sys);
const constants = fromJs("./constants.js", "Constants");

loadJs("./seedrandom/seedrandom.min.js");

Logo.constants = constants;

Logo.mode = {
    CODEGEN: "codegen",
    CONSOLE: "console",
    EXEC: "exec",
    EXECJS: "execjs",
    EXECL: "execl",
    HELP: "help",
    PARSE: "parse",
    RUN: "run",
    RUNL: "runl",
    TEST: "test"
};

Logo.modeName = ((mode) => {
    const modeName = {};
    Object.keys(mode).forEach(key => {
        modeName[mode[key]] = key;
    });
    return modeName;
})(Logo.mode);

Logo.create = function(ext, config=undefined) {

    const logo = {};

    logo.ext = ext;

    logo.asyncRetVal = undefined;

    logo.io = ext.io;
    logo.entry = ext.entry;

    logo.constants = constants;
    logo.config = (config === undefined) ? fromJs("./config.js").create(sys) : config;
    logo.type = fromJs("./type.js").create(logo, sys);
    logo.trace = fromJs("./trace.js").create(logo, sys);
    logo.env = fromJs("./env.js").create(logo, sys, ext);
    logo.interpreter = fromJs("./interpreter.js").create(logo, sys);
    logo.codegen = fromJs("./codegen.js").create(logo, sys);
    logo.parse = fromJs("./parse.js").create(logo, sys);
    logo.lrt = fromJs("./lrt.js").create(logo, sys);
    logo.logofs = fromJs("./logofs.js").create(logo, sys);

    logo.env.initLogoEnv();

    logo.mode = Logo.mode.EXEC;

    return logo;
}; // Logo.create

Logo.testRunner = testRunner;

if (isNodeJsEnvFlag) {
    fromJs("./logoInNode.js").create(Logo, sys);
} else {
    fromJs("./logoInWeb.js").create(Logo, sys);
}

function fromJs(scriptFile, name = "$obj") {
    if (isNodeJsEnvFlag) {
        return require(scriptFile)[name];
    }

    importScripts(scriptFile);
    return self[name];
}

function loadJs(scriptFile) {
    if (isNodeJsEnvFlag) {
        require(scriptFile);
        return;
    }

    importScripts(scriptFile);
}
