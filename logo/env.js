//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo runtime environment
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

var $classObj = {};
$classObj.create = function(logo, sys, ext) {
    const env = {};
    const LogoMode = {
        "BATCH": 0,
        "INTERACTIVE": 1
    };

    let _logoMode = LogoMode.BATCH;
    let _globalScope, _envState, _runTime,  _userInput, _resolveUserInput;
    let _asyncFunctionCall;

    let $ret, $primitiveName, $scopeCache, $scopeStackLength; // eslint-disable-line no-unused-vars

    function registerUserInputResolver(resolve) {
        _resolveUserInput = resolve;
        ext.io.envstate("continue");
    }
    env.registerUserInputResolver = registerUserInputResolver;

    function isPendingUserInput() {
        return _resolveUserInput !== undefined;
    }

    function resolveUserInput() {
        let resolve = _resolveUserInput;
        _resolveUserInput = undefined;
        resolve();
    }

    function setPrimitiveName(primitiveName) {
        $primitiveName = primitiveName;
    }
    env.setPrimitiveName = setPrimitiveName;

    function getPrimitiveName() {
        return $primitiveName;
    }
    env.getPrimitiveName = getPrimitiveName;

    function isReservedWordTthen(v) {
        return sys.equalToken(v, "then");
    }
    env.isReservedWordTthen = isReservedWordTthen;

    function extractVarName(varname) {
        return varname.substring(1).toLowerCase();
    }
    env.extractVarName = extractVarName;

    function findLogoVarScope(varname, scopeCache) {
        let ptr = env._scopeStack.length - 1;

        if (typeof scopeCache == "object" && varname in scopeCache) {
            return scopeCache[varname];
        }

        while(!(varname in env._scopeStack[ptr]) && ptr != 0) {
            ptr--;
        }

        let scope = env._scopeStack[ptr];
        if (typeof scopeCache == "object") {
            scopeCache[varname] = scope;
        }

        return scope;
    }
    env.findLogoVarScope = findLogoVarScope;

    function lookupGeneratedCodeSrcmap(line, col) {
        if (!Array.isArray(logo.generatedCodeSrcmap) || logo.generatedCodeSrcmap.length < line) {
            return undefined;
        }

        line--;

        let lineEntry = logo.generatedCodeSrcmap[line];
        if (!Array.isArray(lineEntry)) {
            return undefined;
        }

        let retVal = (Array.isArray(lineEntry[0]) && (0 in lineEntry[0])) ? lineEntry[0][1] : undefined;
        lineEntry.forEach(function(colMap){
            if (!Array.isArray(colMap) || colMap[0] > col) {
                return retVal;
            }

            retVal = colMap[1];
        });

        return retVal;
    }

    function batchMode() {
        return _logoMode == LogoMode.BATCH;
    }
    env.batchMode = batchMode;

    function setBatchMode() {
        _logoMode = LogoMode.BATCH;
    }
    env.setBatchMode = setBatchMode;

    function setInteractiveMode() {
        _logoMode = LogoMode.INTERACTIVE;
    }
    env.setInteractiveMode = setInteractiveMode;

    function prepareToBeBlocked() {
        ext.io.drawflush();
    }
    env.prepareToBeBlocked = prepareToBeBlocked;

    function setAsyncFunctionCall(val) {
        _asyncFunctionCall = val;
    }
    env.setAsyncFunctionCall = setAsyncFunctionCall;

    function getAsyncFunctionCall() {
        return !!_asyncFunctionCall;
    }
    env.getAsyncFunctionCall = getAsyncFunctionCall;

    function registerOnStdinCallback() {
        if ("io" in ext && "onstdin" in ext.io && typeof ext.io.onstdin == "function") {
            ext.io.onstdin(async function(d){ // logoUserInputListener
                setUserInput(d.toString());

                if (isPendingUserInput()) {
                    resolveUserInput();
                    return;
                }

                if (batchMode()) {
                    return; // don't exit while running tests
                }

                while (hasUserInput()) {

                    let userInput = getUserInput();

                    if (sys.equalToken(userInput, "quit") || sys.equalToken(userInput, "exit") || sys.equalToken(userInput, "bye")) {
                        _envState = "exit";
                        ext.io.exit();
                        return; // exit
                    }

                    let ret = await exec(userInput, sys.Config.get("genCommand"), 0);
                    if (!sys.isUndefined(ret)) {
                        logo.io.stdout("Result:" + logo.type.toString(ret));
                    }
                }

                return;
            }, getEnvState);
        }
    }

    function setUserInput(val) {
        Array.prototype.push.apply(_userInput, val.split(/\r?\n/));
        _userInput.splice(-1, 1); // remove the trailing empty string
    }
    env.setUserInput = setUserInput;

    function hasUserInput() {
        return _userInput.length > 0;
    }
    env.hasUserInput = hasUserInput;

    function getUserInput() {
        return _userInput.shift();
    }
    env.getUserInput = getUserInput;

    function initLogoEnv() {
        clearWorkspace();

        registerOnStdinCallback();
    }
    env.initLogoEnv = initLogoEnv;

    function clearWorkspace() {

        _globalScope = {"_global": 1 };

        env._scopeStack = [_globalScope];
        env._ws = {};
        env._user = {};
        env._callstack = [];
        env._curProc = undefined;
        logo.turtle.reset();
        _userInput = [];
        _resolveUserInput = undefined;

        $ret = undefined;
    }
    env.clearWorkspace = clearWorkspace;

    function resetInterpreterCallStack() {
        env._callstack = [];
        env._curProc = undefined;
    }
    env.resetInterpreterCallStack = resetInterpreterCallStack;

    function setEnvState(val) {
        _envState = val;
    }
    env.setEnvState = setEnvState;

    function getEnvState() {
        return _envState;
    }
    env.getEnvState = getEnvState;

    function setRunTime(val) {
        _runTime = val;
    }

    function getRunTime() {
        return _runTime;
    }
    env.getRunTime = getRunTime;

    async function logoExecHelper(logosrc, genjs, srcidx, srcLine) {
        resetInterpreterCallStack();

        let parsedCode = logo.parse.parseSrc(logosrc, srcidx, srcLine);
        sys.trace(parsedCode, "parse.result");
        setEnvState(sys.isUndefined(parsedCode) ? "multiline" : "ready");
        setAsyncFunctionCall(asyncFunctionCall(logosrc));

        if (genjs) {
            await evalLogoGen.apply(null, parsedCode);
        } else {
            await evalLogo.apply(null, parsedCode);
        }
    }

    function asyncFunctionCall(logosrc) {
        return (/\b(wait|readword)\b/i).test(logosrc);
    }

    async function timedExec(f) {
        let startTime = new Date();

        sys.trace(startTime.toLocaleString(), "time");

        let ret = await f();
        let endTime = new Date();
        sys.trace(endTime.toLocaleString(), "time");

        let runTime = endTime - startTime;
        sys.trace((endTime - startTime)+"ms", "time");
        setRunTime(runTime);

        return ret;
    }

    async function exec(logoSrc, genjs, srcidx) {
        return await timedExec(
            async function() {
                return await logoExecHelper(logoSrc, genjs, srcidx);
            }
        );
    }
    env.exec = exec;

    async function execByLine(logoSrc, genjs, srcidx) {
        return await timedExec(
            async function() {
                let ret;
                let src = logoSrc.split(/\n/);
                for (let i = 0; i < src.length; i++) {
                    let line = src[i];
                    ret = await logoExecHelper(line, genjs, srcidx, i);
                }

                return ret;
            }
        );
    }
    env.execByLine = execByLine;

    function throwRuntimeLogoException(type, funcName, stack) { // eslint-disable-line no-unused-vars
        throw logo.type.LogoException.create(type, [funcName], undefined, stack);
    }

    function checkUnactionableDatum(ret) { // eslint-disable-line no-unused-vars
        if (ret != undefined) {
            throw logo.type.LogoException.create("UNACTIONABLE_DATUM", [ret], undefined, Error().stack);
        }
    }

    async function evalLogo(parsedCommand, srcmap) {
        if (!sys.isUndefined(parsedCommand)) {
            try {
                await logo.interpreter.evxBody(parsedCommand, srcmap);
            } catch(e) {
                if (!logo.type.LogoException.is(e)) {
                    throw e;
                } else {
                    logo.io.stderr(e.formatMessage());

                    let errStack = e.getStack();
                    if (Array.isArray(errStack) && errStack.length > 0) {
                        let stackDump = convertToStackDump(errStack);
                        if (stackDump.length > 0) {
                            logo.io.stderr(stackDump);
                        }
                    }

                    env._callstack.push([env._curProc, e.getSrcmap()]);
                    logo.io.stderr(convertToStackDump(env._callstack.slice(0).reverse()));
                }
            }
        }
    }
    env.evalLogo = evalLogo;

    function convertToStackDump(stack) {
        return sys.isUndefined(stack) ? "" :
            stack.map(function(v) {
                return !Array.isArray(v[1]) || v[1][0] == 0 ? "" :
                    typeof v[0] !== "undefined" ?
                        "    " + v[0] + " at " + logo.type.srcmapToString(v[1]) :
                        "    at " + logo.type.srcmapToString(v[1]);
            }).filter(function(v) { return v != ""; })
                .join("\n");
    }

    function getLogoStack(stack) {

        let ret = [];
        let lines = stack.split(/\r?\n/);
        let parsedStack = [];

        for(let i = 0; i < lines.length; i++) {
            // Mozilla
            let token = lines[i].match(/^\s*(\w+\/)?(\S+?)?@(.+?)(\beval\b)?:(\d+):(\d+)$/);
            if (token != null) {
                parsedStack.push([token[2], token[4], token[5], token[6]]);
                continue;
            }

            // IE, Edge, Chrome
            token = lines[i].match(/^\s*at (.+?) \((\beval\b)?(.+?):(\d+):(\d+)\)$/);
            if (token != null) {
                parsedStack.push([token[1], token[2], token[4], token[5]]);
                continue;
            }
        }

        for (let i = 0; i < parsedStack.length; i++) {
            if (i == 0 && parsedStack.length > 2 && Array.isArray(parsedStack[0]) && parsedStack[0].length > 0 &&
                    typeof parsedStack[0][0] === "string" && parsedStack[0][0].match(/primitiveThrow/)) {
                let srcmap = lookupGeneratedCodeSrcmap(parsedStack[1][2], parsedStack[1][3]);
                ret.push([extractFuncName(parsedStack[2][0]), srcmap]);
                i += 2;
                continue;
            }

            if (parsedStack[i][1] == "eval") {
                if (i<parsedStack.length - 1 && (parsedStack[i][0] == "logo.env._user.$" ||
                    parsedStack[i][0] == "Object.logo.env._user.$")) {

                    let srcmap = lookupGeneratedCodeSrcmap(parsedStack[i][2], parsedStack[i][3]);
                    ret.push([undefined, srcmap]);
                    break;
                } else {
                    let srcmap = lookupGeneratedCodeSrcmap(parsedStack[i][2], parsedStack[i][3]);
                    ret.push([extractFuncName(parsedStack[i][0]), srcmap]);
                }
            }
        }

        return ret;

        function extractFuncName(funcName) {
            let token = funcName.match(/^Object\.(.+?)$/);
            return (token != null) ? token[1] : funcName;
        }
    }
    env.getLogoStack = getLogoStack;

    async function evalLogoJs(logoJsSrc) {
        try {
            sys.trace("evalLogoJs" + logoJsSrc, "evalJs");
            eval(logoJsSrc);
            let retVal = await logo.env._user.$();
            _envState = "continue";
            return retVal;
        } catch(e) {
            if (!logo.type.LogoException.is(e)) {
                if (e.stack) {
                    logo.io.stderr(getLogoStack(e.stack));
                }

                logo.io.stderr(e.stack);
            } else {
                logo.io.stderr(e.formatMessage());
                logo.io.stderr(convertToStackDump(e.getStack()));
            }
        }
    }
    env.evalLogoJs = evalLogoJs;

    function evalLogoJsTimed(logoJsSrc) {
        return timedExec(
            function() {
                return evalLogoJs(logoJsSrc);
            }
        );
    }
    env.evalLogoJsTimed = evalLogoJsTimed;

    async function evalLogoGen(parsedCommand, srcmap) {
        const ret = sys.isUndefined(parsedCommand) ? undefined :
            await evalLogoJs(logo.codegen(parsedCommand, srcmap));
        setEnvState("ready");
        return ret;
    }
    env.evalLogoGen = evalLogoGen;

    return env;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
