//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var $classObj = {};
$classObj.create = function(Logo, sys) {
    const testRunner = {};

    function testJsSrcFileHelper (unittests, options, ext) {

        const extForTest = (function() {

            let stdoutBuffer = "";
            let stderrBuffer = "";
            let turtleBuffer = "";

            const extForTest = {
                "io": {
                    "clearBuffers": function() {
                        stdoutBuffer = "";
                        stderrBuffer = "";
                    },
                    "getStdoutBuffer": function() { return stdoutBuffer; },
                    "getStderrBuffer": function() { return stderrBuffer; },
                    "stdout": function(text) {
                        stdoutBuffer += text + "\n";
                    },
                    "stdoutn": function(text) {
                        stdoutBuffer += text;
                    },
                    "stderr": function(text) {
                        stderrBuffer += text + "\n";
                    },
                    "stderrn": function(text) {
                        stderrBuffer += text;
                    },
                    "cleartext": function() {
                        stdoutBuffer += sys.getCleartextChar();
                    },
                    "mockStdin": function(text) {
                        extForTest.io.onstdin = function(logoUserInputListener) {
                            logoUserInputListener(text);
                        };
                    }
                },
                "canvas": {
                    "clearBuffer": function() {
                        turtleBuffer = "";
                    },
                    "getBuffer": function() { return turtleBuffer; },
                    "sendCmd": function(cmd, args) {
                        if (sys.isUndefined(args)) {
                            args = [];
                        }

                        ext.canvas.sendCmd(cmd, args);
                        turtleBuffer += cmd + " " + args.map(sys.logoFround6).join(" ") + "\n";
                    },
                    "sendCmdAsString": function(cmd, args) {
                        if (sys.isUndefined(args)) {
                            args = [];
                        }

                        ext.canvas.sendCmdAsString(cmd, args);
                        turtleBuffer += cmd + " " + args.join(" ") + "\n";
                    }
                }
            };

            return extForTest;
        })();

        const logo = Logo.create(extForTest);

        // make regex for filtering unit tests by their full names
        const reFilter = sys.isUndefined(options) ? undefined : sys.makeMatchListRegexp(options);

        let count = 0, failCount = 0;

        const runTest = function(test, testName) {
            const testCmd = test.__tag__;
            const testSrc = test.__lgo__;
            if (sys.isUndefined(testSrc)) {
                Logo.io.stderr("ERROR: Missing lgo file for test " + testName);
                return;
            }

            const testInBase = sys.emptyStringIfUndefined(test.__in__);
            const testOutBase = sys.emptyStringIfUndefined(test.__out__);
            const testErrBase = sys.emptyStringIfUndefined(test.__err__);
            const testDrawBase = sys.emptyStringIfUndefined(test.__draw__);
            const testParseBase = sys.emptyStringIfUndefined(test.__parse__);

            testCmd.forEach(function(testMethod) {
                extForTest.io.mockStdin(testInBase);
                logo.env.initLogoEnv();
                count++;

                Logo.io.stdoutn(testName + "(" + testMethod + "):");

                if (testMethod == Logo.mode.PARSE) {
                    const parseResult = JSON.stringify(logo.parse.parseSrc(testSrc, 1)) + "\n";
                    if (!sys.isUndefined(testParseBase)) {
                        if (parseResult == testParseBase) {
                            Logo.io.stdout("\t\tpassed ");
                        } else {
                            Logo.io.stdout("\t\tfailed " + "\n\tsource:"+testSrc+"\n\texpect:<"+testParseBase+">\n\tparse :<"+parseResult+">");
                            failCount++;
                        }
                    }
                } else if (testMethod == Logo.mode.EXEC || testMethod == Logo.mode.RUN || testMethod == Logo.mode.RUNL || testMethod == Logo.mode.EXECJS) {
                    extForTest.io.clearBuffers();
                    extForTest.canvas.clearBuffer();

                    if (testMethod == Logo.mode.RUNL) {
                        logo.env.execByLine(testSrc, testMethod == Logo.mode.EXEC, 1);
                    } else if (testMethod == Logo.mode.EXECJS) {
                        logo.env.evalLogoJsTimed(test.__ljs__);
                    } else {
                        logo.env.exec(testSrc, testMethod == Logo.mode.EXEC, 1);
                    }

                    const outActual = extForTest.io.getStdoutBuffer();
                    const errActual = extForTest.io.getStderrBuffer();
                    const drawActual = extForTest.canvas.getBuffer();

                    if (outActual == testOutBase && errActual == testErrBase && drawActual == testDrawBase) {
                        Logo.io.stdout("\t\tpassed\trun time: "+logo.env.getRunTime()+"ms");
                    } else {
                        Logo.io.stdout("\t\tfailed ");
                        failCount++;
                    }
                }
            });

        };

        function runUnitTestDir(curDir, curName) {
            if ("__tag__" in curDir) {
                if (sys.isUndefined(reFilter) || curName.match(reFilter)) {
                    runTest(curDir, curName);
                }

                return ;
            }

            for(let subKey in curDir) {
                let subDir = curDir[subKey];
                if (typeof subDir == "object") {
                    runUnitTestDir(subDir, sys.isUndefined(curName) ? subKey : curName + "." + subKey);
                }
            }
        }

        runUnitTestDir(unittests);
        Logo.io.stdout("Total:" + count + "\tFailed:" + failCount);
    }

    testRunner.testJsSrcFileHelper = testJsSrcFileHelper;

    return testRunner;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
