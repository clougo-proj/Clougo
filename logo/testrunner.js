//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo unit test runner

export default {
    "create": function(Logo, sys) {
        const testRunner = {};

        let extForTest, logoForUnitTests;
        let count, failCount;
        let reFilter;
        let curDirName;
        let singleTestMode = false;

        async function runTests(testNamePatterns, logo) {
            initializeTestEnv(logo);
            singleTestMode = logoForUnitTests.config.get("verbose");

            // make regex for filtering unit tests by their full names
            reFilter = sys.isUndefined(testNamePatterns) ? undefined : sys.makeMatchListRegexp(testNamePatterns);
            count = 0;
            failCount = 0;

            await runUnitTestDir();
            Logo.io.stdout("Total:" + count + "\tFailed:" + failCount);
            return failCount;
        }
        testRunner.runTests = runTests;

        async function runSingleTest(fullTestName, testMethod, logo) {
            initializeTestEnv(logo);
            singleTestMode = true;

            let testInfo = getTestInfo(fullTestName);
            let prefix = testInfo[0];
            let testName = testInfo[1];

            await runTestHelper(prefix, testName, testMethod);
        }
        testRunner.runSingleTest = runSingleTest;

        function initializeTestEnv(logo) {
            extForTest = makeLogoDependenciesForTest(logo.ext);
            logoForUnitTests = Logo.create(extForTest, logo.config);
        }

        function getTestInfo(fullTestName) {
            let testPath = fullTestName.split(".");
            let prefix = testPath.slice(0, -1).join(".");
            let testName =  testPath[testPath.length - 1];
            return [prefix, testName];
        }

        function parseTestList(obj) {
            if (!logoForUnitTests.logofs.exists(obj)) {
                return [];
            }

            let cases = obj.split(/\r?\n/);
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

        async function runUnitTestsInCurrentDir(prefix) {
            let tests = parseTestList(await logoForUnitTests.logofs.tryGetObj(getDirName(prefix) + "/list.txt"));
            for (let test of tests) {
                let testName = prefix + "." + test[0];
                if (sys.isUndefined(reFilter) || testName.match(reFilter)) {
                    await runTest(prefix, test);
                }
            }
        }

        async function runUnitTestsInSubDirs(prefix) {
            for (let subDir of await logoForUnitTests.logofs.readSubDirs(getDirName(prefix))) {
                await runUnitTestDir(sys.isUndefined(prefix) ? subDir : prefix + "." + subDir);
            }
        }

        async function runUnitTestDir(prefix) {
            await runUnitTestsInCurrentDir(prefix);
            await runUnitTestsInSubDirs(prefix);
        }

        function makeLogoDependenciesForTest(ext) {

            let stdoutBuffer = "";
            let stderrBuffer = "";
            let turtleBuffer = "";

            const extForTest = {
                "entry": {
                    "exec": async function(logoSrc, srcPath) { await logoForUnitTests.env.exec(logoSrc, true, srcPath); },
                    "runSingleTest": async function(testName, testMethod) {
                        await runSingleTest(testName, testMethod, ext);
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
                    "readfile": async fileName => await logoForUnitTests.logofs.readFile(curDirName + "/" + fileName),
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

        async function runTest(prefix, test) {
            let testName = test[0];
            let testCmds = test[1];
            for (let testCmd of testCmds) {
                await runTestHelper(prefix, testName, testCmd);
            }
        }

        async function getTestFile(fileName) {
            try {
                let ret = await logoForUnitTests.logofs.readFile(curDirName + "/" + fileName);
                return ret;
            } catch (e) {
                if (logoForUnitTests.type.LogoException.CANT_OPEN_FILE.equalsByCode(e)) {
                    return "";
                }

                throw e;
            }
        }

        async function getTestSrc(testName) {
            return await getTestFile(testName + ".lgo");
        }

        async function getTestInBase(testName) {
            return await getTestFile(testName + ".in");
        }

        async function getTestOutBase(testName) {
            return expandBuiltInMacros(await getTestFile(testName + ".out"));
        }

        async function getTestErrBase(testName) {
            return expandBuiltInMacros(await getTestFile(testName + ".err"));
        }

        async function getTestDrawBase(testName) {
            return await getTestFile(testName + ".draw");
        }

        async function getTestParseBase(testName) {
            return await getTestFile(testName + ".parse");
        }

        async function testParse(testName) {
            let testSrc = await getTestSrc(testName);
            let testParseBase = await getTestParseBase(testName);
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

        async function tryRunTestMethod(testSrc, testName, runTestMethod) {
            try {
                await runTestMethod(testSrc, testName);
                return true;
            } catch (e) {
                Logo.io.stdout("\t\tfailed");
                if (singleTestMode) {
                    Logo.io.stdout(e.stack);
                }

                return false;
            }
        }

        async function testGenericRun(testName, runTestMethod) {
            let testSrcName = testName + ".lgo";
            let testSrc = await getTestSrc(testName);
            extForTest.io.clearBuffers();
            extForTest.canvas.clearBuffer();

            if (!await tryRunTestMethod(testSrc, testSrcName, runTestMethod)) {
                failCount++;
                return;
            }

            const outExpected = await getTestOutBase(testName);
            const errExpected = await getTestErrBase(testName);
            const drawExpected = await getTestDrawBase(testName);

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

        function getDirName(prefix) {
            return prefix === undefined ? "/unittests" : "/unittests/" + prefix.replace(/\./g, "/");
        }

        async function runTestHelper(prefix, testName, testMethod) {
            curDirName = getDirName(prefix);
            extForTest.io.mockStdin(await getTestInBase(testName));
            logoForUnitTests.env.initLogoEnv();
            count++;

            Logo.io.stdoutn(prefix + "." + testName + "(" + testMethod + "):");
            let testSettings = toTestSettings(testMethod);
            let backupConfig = overrideLogoConfig(logoForUnitTests, testSettings);
            await logoForUnitTests.env.loadDefaultLogoModules();

            switch(testSettings.mode) {
            case Logo.mode.PARSE:
                await testParse(testName);
                break;
            case Logo.mode.RUNL:
                await testGenericRun(testName,
                    async function(testSrc, srcPath) {
                        await logoForUnitTests.env.execByLine(testSrc, false, srcPath);
                    });
                break;
            case Logo.mode.EXECL:
                await testGenericRun(testName,
                    async function(testSrc, srcPath) {
                        await logoForUnitTests.env.execByLine(testSrc, true, srcPath);
                    });
                break;
            case Logo.mode.RUN:
                await testGenericRun(testName,
                    async function(testSrc, srcPath) {
                        await logoForUnitTests.env.exec(testSrc, false, srcPath);
                    });
                break;
            case Logo.mode.EXEC:
                await testGenericRun(testName,
                    async function(testSrc, srcPath) {
                        await logoForUnitTests.env.exec(testSrc, true, srcPath);
                    });
                break;
            default:
                Logo.io.stdout("\t\t" + testSettings.mode + " not found");
                failCount++;
            }

            restoreLogoConfig(logoForUnitTests, backupConfig);
        }

        return testRunner;
    }
};
