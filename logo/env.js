//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo runtime environment
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

var classObj = {};
classObj.create = function(logo, sys, ext) {
    const env = {};
    const LogoMode = {
        "BATCH": 0,
        "INTERACTIVE": 1
    };

    let _logoMode = LogoMode.BATCH;
    let _globalScope, _parserState, _runTime,  _userInput, _retVal;

    let $ret, $scopecache, $scopeStackLength, $forBegin, $forEnd, $forStep, $forDecrease; // eslint-disable-line no-unused-vars

    function isReservedWordTthen(v) {
        return sys.equalToken(v, "then");
    }
    env.isReservedWordTthen = isReservedWordTthen;

    function extractVarName(varname) {
        return varname.substr(1).toLowerCase();
    }
    env.extractVarName = extractVarName;

    function findLogoVarScope(varname, scopecache) {
        let ptr = env._scopeStack.length - 1;

        if (typeof scopecache == "object" && varname in scopecache) {
            return scopecache[varname];
        }

        while(!(varname in env._scopeStack[ptr]) && ptr != 0) {
            ptr--;
        }

        let scope = env._scopeStack[ptr];
        if (typeof scopecache == "object") {
            scopecache[varname] = scope;
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

    function registerOnStdinCallback() {
        if ("io" in ext && "onstdin" in ext.io && typeof ext.io.onstdin == "function") {
            ext.io.onstdin(function(d){
                setUserInput(d.toString());

                // read from redirected input stream
                if (batchMode()) {
                    if (!asyncCompleted()) {
                        asyncExec();
                        if (asyncCompleted()) {
                            return "exit"; // exit
                        }
                    }

                    return "continue";
                }

                // interactive mode
                if (!asyncCompleted()) {
                    asyncExec();
                }

                if (!asyncCompleted() && !hasUserInput()) {
                    return "continue"; // no prompt
                }

                while (hasUserInput()) {

                    let userInput = getUserInput();

                    if (sys.equalToken(userInput, "quit") || sys.equalToken(userInput, "exit") || sys.equalToken(userInput, "bye")) {
                        return "exit";  // exit
                    }

                    let ret = exec(userInput, sys.Config.get("genCommand"), 0);
                    if (!sys.isUndefined(ret)) {
                        logo.io.stdout("Result:" + logo.type.logoToString(ret));
                    }
                }

                return getParserState(); // ready | multiline | continue
            });
        }
    }

    function setUserInput(val) {
        Array.prototype.push.apply(_userInput, val.split(/\r?\n/));
        _userInput.splice(-1, 1);
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

    function asyncCompleted() {
        return env._execFuncStack.length == 0;
    }
    env.asyncCompleted = asyncCompleted;

    function asyncExec() {
        while (env._execFuncStack.length > 0) {
            let func = env._execFuncStack.pop();
            if (!Array.isArray(func)) { // not a catch block
                try {
                    func();
                    setParserState("ready");
                } catch(e) {
                    if (logo.type.LogoException.is(e) && e.codeEquals("READX")) {
                        // halt execution and wait for user input
                        setParserState("continue");
                        break;
                    }

                    handleCatch(e);
                }
            }

            // skip catch blocks
        }
    }
    env.asyncExec = asyncExec;

    function handleCatch(e) {
        outerLoop:
        while (env._execFuncStack.length > 0 && !sys.isUndefined(e)) {
            let func;
            while (!Array.isArray(func = env._execFuncStack.pop())) {
                if (env._execFuncStack.length == 0) {
                    break outerLoop;
                }
            }

            // func is array: [catchBlock]
            sys.trace(JSON.stringify(e), "tmp");
            e = func[0](e);
        }

        if (!sys.isUndefined(e)) {
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

    function asyncReset() {
        env._execFuncStack = [];
    }

    function async() {
        Array.prototype.push.apply(env._execFuncStack, Array.prototype.reverse.call(arguments));
    }
    env.async = async;

    function asyncTry(tryBlock) {
        return tryBlock;
    }
    env.asyncTry = asyncTry;

    function asyncCatch(catchBlock) {
        return [catchBlock];
    }
    env.asyncCatch = asyncCatch;

    function resetWorkspace() {
        _globalScope = {"_global": 1 };

        env._scopeStack = [_globalScope];
        env._ws = {};
        env._user = {};
        env._callstack = [];
        env._curProc = undefined;
        logo.turtle.reset();
        _userInput = [];

        $ret = undefined;

        registerOnStdinCallback();
        asyncReset();
    }
    env.resetWorkspace = resetWorkspace;

    function resetInterpreterCallStack() {
        env._callstack = [];
        env._curProc = undefined;
    }
    env.resetInterpreterCallStack = resetInterpreterCallStack;

    function setParserState(val) {
        _parserState = val;
    }
    env.setParserState = setParserState;

    function getParserState() {
        return _parserState;
    }
    env.getParserState = getParserState;

    function setRunTime(val) {
        _runTime = val;
    }

    function getRunTime() {
        return _runTime;
    }
    env.getRunTime = getRunTime;

    function logoExecHelper(command, genjs, srcidx) {
        resetInterpreterCallStack();

        let parsedCode = logo.parse.parseSrc(command, srcidx);
        sys.trace(parsedCode, "parse.result");
        setParserState( sys.isUndefined(parsedCode) ? "multiline" : "ready");

        return genjs ? evalLogoGen.apply(null, parsedCode) : evalLogo.apply(null, parsedCode);
    }

    function timedExec(f) {
        let startTime = new Date();

        sys.trace(startTime.toLocaleString(), "time");

        let ret = f();
        let endTime = new Date();
        sys.trace(endTime.toLocaleString(), "time");

        let runTime = endTime - startTime;
        sys.trace((endTime - startTime)+"ms", "time");
        setRunTime(runTime);

        return ret;
    }

    function exec(logoSrc, genjs, srcidx) {
        return timedExec(
            function() {
                return logoExecHelper(logoSrc, genjs, srcidx);
            }
        );
    }
    env.exec = exec;

    function execByLine(logoSrc, genjs, srcidx) {
        return timedExec(
            function() {
                let ret;
                logoSrc.split(/\n/).forEach(function(line) { ret = logoExecHelper(line, genjs, srcidx); } );
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

    function evalLogo(parsedCommand, srcmap) {
        if (!sys.isUndefined(parsedCommand)) {
            logo.interpreter.evxBody(parsedCommand, srcmap);
            asyncExec();
        }

        return _retVal;
    }
    env.evalLogo = evalLogo;

    function convertToStackDump(stack) {
        return sys.isUndefined(stack) ? "" :
            stack.map(function(v) {
                return !Array.isArray(v[1]) || v[1][0] == 0 ? "" :
                    typeof v[0] !== "undefined" ?
                        "    " + v[0] + " at " + v[1][1] + "," + v[1][2] :
                        "    at " + v[1][1] + "," + v[1][2];
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
                if (i<parsedStack.length-1 && (parsedStack[i+1][0]=="evalLogoJs" || parsedStack[i+1][0]=="Object.evalLogoJs")) {
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

    function evalLogoJs(logoJsSrc) {
        try {
            sys.trace("evalLogoJs" + logoJsSrc, "evalJs");
            return eval(logoJsSrc);
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

    function evalLogoGen(parsedCommand, srcmap) {
        return sys.isUndefined(parsedCommand) ? undefined : evalLogoJs(logo.codegen(parsedCommand, srcmap));
    }
    env.evalLogoGen = evalLogoGen;

    return env;
};

if (typeof exports != "undefined") {
    exports.classObj = classObj;
}
