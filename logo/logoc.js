//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo core module

import seedRandom from "./seedrandom/seedrandom.min.js";
import Sys from "./sys.js";
import TestRunner from "./testrunner.js";
import CONSTANTS from "./constants.js";
import Config from "./config.js";
import Type from "./type.js";
import Trace from "./trace.js";
import Env from "./env.js";
import Interpreter from "./interpreter.js";
import Codegen from "./codegen.js";
import Parse from "./parse.js";
import Lrt from "./lrt.js";
import Logofs from "./logofs.js";

export const Logo = {};
export const sys = Sys.create(true);

seedRandom();
sys.random = new Math.seedrandom(Math.random());
const testRunner = TestRunner.create(Logo, sys);

Logo.constants = CONSTANTS;

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

    logo.constants = CONSTANTS;
    logo.config = (config === undefined) ? Config.create(sys) : config;
    logo.type = Type.create(logo, sys);
    logo.trace = Trace.create(logo, sys);
    logo.env = Env.create(logo, sys, ext);
    logo.interpreter = Interpreter.create(logo, sys);
    logo.codegen = Codegen.create(logo, sys);
    logo.parse = Parse.create(logo, sys);
    logo.lrt = Lrt.create(logo, sys);
    logo.logofs = Logofs.create(logo, sys);

    logo.env.initLogoEnv();

    logo.mode = Logo.mode.EXEC;

    return logo;
}; // Logo.create

Logo.testRunner = testRunner;
