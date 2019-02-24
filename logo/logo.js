//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo top-level
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

/* global importScripts, classObj */

// detect Node by testing if variable 'process' exists - don't change it
const isNodeJsEnv = (typeof process != "undefined" && process.argv) ? true : false;
const sys = loadScript("./sys.js").create();
const Logo = {};
const testRunner = loadScript("./testrunner.js").create(Logo, sys);

Logo.create = function(ext) {

    const logo = {};

    logo.ext = ext;

    logo.asyncRetVal = undefined;

    logo.io = ext.io;

    logo.type = loadScript("./type.js").create(logo, sys);
    logo.turtle = loadScript("./turtle.js").create(logo, sys);
    logo.lrt = loadScript("./lrt.js").create(logo, sys);
    logo.interpreter = loadScript("./interpreter.js").create(logo, sys);
    logo.codegen = loadScript("./codegen.js").create(logo, sys);
    logo.parse = loadScript("./parse.js").create(logo, sys);
    logo.env = loadScript("./env.js").create(logo, sys, ext);

    logo.env.resetWorkspace();

    return logo;
}; // Logo.create

Logo.mode = {
    PARSE: "parse",
    RUN: "run",
    RUNL: "runl",
    EXEC: "exec",
    EXECJS: "execjs",
    CODEGEN: "codegen"
};

Logo.unitTestsJsSrcFile = "../unittests/unittests.js";
Logo.testJsSrcFileHelper = testRunner.testJsSrcFileHelper;

if (isNodeJsEnv) {
    loadScript("./logoInNode.js").create(Logo, sys);
} else {
    loadScript("./logoInWeb.js").create(Logo, sys);
}

function loadScript(scriptFile) {
    if (isNodeJsEnv) {
        return require(scriptFile).classObj;
    }

    importScripts(scriptFile);
    return classObj;
}