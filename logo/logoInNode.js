//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's IO and system driver for Node
// Runs in Node's main thread

"use strict";

var classObj = {};
classObj.create = function logoInNode(Logo, sys) {

    const stdout = console.log; // eslint-disable-line no-console
    const stdoutn = sysstdoutn;
    const stderr = console.error; // eslint-disable-line no-console
    const stderrn = sysstderrn;

    const cmd = parseArgv(process.argv);

    const sysstdin = process.openStdin();

    Logo.io = {
        "stdout": stdout,
        "stdoutn": stdoutn,
        "stderr": stderr,
        "stderrn": stderrn,
        "cleartext": function() {}
    };

    if ("trace" in cmd.options) {
        sys.Trace.setTraceOptions(cmd.options.trace);
    }

    if ("on" in cmd.options) {
        sys.Config.setFibs(cmd.options.on, true);
    }

    if ("off" in cmd.options) {
        sys.Config.setFibs(cmd.options.off, false);
    }

    const ext = {
        "io": {
            "stdout": console.log,  // eslint-disable-line no-console
            "stdoutn": function(v) { process.stdout.write(v); },
            "stderr": console.error,  // eslint-disable-line no-console
            "stderrn": function(v) { process.stderr.write(v); },
            "cleartext": function() { process.stdout.write(sys.getCleartextChar()); },
            "onstdin": function(logoUserInputListener) {
                sysstdin.addListener("data", function(d) {
                    let ret = logoUserInputListener(d);

                    if (ret == "exit") {
                        process.exit();
                    }

                    let prompt = ret == "ready" ? "? " :
                        ret == "multiline" ? "> " : "";

                    process.stdout.write(prompt);
                });
            }
        },
        "canvas": {
            "sendCmd": function(cmd, args) {
                if (sys.isUndefined(args)) {
                    args = [];
                }

                sys.trace(cmd + " " + args.map(sys.logoFround6).join(" "), "draw");
            },
            "sendCmdAsString": function(cmd, args) {
                if (sys.isUndefined(args)) {
                    args = [];
                }

                sys.trace(cmd + " " + args.join(" "), "draw");
            }
        }
    };

    const logo = Logo.create(ext);

    const fs = require("fs");

    if (cmd.op == Logo.mode.PARSE || cmd.op == "codegen" || cmd.op == Logo.mode.RUN || cmd.op == Logo.mode.RUNL || cmd.op == Logo.mode.EXEC || cmd.op == Logo.mode.EXECJS) {
        fs.readFile(cmd.file, "utf8", thenRunLogoFile(cmd.op)); // logo source file (.lgo)
        return;
    } else if (cmd.op == "test") {
        let unittests = require(Logo.unitTestsJsSrcFile).unittests;
        Logo.testJsSrcFileHelper(unittests, "test" in cmd.options ? cmd.options.test : [], ext);
        process.exit();
    } else if (cmd.op == "console") {
        process.stdout.write("Welcome to Logo\n? ");
        logo.env.setInteractiveMode();
        return;
    } else {
        stderr(
            "Usage:\n" +
                "\tnode logo.js console                         - interactive mode\n" +
                "\tnode logo.js parse <logosrcfile>             - parse only\n" +
                "\tnode logo.js codegen <logosrcfile>           - generate JS code\n" +
                "\tnode logo.js run <logosrcfile>               - run with interpreter\n" +
                "\tnode logo.js exec <logosrcfile>              - compile to JS and execute\n" +
                "\tnode logo.js execjs <jssrcfile>              - execute precompiled JS\n" +
                "\tnode logo.js test <logo_unit_test_jsfile>    - run JavaScript unit test file\n\n" +
                "\toptions:[on,off,trace,test]\n" +
                "\ttrace:[parse,evx,codegen,lrt,time,draw]\n"
        );

        process.exit();
    }

    function sysstdoutn(v) {
        process.stdout.write(v);
    }

    function sysstderrn(v) {
        process.stdout.write(v);
    }

    function parseArgv(argv) {
        let cmd = {};

        cmd.op = argv[2];
        cmd.file = argv[3];
        cmd.options = {};

        for(let i = 4; i < argv.length; i++) {
            parseOptions(argv[i], cmd.options);
        }

        return cmd;

        function parseOptions(optionStr, optionMap) {
            let expectedOptions = {"on": 1, "off": 1, "trace": 1, "test": 1};
            let optionPair = optionStr.split(":");

            sys.assert(optionPair[0] in expectedOptions, "Unknown option " + optionPair[0]);
            sys.assert(optionPair.length == 2, "Option parse error:" + optionStr);

            optionMap[optionPair[0]] = optionPair[1].split(",");
        }
    }

    function thenRunLogoFile(runlogosrc_mode) {
        return function runlogosrc(err, logoSrc) {
            let starttime = new Date();

            if (err != null) {
                stderr(err.message); // error reading source
                return;
            }

            sys.trace(starttime.toLocaleString(), "time");

            switch (runlogosrc_mode) {
            case Logo.mode.RUN:
                logo.env.exec(logoSrc, false, 1);
                break;

            case Logo.mode.RUNL:
                logo.env.execByLine(logoSrc, false, 1);
                break;

            case Logo.mode.EXEC:
                logo.env.exec(logoSrc, true, 1);
                break;

            case Logo.mode.PARSE:
                stdout(JSON.stringify(logo.parse.parseSrc(logoSrc, 1)));
                break;

            case Logo.mode.CODEGEN:
            {
                let ir = logo.parse.parseSrc(logoSrc, 1);
                stdout(logo.codegen(ir[0], ir[1]));
                break;
            }
            case Logo.mode.EXECJS:
                logo.env.evalLogoJsTimed(logoSrc);
                break;

            default:
            }

            if (logo.env.asyncCompleted()) {
                process.exit();
            }
        };
    }
};

if (typeof exports != "undefined") {
    exports.classObj = classObj;
}
