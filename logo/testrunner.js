//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var $classObj = {};
$classObj.create = function(Logo, sys) {
    const testRunner = {};

    let extForTest, logo;
    let count, failCount;
    let reFilter;
    let singleTestMode = false;

    function runTests(unitTests, options, ext) {
        singleTestMode = false;
        initializeTestEnv(ext);

        // make regex for filtering unit tests by their full names
        reFilter = sys.isUndefined(options) ? undefined : sys.makeMatchListRegexp(options);
        count = 0;
        failCount = 0;

        runUnitTestDir(unitTests);
        Logo.io.stdout("Total:" + count + "\tFailed:" + failCount);
        return;
    }
    testRunner.runTests = runTests;

    function runSingleTest(unitTests, testName, testMethod, ext) {
        singleTestMode = true;
        initializeTestEnv(ext);

        let testDir = getTestDir(unitTests, testName);
        if (testDir === undefined) {
            Logo.io.stderr("Test not found: " + testName);
            return;
        }

        runTestHelper(testDir, testName, testMethod);
    }
    testRunner.runSingleTest = runSingleTest;

    function initializeTestEnv(ext) {
        extForTest = makeLogoDependenciesForTest(ext);
        logo = Logo.create(extForTest);
    }

    function getTestDir(unitTests, testName) {
        let testPath = testName.split(".");
        let testDir = unitTests;
        while(testPath.length > 0) {
            let dirName = testPath.shift();
            if (!(dirName in testDir)) {
                return undefined;
            }

            testDir = testDir[dirName];
        }

        return testDir;
    }

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

    function makeLogoDependenciesForTest(ext) {

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
    }

    function runTest(test, testName) {
        let testCmd = test.__tag__;
        if (!hasTestSrc(test)) {
            Logo.io.stderr("ERROR: Missing lgo file for test " + testName);
            return;
        }

        testCmd.forEach(function(testMethod) { runTestHelper(test, testName, testMethod); });
    }

    function hasTestSrc(test) {
        return "__lgo__" in test && typeof test.__lgo__ === "string";
    }

    function getTestSrc(test) {
        return test.__lgo__;
    }

    function getTestInBase(test) {
        return sys.emptyStringIfUndefined(test.__in__);
    }

    function getTestOutBase(test) {
        return sys.emptyStringIfUndefined(test.__out__);
    }

    function getTestErrBase(test) {
        return sys.emptyStringIfUndefined(test.__err__);
    }

    function getTestDrawBase(test) {
        return sys.emptyStringIfUndefined(test.__draw__);
    }

    function getTestParseBase(test) {
        return sys.emptyStringIfUndefined(test.__parse__);
    }

    function testParse(test) {
        let testSrc = getTestSrc(test);
        let testParseBase = getTestParseBase(test);
        let parseResult = JSON.stringify(logo.parse.parseSrc(testSrc, 1)) + "\n";
        if (parseResult == testParseBase) {
            Logo.io.stdout("\t\tpassed ");
            return;
        }

        Logo.io.stdout("\t\tfailed");
        if (singleTestMode) {
            outputIfDifferent("parsed", testParseBase, parseResult);
        }

        failCount++;
    }

    function testGenericRun(test, runTestMethod) {
        let testSrc = getTestSrc(test);
        extForTest.io.clearBuffers();
        extForTest.canvas.clearBuffer();

        runTestMethod(testSrc);

        const outActual = extForTest.io.getStdoutBuffer();
        const errActual = extForTest.io.getStderrBuffer();
        const drawActual = extForTest.canvas.getBuffer();

        if (outActual == getTestOutBase(test) && errActual == getTestErrBase(test) && drawActual == getTestDrawBase(test)) {
            Logo.io.stdout("\t\tpassed\trun time: "+logo.env.getRunTime()+"ms");
            return;
        }

        Logo.io.stdout("\t\tfailed");
        if (singleTestMode) {
            outputIfDifferent("out", outActual, getTestOutBase(test));
            outputIfDifferent("out", errActual, getTestErrBase(test));
            outputIfDifferent("out", drawActual, getTestDrawBase(test));
        }

        failCount++;
    }

    function outputIfDifferent(type, actual, expected) {
        if (expected !== actual) {
            Logo.io.stdout("Expected " + type + ":\n<" + expected + ">\n\tActual " + type + ":\n<" + actual + ">");
        }
    }

    function runTestHelper(test, testName, testMethod) {
        extForTest.io.mockStdin(getTestInBase(test));
        logo.env.initLogoEnv();
        count++;

        Logo.io.stdoutn(testName + "(" + testMethod + "):");
        switch(testMethod) {
        case Logo.mode.PARSE:
            testParse(test);
            break;
        case Logo.mode.RUNL:
            testGenericRun(test, function(testSrc) { logo.env.execByLine(testSrc, false, 1); });
            break;
        case Logo.mode.EXECL:
            testGenericRun(test, function(testSrc) { logo.env.execByLine(testSrc, true, 1); });
            break;
        case Logo.mode.EXECJS:
            testGenericRun(test, function() { logo.env.evalLogoJsTimed(test.__ljs__); });
            break;
        case Logo.mode.RUN:
            testGenericRun(test, function(testSrc) { logo.env.exec(testSrc, false, 1); });
            break;
        case Logo.mode.EXEC:
            testGenericRun(test, function(testSrc) { logo.env.exec(testSrc, true, 1); });
            break;
        default:
        }
    }

    return testRunner;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
