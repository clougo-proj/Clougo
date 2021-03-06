const { spawn } = require("child_process");

const clitests = require("../generated/clitests.js").$obj;

const IO_TYPE = {
    "INPUT": "input",
    "OUTPUT": "output"
};

const MESSAGE_TAG = {
    "EXPECT": "expect",
    "ACTUAL": "actual",
    "ERROR":  "error"
};

const TIME_OUT = 2000; // ms

function unescapeSpecialChar(str) {
    return str.replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\b/g, "\b")
        .replace(/\\f/g, "\f")
        .replace(/\\s/g, " ");
}

function parseTestCase(testCaseString) {
    let cliSequence = [];
    let lines = testCaseString.split(/\r?\n/);
    let args = lines.shift().split(/ /);
    lines.forEach(line => {
        let text = unescapeSpecialChar(line.substring(1));
        let direction = line.charAt(0);
        let type = direction == ">" ? IO_TYPE.OUTPUT : IO_TYPE.INPUT;
        cliSequence.push({"type": type, "text": text});
    });

    return {
        "args": args,
        "cliSequence": cliSequence
    };
}

const createTestStub = function(cliut, cliSequence, resolve) {
    let ptr = 0;
    let testStub = {};

    function formatMessage(tag, data) {
        return "(" + (ptr + 1) + ") " + tag + ">" + data + "<";
    }

    function checkIncomplete() {
        if (ptr < cliSequence.length) {
            console.error(formatMessage(MESSAGE_TAG.EXPECT, cliSequence[ptr].text));
            resolve(-1);
        }
    }

    testStub.onStdout = function(data) {
        if (ptr >= cliSequence.length) {
            console.error("Unexpcted output!");
            console.error(formatMessage(MESSAGE_TAG.ACTUAL, data));
            resolve(-1);
            return;
        }

        let goldenData = cliSequence[ptr];
        if (goldenData.type != IO_TYPE.OUTPUT || data != goldenData.text) {
            console.error(formatMessage(MESSAGE_TAG.EXPECT, goldenData.text));
            console.error(formatMessage(MESSAGE_TAG.ACTUAL, data));
            resolve(-1);
        }

        ptr += 1;
        while(ptr < cliSequence.length && cliSequence[ptr].type == IO_TYPE.INPUT) {
            cliut.stdin.write(cliSequence[ptr].text);
            ptr += 1;
        }
    };

    testStub.onStderr = function(data) {
        console.error(formatMessage(MESSAGE_TAG.ERROR, data));
        resolve(-1);
    };

    testStub.onClose = function(code) {
        checkIncomplete();
        resolve(code);
    };

    testStub.onTimeout = function() {
        console.error("Timeout!");
        checkIncomplete();
    };

    return testStub;
};

function runCliTest(testName) {
    return new Promise((resolve) => {
        let testCase = parseTestCase(clitests[testName]);
        let cliut = spawn("node", testCase.args);

        let testStub = createTestStub(cliut, testCase.cliSequence, resolve);
        cliut.stdout.on("data", testStub.onStdout);
        cliut.stderr.on("data", testStub.onStderr);
        cliut.on("close", testStub.onClose);
        setTimeout(testStub.onTimeout, TIME_OUT);
    });
}

async function runCliTests(testNamePattern) {
    let failCount = 0;
    let testNames = Object.keys(clitests);
    if (testNamePattern) {
        testNames = testNames.filter(testName => testName.match(testNamePattern));
    }

    for (let testName of testNames) {
        process.stdout.write(testName + "\t\t");
        let retVal = await runCliTest(testName);
        if (retVal === 0) {
            console.log("Passed");
        } else {
            console.log("Failed");
            failCount += 1;
        }
    }

    console.log("Total:" + testNames.length + "\tFailed:" + failCount);
    return failCount;
}

runCliTests(process.argv[2])
    .then(failCount => {
        process.exit(failCount != 0);
    })
    .catch(e => {
        console.error(e);
        process.exit(-1);
    });
