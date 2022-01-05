//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var $obj = {};
$obj.create = function(Logo, sys) {
    const testRunner = {};

    let extForTest, logoForUnitTests;
    let count, failCount;
    let reFilter;
    let singleTestMode = false;

    async function runTests(unitTests, testNamePatterns, logo) {
        initializeTestEnv(logo);
        singleTestMode = logoForUnitTests.config.get("verbose");

        // make regex for filtering unit tests by their full names
        reFilter = sys.isUndefined(testNamePatterns) ? undefined : sys.makeMatchListRegexp(testNamePatterns);
        count = 0;
        failCount = 0;

        await runUnitTestDir(unitTests);
        Logo.io.stdout("Total:" + count + "\tFailed:" + failCount);
        return failCount;
    }
    testRunner.runTests = runTests;

    async function runSingleTest(unitTests, fullTestName, testMethod, logo) {
        initializeTestEnv(logo);
        singleTestMode = true;

        let testInfo = getTestInfo(unitTests, fullTestName);
        let prefix = testInfo[0];
        let testName = testInfo[1];
        let testDir = testInfo[2];
        if (testDir === undefined) {
            Logo.io.stderr("Test not found: " + fullTestName);
            return;
        }

        await runTestHelper(testDir, prefix, testName, testMethod);
    }
    testRunner.runSingleTest = runSingleTest;

    function initializeTestEnv(logo) {
        extForTest = makeLogoDependenciesForTest(logo.ext);
        logoForUnitTests = Logo.create(extForTest, logo.config);
    }

    function getTestInfo(unitTests, fullTestName) {
        let testPath = fullTestName.split(".");
        let testDir = unitTests;
        let prefix = testPath.slice(0, -1).join(".");
        let testName =  testPath[testPath.length - 1];
        while(testPath.length > 1) {
            let prefix = testPath.shift();
            if (!(prefix in testDir)) {
                return undefined;
            }

            testDir = testDir[prefix];
        }

        return [prefix, testName, testDir];
    }

    function listToTests(list) {
        let cases = list.split(/\r?\n/);

        if (cases.length === 0) {
            return [];
        }

        let match = cases[0].match(/^\s*configOverride:\s*(?<configOverride>\S+)/);

        let configOverride = "";
        if (match) {
            configOverride = match.groups.configOverride;
            cases.shift();
        }

        return cases.map(line => line.replace(/#.*$/, ""))
            .filter(line => !line.match(/^\s*$/))
            .map(line => line.split(/\s+/))
            .map(line => [line[0], line.slice(1).map(mode => mode + configOverride)]);
    }

    async function runUnitTestDir(curDir, prefix) {
        if ("list.txt" in curDir) {
            let tests = listToTests(curDir["list.txt"]);
            for (let test of tests) {
                let testName = prefix + "." + test[0];
                if (sys.isUndefined(reFilter) || testName.match(reFilter)) {
                    await runTest(curDir, prefix, test);
                }
            }
        }

        for(let subKey in curDir) {
            let subDir = curDir[subKey];
            if (typeof subDir == "object") {
                await runUnitTestDir(subDir, sys.isUndefined(prefix) ? subKey : prefix + "." + subKey);
            }
        }
    }

    function makeLogoDependenciesForTest(ext) {

        let stdoutBuffer = "";
        let stderrBuffer = "";
        let turtleBuffer = "";

        const extForTest = {
            "entry": {
                "exec": async function(logoSrc) { await logoForUnitTests.env.exec(logoSrc, true, 1); },
                "runSingleTest": async function(testName, testMethod) {
                    await runSingleTest(Logo.getUnitTests(), testName, testMethod, ext);
                }
            },
            "io": {
                "clearBuffers": function() {
                    stdoutBuffer = "";
                    stderrBuffer = "";
                },
                "getStdoutBuffer": function() { return stdoutBuffer; },
                "getStderrBuffer": function() { return stderrBuffer; },
                "stdout": function(text) {
                    stdoutBuffer += text + logoForUnitTests.type.NEWLINE;
                },
                "stdoutn": function(text) {
                    stdoutBuffer += text;
                },
                "stderr": function(text) {
                    stderrBuffer += text + logoForUnitTests.type.NEWLINE;
                },
                "stderrn": function(text) {
                    stderrBuffer += text;
                },
                "drawflush": function() {},
                "cleartext": function() {
                    stdoutBuffer += sys.getCleartextChar();
                },
                "canvasSnapshot": function() {},
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
                "sendCmd": function(cmd, args = []) {
                    ext.canvas.sendCmd(cmd, args);
                    turtleBuffer += cmd + " " + args.map(sys.logoFround6).join(" ") + logoForUnitTests.type.NEWLINE;
                },
                "sendCmdAsString": function(cmd, args = []) {
                    ext.canvas.sendCmdAsString(cmd, args);
                    turtleBuffer += cmd + " " + args.join(" ") + logoForUnitTests.type.NEWLINE;
                }
            }
        };

        return extForTest;
    }

    async function runTest(curDir, prefix, test) {
        let testName = test[0];
        let testCmd = test[1];
        if (!hasTestSrc(curDir, testName)) {
            Logo.io.stderr("ERROR: Missing lgo file for test " + testName);
            return;
        }

        for (let i = 0; i < testCmd.length; i++) {
            await runTestHelper(curDir, prefix, testName, testCmd[i]);
        }
    }

    function hasTestSrc(curDir, testName) {
        return (testName + ".lgo") in curDir;
    }

    function getTestSrc(curDir, testName) {
        return curDir[testName + ".lgo"];
    }

    function getTestInBase(curDir, testName) {
        return sys.emptyStringIfUndefined(curDir[testName + ".in"]);
    }

    function getTestOutBase(curDir, testName) {
        return expandBuiltInMacros(sys.emptyStringIfUndefined(curDir[testName + ".out"]));
    }

    function getTestErrBase(curDir, testName) {
        return expandBuiltInMacros(sys.emptyStringIfUndefined(curDir[testName + ".err"]));
    }

    function getTestDrawBase(curDir, testName) {
        return sys.emptyStringIfUndefined(curDir[testName + ".draw"]);
    }

    function getTestParseBase(curDir, testName) {
        return sys.emptyStringIfUndefined(curDir[testName + ".parse"]);
    }

    function testParse(curDir, testName) {
        let testSrc = getTestSrc(curDir, testName);
        let testParseBase = getTestParseBase(curDir, testName);
        let parseResult = JSON.stringify(logoForUnitTests.parse.parseBlock(logoForUnitTests.parse.parseSrc(testSrc, 1))) + logoForUnitTests.type.NEWLINE;
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

    async function tryRunTestMethod(testSrc, runTestMethod) {
        try {
            await runTestMethod(testSrc);
            return true;
        } catch (e) {
            Logo.io.stdout("\t\tfailed");
            if (singleTestMode) {
                Logo.io.stdout(e.stack);
            }

            return false;
        }
    }

    async function testGenericRun(curDir, testName, runTestMethod) {
        let testSrc = getTestSrc(curDir, testName);
        extForTest.io.clearBuffers();
        extForTest.canvas.clearBuffer();

        if (!await tryRunTestMethod(testSrc, runTestMethod)) {
            failCount++;
            return;
        }

        const outExpected = getTestOutBase(curDir, testName);
        const errExpected = getTestErrBase(curDir, testName);
        const drawExpected = getTestDrawBase(curDir, testName);

        const outActual = extForTest.io.getStdoutBuffer();
        const errActual = extForTest.io.getStderrBuffer();
        const drawActual = extForTest.canvas.getBuffer();

        if (outActual == outExpected && errActual == errExpected && drawActual == drawExpected) {
            Logo.io.stdout("\t\tpassed\trun time: "+logoForUnitTests.env.getRunTime()+"ms");
            return;
        }

        Logo.io.stdout("\t\tfailed");
        if (singleTestMode) {
            outputIfDifferent("out", outActual, outExpected);
            outputIfDifferent("err", errActual, errExpected);
            outputIfDifferent("draw", drawActual, drawExpected);
        }

        failCount++;
    }

    function outputIfDifferent(type, actual, expected) {
        if (expected !== actual) {
            Logo.io.stdout("Expected " + type + ":\n<" + expected + ">\n\tActual " + type + ":\n<" + actual + ">");
        }
    }

    function padStart(str, num, pad) {
        return (pad.repeat(num) + str).slice(-num);
    }

    function expandBuiltInMacros(str) {
        let reDateTimeFormat = /\$dateTimeFormat\("(?<date>.*?)"\)/;
        let found = str.match(reDateTimeFormat);

        if (!found) {
            return str;
        }

        return str.replace(reDateTimeFormat, formatDateTime(found.groups.date));
    }

    function formatDateTime(dtFormat)  {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let dateTime = new Date();
        return dtFormat.replace(/<EEE>/, days[dateTime.getDay()])
            .replace(/<MMM>/, months[dateTime.getMonth()])
            .replace(/<M>/, dateTime.getMonth() + 1)
            .replace(/<dd>/, padStart(dateTime.getDate(), 2, "0"))
            .replace(/<HH>/, padStart(dateTime.getHours(), 2, "0"))
            .replace(/<mm>/, padStart(dateTime.getMinutes(), 2, "0"))
            .replace(/<ss>/, padStart(dateTime.getSeconds(), 2, "0"))
            .replace(/<yyyy>/, dateTime.getFullYear());
    }

    function parseConfigs(tokens, sign) {
        return tokens.filter(token => token.charAt(0) === sign)
            .map(token => token.substring(1));
    }

    function toConfigOverride(onConfigKeys, offConfigKeys) {
        if (onConfigKeys.length === 0 && offConfigKeys.length === 0) {
            return undefined;
        }

        let configOverride = {};
        onConfigKeys.forEach(key => { configOverride[key] = true; });
        offConfigKeys.forEach(key => { configOverride[key] = false; });
        return configOverride;
    }

    function toTestSettings(testMethod) {
        let tokens = testMethod.split(/,/);
        let mode = tokens.shift();
        let configOverride = toConfigOverride(parseConfigs(tokens, "+"), parseConfigs(tokens, "-"));
        return (configOverride === undefined) ? { "mode": mode } :
            { "mode": mode, "configOverride": configOverride };
    }

    function overrideLogoConfig(logo, testSettings) {
        if (!("configOverride" in testSettings)) {
            return logo.config;
        }

        let backupConfig = logo.config;
        logo.config = backupConfig.clone().override(testSettings.configOverride);
        return backupConfig;
    }

    function restoreLogoConfig(logo, config) {
        logo.config = config;
    }

    async function runTestHelper(curDir, prefix, testName, testMethod) {
        extForTest.io.mockStdin(getTestInBase(curDir, testName));
        logoForUnitTests.env.initLogoEnv();
        count++;

        Logo.io.stdoutn(prefix + "." + testName + "(" + testMethod + "):");
        let testSettings = toTestSettings(testMethod);
        let backupConfig = overrideLogoConfig(logoForUnitTests, testSettings);
        await logoForUnitTests.env.loadDefaultLogoModules();

        switch(testSettings.mode) {
        case Logo.mode.PARSE:
            testParse(curDir, testName);
            break;
        case Logo.mode.RUNL:
            await testGenericRun(curDir, testName, async function(testSrc) { await logoForUnitTests.env.execByLine(testSrc, false, 1); });
            break;
        case Logo.mode.EXECL:
            await testGenericRun(curDir, testName, async function(testSrc) { await logoForUnitTests.env.execByLine(testSrc, true, 1); });
            break;
        case Logo.mode.RUN:
            await testGenericRun(curDir, testName, async function(testSrc) { await logoForUnitTests.env.exec(testSrc, false, 1); });
            break;
        case Logo.mode.EXEC:
            await testGenericRun(curDir, testName, async function(testSrc) { await logoForUnitTests.env.exec(testSrc, true, 1); });
            break;
        default:
            Logo.io.stdout("\t\t" + testSettings.mode + " not found");
            failCount++;
        }

        restoreLogoConfig(logoForUnitTests, backupConfig);
    }

    return testRunner;
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
