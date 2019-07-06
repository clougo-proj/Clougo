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
    let _genJs;
    let $ret, $primitiveName, $primitiveSrcmap, $scopeCache; // eslint-disable-line no-unused-vars

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

    function setPrimitiveSrcmap(primitiveSrcmap) {
        $primitiveSrcmap = primitiveSrcmap;
    }
    env.setPrimitiveSrcmap = setPrimitiveSrcmap;

    function getPrimitiveSrcmap() {
        return $primitiveSrcmap;
    }
    env.getPrimitiveSrcmap = getPrimitiveSrcmap;

    function setGenJs(genJs) {
        _genJs = genJs;
    }
    env.setGenJs = setGenJs;

    function getGenJs() {
        return _genJs;
    }
    env.getGenJs = getGenJs;

    function callPrimitive(name, srcmap, ...args) {
        setPrimitiveName(name);
        setPrimitiveSrcmap(srcmap);
        return logo.lrt.primitive[name].apply(undefined, args);
    }
    env.callPrimitive = callPrimitive;

    async function callPrimitiveAsync(name, srcmap, ...args) {
        setPrimitiveName(name);
        setPrimitiveSrcmap(srcmap);
        return await logo.lrt.primitive[name].apply(undefined, args);
    }
    env.callPrimitiveAsync = callPrimitiveAsync;

    function callPrimitiveOperator(name, srcmap, ...args) {
        setPrimitiveName(name);
        setPrimitiveSrcmap(srcmap);
        return logo.lrt.util.getBinaryOperatorRuntimeFunc(name).apply(undefined, args);
    }
    env.callPrimitiveOperator = callPrimitiveOperator;

    async function callPrimitiveOperatorAsync(name, srcmap, ...args) {
        setPrimitiveName(name);
        setPrimitiveSrcmap(srcmap);
        return logo.lrt.util.getBinaryOperatorRuntimeFunc(name).apply(undefined, args);
    }
    env.callPrimitiveOperatorAsync = callPrimitiveOperatorAsync;

    function isReservedWordTthen(v) {
        return sys.equalToken(v, "then");
    }
    env.isReservedWordTthen = isReservedWordTthen;

    function extractVarName(varname) {
        return varname.substring(1).toLowerCase();
    }
    env.extractVarName = extractVarName;

    function extractSlotNum(slotRef) {
        return Number(slotRef.substring(1));
    }
    env.extractSlotNum = extractSlotNum;

    function getSlotValue(slotNum) {
        logo.type.ifTrueThenThrow(slotNum > env._curSlot.length, "INVALID_INPUT", slotNum);
        return env._curSlot[slotNum - 1];
    }
    env.getSlotValue = getSlotValue;

    function findLogoVarScope(varname, scopeCache) {
        if (env._scopeStack.length === 0) {
            return _globalScope;
        }

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
        env._userBlock = new WeakMap();
        env._callstack = [];
        env._curProc = undefined;
        env._curSlot = undefined;
        logo.turtle.reset();
        _userInput = [];
        _resolveUserInput = undefined;

        $ret = undefined;
    }
    env.clearWorkspace = clearWorkspace;

    function resetInterpreterCallStack() {
        env._callstack = [];
        env._curProc = undefined;
        env._curSlot = undefined;
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

    function callLogoInstrList(block) { // eslint-disable-line no-unused-vars
        justInTimeTranspile(block);
        return env._userBlock.get(block)();
    }

    function prepareCallProc(curToken, curSrcmap, curSlot) {
        env._callstack.push([env._curProc, curSrcmap, env._curSlot]);
        env._curProc = curToken;
        env._curSlot = curSlot;
    }
    env.prepareCallProc = prepareCallProc;

    function completeCallProc() {
        let callStackPop = env._callstack.pop();
        env._curProc = callStackPop[0];
        env._curSlot = callStackPop[2];
    }
    env.completeCallProc = completeCallProc;

    async function callLogoInstrListAsync(block) {
        justInTimeTranspile(block);
        return await env._userBlock.get(block)();
    }
    env.callLogoInstrListAsync = callLogoInstrListAsync;

    function justInTimeTranspile(block) {
        if (!env._userBlock.has(block)) {
            let evxContext = logo.interpreter.makeEvalContext(logo.parse.parseBlock(block));
            env._userBlock.set(block, eval(logo.codegen.genInstrListLambdaDeclCode(evxContext, block)));
        }
    }

    async function logoExecHelper(logosrc, genjs, srcidx, srcLine) {
        resetInterpreterCallStack();

        let parsedCode = logo.parse.parseSrc(logosrc, srcidx, srcLine);
        sys.trace(parsedCode, "parse.result");
        setEnvState(sys.isUndefined(parsedCode) ? "multiline" : "ready");
        setAsyncFunctionCall(asyncFunctionCall(logosrc));
        setGenJs(genjs);

        if (genjs) {
            await evalLogoGen(parsedCode);
        } else {
            await evalLogo(parsedCode);
        }
    }

    function asyncFunctionCall(logosrc) {
        return (/\b(wait|readword|apply)\b/i).test(logosrc);
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

    function throwRuntimeLogoException(name, srcmap, value) { // eslint-disable-line no-unused-vars
        throw logo.type.LogoException.create(name, value, srcmap);
    }

    function checkUnactionableDatum(ret, srcmap) {
        if (ret !== undefined) {
            throw logo.type.LogoException.create("UNACTIONABLE_DATUM", [ret], srcmap);
        }
    }
    env.checkUnactionableDatum = checkUnactionableDatum;

    async function evalLogo(parsedCommand) {
        if (!sys.isUndefined(parsedCommand)) {
            try {
                await logo.interpreter.evxBody(parsedCommand);
            } catch(e) {
                if (!logo.type.LogoException.is(e)) {
                    throw e;
                } else {
                    logo.io.stderr(e.formatMessage());
                    env._callstack.push([env._curProc, e.getSrcmap()]);
                    logo.io.stderr(convertToStackDump(env._callstack.slice(0).reverse()));
                }
            }
        }
    }
    env.evalLogo = evalLogo;

    function convertToStackDump(stack) {
        return sys.isUndefined(stack) ? "" :
            stack.map(v => !Array.isArray(v[1]) || v[1][0] == 0 ? "" :
                typeof v[0] !== "undefined" ?
                    "    " + v[0] + " at " + logo.type.srcmapToString(v[1]) :
                    "    at " + logo.type.srcmapToString(v[1]))
                .filter(v => v !== "")
                .join("\n");
    }

    async function evalLogoJs(logoJsSrc) {
        try {
            eval(logoJsSrc);
            await logo.env._user.$();
        } catch(e) {
            if (!logo.type.LogoException.is(e)) {
                throw e;
            } else {
                logo.io.stderr(e.formatMessage());
                env._callstack.push([env._curProc, e.getSrcmap()]);
                logo.io.stderr(convertToStackDump(env._callstack.slice(0).reverse()));
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

    async function evalLogoGen(parsedCommand) {
        const ret = sys.isUndefined(parsedCommand) ? undefined :
            await evalLogoJs(logo.codegen.genTopLevelCode(parsedCommand));
        setEnvState("ready");
        return ret;
    }
    env.evalLogoGen = evalLogoGen;

    async function applyTemplate(template, srcmap, param) {
        if (logo.env.getGenJs()) {
            logo.env.prepareCallProc("[]", srcmap, param);
            let retVal = await logo.env.callLogoInstrListAsync(template);
            logo.env.completeCallProc();
            return retVal;
        }

        return await logo.interpreter.evxInstrList(logo.type.embedReferenceSrcmap(template, srcmap), param);
    }
    env.applyTemplate = applyTemplate;

    async function applyNamedProcedure(template, srcmap, param, inputListSrcmap) {
        if (template in logo.lrt.primitive) {
            const paramListMinLength = logo.lrt.util.getPrimitiveParamMinCount(template);
            const paramListMaxLength = logo.lrt.util.getPrimitiveParamMaxCount(template);

            checkSlotLength(template, param, inputListSrcmap, paramListMinLength, paramListMaxLength);
            param.splice(0, 0, template, srcmap);
            return await logo.env.callPrimitiveAsync.apply(undefined, param);
        } else if (template in logo.env._user) {
            let callTarget = logo.env._user[template];
            checkSlotLength(template, param, inputListSrcmap, callTarget.length);
            logo.env.prepareCallProc("[]", srcmap);
            let retVal = logo.env.getAsyncFunctionCall() ?
                await callTarget.apply(undefined, param) : callTarget.apply(undefined, param);

            logo.env.completeCallProc();
            return retVal;
        } else if (template in logo.env._ws) {
            let callTarget = logo.env._ws[template];
            checkSlotLength(template, param, inputListSrcmap, callTarget.formal.length);
            logo.env.prepareCallProc("[]", srcmap);
            let retVal = await logo.interpreter.evxProc(callTarget, param);
            logo.env.completeCallProc();
            return retVal;
        } else {
            throw logo.type.LogoException.create("UNKNOWN_PROC", [template], srcmap);
        }
    }
    env.applyNamedProcedure = applyNamedProcedure;

    function checkSlotLength(template, slot, srcmap, length, maxLength) {
        if (slot.length < length) {
            throw logo.type.LogoException.create("NOT_ENOUGH_INPUTS", [template], srcmap);
        }

        if (maxLength !== -1 && (slot.length > length || (maxLength !== undefined && slot.length > maxLength))) {
            throw logo.type.LogoException.create("TOO_MUCH_INSIDE_PAREN", undefined, srcmap);
        }
    }

    return env;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
