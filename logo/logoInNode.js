//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo's IO and system driver for Node
// Runs in Node's main thread

"use strict";

var $obj = {};
$obj.create = function logoInNode(Logo, sys) {

    const LOGO_EVENT = Logo.constants.LOGO_EVENT;

    const fs = require("fs");

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
    const cmd = parseArgv(process.argv);

    logo.env.loadDefaultLogoModules()
        .then(postCreation);

    function postCreation() {
        const srcRunner = makeSrcRunner();

        let cwd = process.cwd();

        cwd.replace(/\\/, "/");

        if (!("file" in cmd) && cmd.op === Logo.mode.EXEC) {
            cmd.op = Logo.mode.CONSOLE;
        }

        if (cmd.op in srcRunner) {
            logo.env.getGlobalScope().argv = logo.type.makeLogoList(cmd.argv);

            const logoSrc = fs.readFileSync(cwd + "/" + cmd.file, "utf8"); // logo source file (.lgo)

            srcRunner[cmd.op](logoSrc, cmd.file)
                .then(() => process.exit())
                .catch(e => {
                    stderr(e);
                    process.exit(-1);
                });

            return;
        }

        if (cmd.op === Logo.mode.TEST) {
            Logo.testRunner.runTests("file" in cmd ? [cmd.file] : [], logo)
                .then(failCount => process.exit(failCount !== 0))
                .catch(e => {
                    stderr(e);
                    process.exit(-1);
                });

            return;
        }

        if (cmd.op === Logo.mode.CONSOLE) {
            process.stdout.write("Welcome to Logo\n? ");
            logo.env.setInteractiveMode();
            return;
        }

        stderr(
            "Usage:\n" +
                "\tnode logo                            - interactive mode\n" +
                "\tnode logo <LGO file>                 - compile to JS and execute\n" +
                "\tnode logo --parse <LGO file>         - parse only\n" +
                "\tnode logo --codegen <LGO file>       - generate JS code\n" +
                "\tnode logo --run <LGO file>           - run with interpreter\n" +
                "\tnode logo --exec <LGO file>          - compile to JS and execute\n" +
                "\tnode logo --execjs <JS file>         - execute precompiled JS\n" +
                "\tnode logo --test [<test name>]       - run JavaScript unit test file\n\n" +
                "\toptions:[--on,--off,--trace]\n" +
                "\ttrace:[parse,evx,codegen,lrt,time,draw]\n"
        );

        process.exit();
    }

    function parseArgv(argv) {
        let cmd = {};

        cmd.op = Logo.mode.EXEC;
        cmd.argv = [];

        for(let i = 2; i < argv.length; i++) {
            if (!("file" in cmd)) {
                if (argv[i].match(/^--/)) {
                    parseOption(argv[i].substring(2));
                    continue;
                }

                cmd.file = argv[i];
            } else {
                cmd.argv.push(argv[i]);
            }
        }

        return cmd;

        function parseOption(optionStr) {
            let expectedOptions = {
                "on": (key) => logo.config.set(key, true),
                "off": (key) => logo.config.set(key, false),
                "trace": logo.trace.enableTrace
            };

            let optionPair = optionStr.split(":");

            if (optionPair.length == 2) {
                sys.assert(optionPair[0] in expectedOptions, "Unknown option " + optionPair[0]);

                optionPair[1].split(",").map(expectedOptions[optionPair[0]]);
                return;
            }

            sys.assert(optionPair.length == 1, "Option parse error:" + optionStr);
            sys.assert(optionPair[0] in Logo.modeName, "Unknown option " + optionPair[0]);

            cmd.op = optionPair[0];
        }
    }

    function makeSrcRunner() {
        const srcRunner = {};

        srcRunner[Logo.mode.RUN] = async function(src, srcPath) { await logo.env.exec(src, false, srcPath); };
        srcRunner[Logo.mode.RUNL] = async function(src, srcPath) { await logo.env.execByLine(src, false, srcPath); };
        srcRunner[Logo.mode.EXEC] = async function(src, srcPath) { await logo.env.exec(src, true, srcPath); };
        srcRunner[Logo.mode.EXECL] = async function(src, srcPath) { await logo.env.execByLine(src, true, srcPath); };
        srcRunner[Logo.mode.EXECJS] = async function(src) { await logo.env.evalLogoJsTimed(src); };
        srcRunner[Logo.mode.PARSE] = async function(src) {
            stdout(JSON.stringify(logo.parse.parseBlock(logo.parse.parseSrc(src, 1))));
        };

        srcRunner[Logo.mode.CODEGEN] = async function(src) {
            stdout(await logo.env.codegenOnly(src));
        };

        return srcRunner;
    }

    function makeLogoDependencies() {
        return  {
            "entry": {
                "exec": async function(logoSrc, srcPath) { await logo.env.exec(logoSrc, true, srcPath); },
                "runSingleTest": async function(testName, testMethod) {
                    await Logo.testRunner.runSingleTest(testName, testMethod, logo);
                }
            },
            "io": {
                "stdout": console.log,  // eslint-disable-line no-console
                "stdoutn": function(v) { process.stdout.write(v); },
                "stderr": console.error,  // eslint-disable-line no-console
                "stderrn": function(v) { process.stderr.write(v); },
                "readfile": fileName => fs.readFileSync(fileName, "utf8"),
                "drawflush": function() {},
                "editorLoad": function() {},
                "canvasSnapshot": function() {},
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

                            if (envState == LOGO_EVENT.EXIT) {
                                process.exit();
                            }

                            let prompt = envState == LOGO_EVENT.READY ? "? " :
                                envState == LOGO_EVENT.MULTILINE ? "> " :
                                    envState == LOGO_EVENT.VERTICAL_BAR ? "| " : "";

                            process.stdout.write(prompt);
                        });
                    });
                }
            },
            "canvas": {
                "sendCmd": function(cmd, args = []) {
                    logo.trace.info(cmd + " " + args.map(sys.logoFround6).join(" "), "draw");
                },
                "sendCmdAsString": function(cmd, args = []) {
                    logo.trace.info(cmd + " " + args.join(" "), "draw");
                }
            }
        };
    }
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
