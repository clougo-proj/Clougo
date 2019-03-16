//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo top-level
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

/* global importScripts, $classObj, $jsonObj */

// detect Node by testing if variable 'process' exists - don't change it
const isNodeJsEnvFlag = (typeof process != "undefined" && process.argv) ? true : false;
const util = {
    "classFromJs": classFromJs,
    "jsonFromJs": jsonFromJs
};

const sys = classFromJs("./sys.js").create(isNodeJsEnvFlag, util);
const Logo = {};
const testRunner = classFromJs("./testrunner.js").create(Logo, sys);

Logo.create = function(ext) {

    const logo = {};

    logo.ext = ext;

    logo.asyncRetVal = undefined;

    logo.io = ext.io;
    logo.entry = ext.entry;

    logo.type = classFromJs("./type.js").create(logo, sys);
    logo.turtle = classFromJs("./turtle.js").create(logo, sys);
    logo.lrt = classFromJs("./lrt.js").create(logo, sys);
    logo.interpreter = classFromJs("./interpreter.js").create(logo, sys);
    logo.codegen = classFromJs("./codegen.js").create(logo, sys);
    logo.parse = classFromJs("./parse.js").create(logo, sys);
    logo.env = classFromJs("./env.js").create(logo, sys, ext);

    logo.env.initLogoEnv();

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

Logo.testJsSrcFileHelper = testRunner.testJsSrcFileHelper;

if (isNodeJsEnvFlag) {
    classFromJs("./logoInNode.js").create(Logo, sys);
} else {
    classFromJs("./logoInWeb.js").create(Logo, sys);
}

function classFromJs(scriptFile) {
    if (isNodeJsEnvFlag) {
        return require(scriptFile).$classObj;
    }

    importScripts(scriptFile);
    return $classObj;
}

function jsonFromJs(scriptFile) {
    if (isNodeJsEnvFlag) {
        return require(scriptFile).$jsonObj;
    }

    importScripts(scriptFile);
    return $jsonObj;
}
