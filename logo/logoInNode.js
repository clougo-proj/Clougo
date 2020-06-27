//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's IO and system driver for Node
// Runs in Node's main thread

"use strict";

var $classObj = {};
$classObj.create = function logoInNode(Logo, sys) {

    const stdout = console.log; // eslint-disable-line no-console
    const stdoutn = function(v) { process.stdout.write(v); };
    const stderr = console.error; // eslint-disable-line no-console
    const stderrn = function(v) { process.stderr.write(v); };

    Logo.io = {
        "stdout": stdout,
        "stdoutn": stdoutn,
        "stderr": stderr,
        "stderrn": stderrn
    };

    const ext = makeLogoDependencies();
    const logo = Logo.create(ext);

    const srcRunner = makeSrcRunner();
    const fs = require("fs");
    const cmd = parseArgv(process.argv);

    setCmdLineConfigs(cmd.options);

    if (cmd.op in srcRunner) {
        const logoSrc = fs.readFileSync(cmd.file, "utf8"); // logo source file (.lgo)

        srcRunner[cmd.op](logoSrc)
            .then(() => process.exit())
            .catch(e => {
                stderr(e);
                process.exit(-1);
            });

        return;
    }

    if (cmd.op == "test") {
        Logo.testRunner.runTests(Logo.getUnitTests(), "test" in cmd.options ? cmd.options.test : [], ext)
            .then(failCount => process.exit(failCount !== 0))
            .catch(e => {
                stderr(e);
                process.exit(-1);
            });

        return;
    }

    if (cmd.op == "console") {
        process.stdout.write("Welcome to Logo\n? ");
        logo.env.setInteractiveMode();
        return;
    }

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

    function setCmdLineConfigs(options) {
        if ("trace" in options) {
            sys.Trace.setTraceOptions(options.trace);
        }

        if ("on" in options) {
            sys.Config.setConfigs(options.on, true);
        }

        if ("off" in options) {
            sys.Config.setConfigs(options.off, false);
        }
    }

    function makeSrcRunner() {
        const srcRunner = {};

        srcRunner[Logo.mode.RUN] = async function(src) { await logo.env.exec(src, false, 1); };
        srcRunner[Logo.mode.RUNL] = async function(src) { await logo.env.execByLine(src, false, 1); };
        srcRunner[Logo.mode.EXEC] = async function(src) { await logo.env.exec(src, true, 1); };
        srcRunner[Logo.mode.EXECL] = async function(src) { await logo.env.execByLine(src, true, 1); };
        srcRunner[Logo.mode.EXECJS] = async function(src) { await logo.env.evalLogoJsTimed(src); };
        srcRunner[Logo.mode.PARSE] = async function(src) {
            stdout(JSON.stringify(logo.parse.parseSrc(src, 1)));
        };

        srcRunner[Logo.mode.CODEGEN] = async function(src) {
            stdout(await logo.env.codegenOnly(src));
        };

        return srcRunner;
    }

    function makeLogoDependencies() {
        return  {
            "entry": {
                "exec": async function(logoSrc) { await logo.env.exec(logoSrc, true, 1); },
                "runSingleTest": async function(testName, testMethod) {
                    await Logo.testRunner.runSingleTest(Logo.getUnitTests(), testName, testMethod, ext);
                }
            },
            "io": {
                "stdout": console.log,  // eslint-disable-line no-console
                "stdoutn": function(v) { process.stdout.write(v); },
                "stderr": console.error,  // eslint-disable-line no-console
                "stderrn": function(v) { process.stderr.write(v); },
                "drawflush": function() {},
                "editorload": function() {},
                "cleartext": function() { process.stdout.write(sys.getCleartextChar()); },
                "envstate": function() {},
                "exit": function(batchMode) {
                    if (!batchMode) {
                        stdout("Thank you for using Logo. Bye!");
                    }

                    process.exit();
                },
                "onstdin": function(logoUserInputListener, getEnvState) {
                    const sysstdin = process.openStdin();
                    sysstdin.addListener("data", function(d) {
                        logoUserInputListener(d).then(() => {

                            let envState = getEnvState();

                            if (envState == "exit") {
                                process.exit();
                            }

                            let prompt = envState == "ready" ? "? " :
                                envState == "multiline" ? "> " : "";

                            process.stdout.write(prompt);
                        });
                    });
                }
            },
            "canvas": {
                "sendCmd": function(cmd, args = []) {
                    sys.trace(cmd + " " + args.map(sys.logoFround6).join(" "), "draw");
                },
                "sendCmdAsString": function(cmd, args = []) {
                    sys.trace(cmd + " " + args.join(" "), "draw");
                }
            }
        };
    }
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
