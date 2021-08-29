//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo runtime environment
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

var $obj = {};
$obj.create = function(logo, sys, ext) {
    const env = {};

    let _primitiveJsFunc = {};

    let _primitiveMetadata = {};

    let _procJsFunc;

    let _procMetadata;

    const LogoMode = {
        "BATCH": 0,
        "INTERACTIVE": 1
    };

    const defaultModules = {
        "pclogo": [
            "/mod/pclogo/pclogo.lgo"
        ]
    };

    const LOGO_EVENT = logo.constants.LOGO_EVENT;

    const LOGO_LIBRARY = logo.constants.LOGO_LIBRARY;

    const PROC_ATTRIBUTE = logo.constants.PROC_ATTRIBUTE;

    function createParamScope() {
        let _stack = [];
        let obj = {};

        function begin(value) {
            _stack.push(value);
        }
        obj.begin = begin;

        function add(value) {
            _stack[_stack.length - 1].push(value);
        }
        obj.add = add;

        function end() {
            return _stack.pop();
        }
        obj.end = end;

        return obj;
    }
    env.createParamScope = createParamScope;

    let _logoMode = LogoMode.BATCH;
    let _globalScope, _envState, _runTime, _userInput, _resolveUserInput;
    let _asyncFunctionCall;
    let _genJs;
    let $primitiveName, $primitiveSrcmap;
    let $ret, $scopeCache; // eslint-disable-line no-unused-vars
    let $param = createParamScope(); // eslint-disable-line no-unused-vars

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

    function setProcName(primitiveName) {
        $primitiveName = primitiveName;
    }
    env.setProcName = setProcName;

    function getProcName() {
        return $primitiveName;
    }
    env.getProcName = getProcName;

    function setProcSrcmap(primitiveSrcmap) {
        $primitiveSrcmap = primitiveSrcmap;
    }
    env.setProcSrcmap = setProcSrcmap;

    function getProcSrcmap() {
        return $primitiveSrcmap;
    }
    env.getProcSrcmap = getProcSrcmap;

    function setGenJs(genJs) {
        _genJs = genJs;
    }
    env.setGenJs = setGenJs;

    function getGenJs() {
        return _genJs === true;
    }
    env.getGenJs = getGenJs;

    function callProc(name, srcmap, ...args) {
        setProcName(name);
        setProcSrcmap(srcmap);
        return getCallTarget(name).apply(undefined, args);
    }
    env.callProc = callProc;

    async function callProcAsync(name, srcmap, ...args) {
        setProcName(name);
        setProcSrcmap(srcmap);
        return await getCallTarget(name).apply(undefined, args);
    }
    env.callProcAsync = callProcAsync;

    function callPrimitiveOperator(name, srcmap, ...args) {
        setProcName(name);
        setProcSrcmap(srcmap);
        return logo.lrt.util.getBinaryOperatorRuntimeFunc(name).apply(undefined, args);
    }
    env.callPrimitiveOperator = callPrimitiveOperator;

    async function callPrimitiveOperatorAsync(name, srcmap, ...args) {
        setProcName(name);
        setProcSrcmap(srcmap);
        return logo.lrt.util.getBinaryOperatorRuntimeFunc(name).apply(undefined, args);
    }
    env.callPrimitiveOperatorAsync = callPrimitiveOperatorAsync;

    function extractVarName(varname) {
        return varname.substring(1).toLowerCase().replace(/"/g, "\\\"");
    }
    env.extractVarName = extractVarName;

    function extractSlotNum(slotRef) {
        return Number(slotRef.substring(1));
    }
    env.extractSlotNum = extractSlotNum;

    function getSlotValue(slotNum) {
        logo.type.ifTrueThenThrow(env._curSlot === undefined || slotNum > env._curSlot.param.length,
            logo.type.LogoException.INVALID_INPUT, slotNum);

        return env._curSlot.param[slotNum - 1];
    }
    env.getSlotValue = getSlotValue;

    function getSlotIndex() {
        return env._curSlot.index;
    }
    env.getSlotIndex = getSlotIndex;

    function getSlotRestValue(slotNum) {
        logo.type.ifTrueThenThrow(env._curSlot === undefined || slotNum > env._curSlot.rest.length,
            logo.type.LogoException.INVALID_INPUT, slotNum);

        return logo.type.makeLogoList(env._curSlot.rest[slotNum - 1]);
    }
    env.getSlotRestValue = getSlotRestValue;

    function splitBodyByLines(body, bodySrcmap) {
        let bodyByLine = [];
        let bodyByLineSrcmap = [];
        for (let begin = logo.type.LIST_HEAD_SIZE; begin < body.length;) {
            let end = body.indexOf(logo.type.NEWLINE, begin);
            let line, lineSrcmap;
            if (end === -1) {
                line = body.slice(begin);
                lineSrcmap = bodySrcmap.slice(begin);
            } else {
                line = body.slice(begin, end);
                lineSrcmap = bodySrcmap.slice(begin, end);
            }

            bodyByLine.push(logo.type.makeLogoList(line));
            bodyByLineSrcmap.push(logo.type.makeLogoList(lineSrcmap));
            if (end === -1) {
                break;
            }

            begin = end + 1;
        }

        return {"body": bodyByLine, "bodySrcmap": bodyByLineSrcmap};
    }

    function getLogoProcText(procName) {
        let bodyComp = splitBodyByLines(_procMetadata[procName].body,  _procMetadata[procName].bodySrcmap);
        let text = [logo.type.makeLogoList(_procMetadata[procName].formal.slice(0))].concat(bodyComp.body);
        let textSrcmap = [logo.type.makeLogoList(_procMetadata[procName].formalSrcmap.slice(0))].concat(bodyComp.bodySrcmap);

        return logo.type.embedSrcmap(logo.type.makeLogoList(text), logo.type.makeLogoList(textSrcmap));
    }
    env.getLogoProcText = getLogoProcText;

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

    function getGlobalScope() {
        return _globalScope;
    }
    env.getGlobalScope = getGlobalScope;

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
        return _asyncFunctionCall || logo.config.get("deepCallStack");
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
                        _envState = LOGO_EVENT.EXIT;
                        ext.io.exit();
                        return; // exit
                    }

                    let ret = await exec(userInput, logo.config.get("genCommand"), 0);
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
        _procJsFunc = Object.create(_primitiveJsFunc);
        _procMetadata = Object.create(_primitiveMetadata);

        env._scopeStack = [_globalScope];
        env._userBlock = new WeakMap();
        env._userBlockCalled = new WeakMap();
        env._callstack = [];
        env._frameProcName = undefined;
        env._curSlot = undefined;
        logo.lrt.util.getLibrary(LOGO_LIBRARY.GRAPHICS).reset();
        _userInput = [];
        _resolveUserInput = undefined;

        setAsyncFunctionCall(false);

        $ret = undefined; // eslint-disable-line no-unused-vars
    }
    env.clearWorkspace = clearWorkspace;

    function resetInterpreterCallStack() {
        env._callstack = [];
        env._frameProcName = undefined;
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
        justInTimeTranspileInstrList(block);
        return env._userBlock.get(block)();
    }

    function prepareCallProc(curToken, curSrcmap, curSlot = env._curSlot) {
        if (isPrimitive(curToken)) {
            return;
        }

        env._callstack.push([env._frameProcName, curSrcmap, env._curSlot]);
        env._frameProcName = curToken;
        env._curSlot = curSlot;
    }
    env.prepareCallProc = prepareCallProc;

    function completeCallProc(procName) {
        if (isPrimitive(procName)) {
            return;
        }

        let callStackPop = env._callstack.pop();
        env._frameProcName = callStackPop[0];
        env._curSlot = callStackPop[2];
    }
    env.completeCallProc = completeCallProc;

    async function callLogoInstrListAsync(block, param) {
        justInTimeTranspileInstrList(block);
        return await env._userBlock.get(block).apply(undefined, param);
    }
    env.callLogoInstrListAsync = callLogoInstrListAsync;

    function defineLogoProc(procName, formal, body, formalSrcmap = logo.type.SRCMAP_NULL,
        bodySrcmap = logo.type.SRCMAP_NULL) {

        defineLogoProcCode(procName, formal, body, formalSrcmap, bodySrcmap);

        if (getGenJs() || existsProcJsFunc(procName)) {
            defineLogoProcJs(procName, formal, body, formalSrcmap, bodySrcmap);
        }

        return false;
    }
    env.defineLogoProc = defineLogoProc;

    function defineLogoProcSignatureAtParse(procName, formal, formalSrcmap = logo.type.SRCMAP_NULL, attributes = PROC_ATTRIBUTE.EMPTY) {
        _procMetadata[procName] = makeProcMetadata(formal, formalSrcmap, undefined, undefined, attributes);
    }
    env.defineLogoProcSignatureAtParse = defineLogoProcSignatureAtParse;

    function defineLogoProcCode(procName, formal, body, formalSrcmap, bodySrcmap, attributes = PROC_ATTRIBUTE.EMPTY) {
        _procMetadata[procName] = makeProcMetadata(formal, formalSrcmap, body, bodySrcmap, attributes);
    }
    env.defineLogoProcCode = defineLogoProcCode;

    function defineLogoProcBody(proc, srcmap) {
        let procName = logo.type.getLogoProcName(proc);
        let formal = logo.type.getLogoProcParams(proc);
        let body = logo.type.getLogoProcBody(proc);
        let attributes = logo.type.getLogoProcAttributes(proc);

        if (existsProcJsFunc(procName)) {
            delete _procJsFunc[procName];
        }

        if (isProc(procName) && getProcMetadata(procName).formal === formal && getProcMetadata(procName).body === body) {
            return;
        }

        let formalSrcmap = logo.type.getLogoProcParams(srcmap);
        let bodySrcmap = logo.type.getLogoProcBody(srcmap);
        defineLogoProcCode(procName, formal, body, formalSrcmap, bodySrcmap, attributes);
    }
    env.defineLogoProcBody = defineLogoProcBody;

    function makeProcMetadata(formal, formalSrcmap, body = undefined, bodySrcmap = undefined, attributes = PROC_ATTRIBUTE.EMPTY) {
        return {
            "formal" : formal,
            "formalSrcmap" : formalSrcmap,
            "body" : body,
            "bodySrcmap" : bodySrcmap,
            "attributes" : attributes,
            "precedence" : 0
        };
    }

    function makePrimitiveMetadata(parsedFormal, attributes = PROC_ATTRIBUTE.PRIMITIVE, precedence = 0) {
        return {
            "parsedFormal" : parsedFormal,
            "formalSrcmap" : logo.type.SRCMAP_NULL,
            "attributes"   : attributes,
            "precedence"   : precedence
        };
    }

    function isOptionalInput(input) {
        return logo.type.isLogoList(input) && logo.type.listLength(input) > 1;
    }

    function getInputName(input) {
        return logo.type.listItem(1, input);
    }

    function isRestInput(input) {
        return logo.type.isLogoList(input) && logo.type.listLength(input) === 1;
    }

    function isDefaultInputCount(input) {
        let number = sys.toNumberIfApplicable(input);
        return sys.isInteger(number) && number > 0;
    }

    function makeFormal(length, minInputCount, defaultInputCount, maxInputCount, params, paramTemplates, restParam) {
        return {
            "length": length,
            "params": params,
            "paramTemplates": paramTemplates,
            "restParam": restParam,
            "minInputCount": minInputCount,
            "defaultInputCount": defaultInputCount,
            "maxInputCount": maxInputCount
        };
    }
    env.makeFormal = makeFormal;

    function makeDefaultFormal(length) {
        return makeFormal(length, length, length, length, Array.from({length: length}, (v, i) => i), [], undefined);
    }
    env.makeDefaultFormal = makeDefaultFormal;

    function parseFormalParams(formal, formalSrcmap = logo.type.SRCMAP_NULL) {
        let length = formal.length;
        let minInputCount = 0;
        let defaultInputCount = 0;
        let maxInputCount = 0;
        let restParam = undefined;

        let params = [];
        let paramTemplates = [];
        let ptr = length - 1;

        parseDefaultInputCount();
        parseRestParam();
        parseOptionalParams();

        minInputCount = ptr + 1;

        parseRequiredParams();

        if (defaultInputCount === 0) {
            defaultInputCount = minInputCount;
        }

        return makeFormal(params.length, minInputCount, defaultInputCount, maxInputCount, params, paramTemplates, restParam);

        function parseDefaultInputCount() {
            if (ptr >= 0 && isDefaultInputCount(formal[ptr])) {
                defaultInputCount = formal[ptr];
                ptr -= 1;
            }
        }

        function parseRestParam() {
            if (ptr >= 0 && isRestInput(formal[ptr])) {
                maxInputCount = -1;
                restParam = getInputName(formal[ptr]);
                ptr -= 1;
            } else {
                maxInputCount = ptr + 1;
            }
        }

        function parseOptionalParams() {
            while (ptr >= -1 && isOptionalInput(formal[ptr])) {
                params[ptr] = getInputName(formal[ptr]);
                let template = logo.type.listButFirst(formal[ptr]);
                if (formalSrcmap !== logo.type.SRCMAP_NULL) {
                    let templateSrcmap = logo.type.listButFirst(formalSrcmap[ptr]);
                    logo.type.embedSrcmap(template, templateSrcmap);
                }

                paramTemplates[ptr] = template;

                ptr -= 1;
            }
        }

        function parseRequiredParams() {
            if (minInputCount > 0) {
                params.splice(0, minInputCount);
                Array.prototype.unshift.apply(params, formal.slice(0, minInputCount));
            }
        }
    }

    function defineLogoProcJs(procName, formal, body, formalSrcmap, bodySrcmap) {
        let code = logo.codegen.genProc(logo.type.makeLogoProc(procName, formal, body),
            logo.type.makeLogoProc(procName, formalSrcmap, bodySrcmap));

        let mergedCode = code.merge();
        eval(mergedCode);
    }

    function justInTimeTranspileInstrList(block) {
        if (!env._userBlock.has(block)) {
            let blockComp = logo.parse.parseBlock(block);
            let formalParam = getInstrListFormalParam(blockComp);
            if (formalParam === undefined) {
                let evxContext = logo.interpreter.makeEvalContext(blockComp);
                env._userBlock.set(block, eval(logo.codegen.genInstrListLambdaDeclCode(evxContext)));
            } else {
                let evxContext = logo.interpreter.makeEvalContext(logo.type.listButFirst(blockComp));
                env._userBlock.set(block, eval(logo.codegen.genInstrListLambdaDeclCode(evxContext, formalParam)));
            }
        }
    }

    function justInTimeTranspileProcText(template) {
        if (!env._userBlock.has(template)) {
            env._userBlock.set(template, eval(logo.codegen.genProcText(template).merge()));
        }
    }

    async function logoExecHelper(logosrc, genjs, srcidx, srcLine) {
        resetInterpreterCallStack();

        let parsedCode = logo.parse.parseSrc(logosrc, srcidx, srcLine);
        logo.trace.info(parsedCode, "parse.result");
        setGenJs(genjs);
        setEnvState(LOGO_EVENT.CONTINUE);

        if (genjs) {
            await evalLogoGen(parsedCode);
        } else {
            await evalLogo(parsedCode);
        }

        setEnvState(logo.parse.getParserState());
    }

    function isEagerEval(logosrc) {
        return (/^(load)\b/i).test(logosrc);
    }

    async function timedExec(f) {
        let startTime = new Date();

        logo.trace.info(startTime.toLocaleString(), "time");

        let ret = await f();
        let endTime = new Date();
        logo.trace.info(endTime.toLocaleString(), "time");

        let runTime = endTime - startTime;
        logo.trace.info((endTime - startTime)+"ms", "time");
        setRunTime(runTime);

        return ret;
    }

    function makeSrcSegment(src, beginLineNum) {
        return {
            LOGO_SRC: src,
            LINE_NUM: beginLineNum
        };
    }

    function splitEagerEvalCode(logoSrc) {
        let srcLines = logoSrc.split("\n");
        let eagerLineNums = srcLines.map((line, index) => isEagerEval(line) ? index + 1 : 0)
            .filter((lineNum) => lineNum !== 0);

        if (eagerLineNums.length === 0) {
            return [makeSrcSegment(logoSrc, 0)];
        }

        let srcSegments = [];
        let lastLineNum = 0;
        for (let eagerLineNum of eagerLineNums) {
            srcSegments.push(makeSrcSegment(srcLines.slice(lastLineNum, eagerLineNum).join("\n"), lastLineNum));
            lastLineNum = eagerLineNum;
        }

        if (lastLineNum < srcLines.length) {
            srcSegments.push(makeSrcSegment(srcLines.slice(lastLineNum).join("\n"), lastLineNum));
        }

        logo.trace.info(JSON.stringify(srcSegments), "env.eagerEval");

        return srcSegments;
    }

    function snapshot() {
        logo.lrt.util.getLibrary(LOGO_LIBRARY.GRAPHICS).snapshot();
        logo.io.canvasSnapshot();
    }

    async function exec(logoSrc, genjs, srcidx) {
        snapshot();
        return await timedExec(
            async function() {
                let ret;
                let srcSegments = splitEagerEvalCode(logoSrc);
                while (srcSegments.length > 0) {
                    let srcSegment = srcSegments.shift();
                    ret = await logoExecHelper(srcSegment.LOGO_SRC, genjs, srcidx, srcSegment.LINE_NUM);
                }

                return ret;
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
                    if (isInterpretedCommand(line)) {
                        ret = await logoExecHelper(line.substring(2), false, srcidx, i);
                    } else if (isTurtleCanvasMouseEvent(line)) {
                        logo.lrt.util.getLibrary(LOGO_LIBRARY.GRAPHICS).onMouseEvent(mockEventFromLine(line));
                    } else {
                        ret = await logoExecHelper(line, genjs, srcidx, i);
                    }
                }

                return ret;
            }
        );
    }
    env.execByLine = execByLine;

    function isInterpretedCommand(line) {
        return line.length >= 2 && line.charAt(0) === ";" && line.charAt(1) === "?";
    }

    function isTurtleCanvasMouseEvent(line) {
        const pattern = ";turtle mouse ";
        return line.length > pattern.length && line.substring(0, pattern.length) == pattern;
    }

    function mockEventFromLine(line) {
        const eventStart = 2;
        return line.trim().split(" ").slice(eventStart).map(sys.toNumberIfApplicable);
    }

    function throwRuntimeLogoException(exception, srcmap, value) { // eslint-disable-line no-unused-vars
        throw exception.withParam(value, srcmap);
    }

    function checkUnusedValue(ret, srcmap) {
        if (ret !== undefined) {
            throw logo.type.LogoException.UNACTIONABLE_DATUM.withParam([ret], srcmap);
        }
    }
    env.checkUnusedValue = checkUnusedValue;

    function errorOnLogoException(e, omitCurProc = true) {
        logo.io.stderr(e.formatMessage());
        if (!omitCurProc) {
            env._callstack.push([env._frameProcName, e.getSrcmap()]);
        }

        logo.io.stderr(convertToStackDump(env._callstack.slice(0).reverse()));
    }
    env.errorOnLogoException = errorOnLogoException;

    async function evalLogo(parsedCommand) {
        let scopeStackLength = env._scopeStack.length;

        if (!sys.isUndefined(parsedCommand)) {
            try {
                await logo.interpreter.evxBody(logo.parse.parseBlock(parsedCommand));
            } catch(e) {
                if (!logo.type.LogoException.is(e)) {
                    throw e;
                } else {
                    errorOnLogoException(e, false);
                }
            }
        }

        env._scopeStack.splice(scopeStackLength);
    }
    env.evalLogo = evalLogo;

    function convertToStackDump(stack) {
        return sys.isUndefined(stack) ? "" :
            stack.map(v => !Array.isArray(v[1]) || v[1][0] == 0 ? "" :
                typeof v[0] !== "undefined" ?
                    "    " + v[0] + " at " + logo.type.srcmapToString(v[1]) :
                    "    at " + logo.type.srcmapToString(v[1]))
                .filter(v => v !== "")
                .join(logo.type.NEWLINE);
    }

    async function evalLogoJs(logoJsSrc) {
        let scopeStackLength = env._scopeStack.length;

        try {
            $ret = undefined; // eslint-disable-line no-unused-vars
            eval(logoJsSrc);
            await _procJsFunc.$();
        } catch(e) {
            if (!logo.type.LogoException.is(e)) {
                throw e;
            } else {
                errorOnLogoException(e, false);
            }
        }

        env._scopeStack.splice(scopeStackLength);
    }
    env.evalLogoJs = evalLogoJs;

    async function evalLogoJsTimed(logoJsSrc) {
        setGenJs(true);
        return await timedExec(
            async function() {
                return await evalLogoJs(logoJsSrc);
            }
        );
    }
    env.evalLogoJsTimed = evalLogoJsTimed;

    async function evalLogoGen(parsedCommand) {
        const ret = sys.isUndefined(parsedCommand) ? undefined :
            await evalLogoJs(logo.codegen.genTopLevelCode(parsedCommand));

        return ret;
    }
    env.evalLogoGen = evalLogoGen;

    async function codegenOnly(src) {
        let ir = logo.parse.parseSrc(src, 1);
        return logo.codegen.genTopLevelCode(ir);
    }
    env.codegenOnly = codegenOnly;

    async function applyInstrList(template, srcmap, pushCallStack = true, slot = {}, inputListSrcmap = undefined) {
        let formalParam = getInstrListFormalParam(template);

        if (formalParam !== undefined) {
            logo.env.checkSlotLength(logo.type.LAMBDA_EXPR, slot.param, inputListSrcmap, formalParam.length);
        }

        if (getGenJs() && (env._userBlockCalled.has(template) || logo.config.get("eagerJitInstrList"))) {
            let scopeStackLength = env._scopeStack.length;
            if (pushCallStack) {
                prepareCallProc(logo.type.LAMBDA_EXPR, srcmap, slot);
            }

            let retVal = await callLogoInstrListAsync(template, slot.param);

            if (pushCallStack) {
                completeCallProc(logo.type.LAMBDA_EXPR);
            }

            env._scopeStack.splice(scopeStackLength);
            return retVal;
        }

        env._userBlockCalled.set(template, true);
        let bodyComp = logo.type.embedReferenceSrcmap(template, srcmap);
        if (formalParam === undefined) {
            let scopeStackLength = env._scopeStack.length;
            let ret = await logo.interpreter.evxInstrList(bodyComp, slot, pushCallStack);
            env._scopeStack.splice(scopeStackLength);

            return ret;
        }

        return await logo.interpreter.evxInstrListWithFormalParam(
            logo.type.listButFirst(bodyComp), formalParam, slot);
    }
    env.applyInstrList = applyInstrList;

    function getInstrListFormalParam(template) {
        let firstItem = logo.type.listFirst(template);
        if (!logo.type.isLogoList(firstItem)) {
            return undefined;
        }

        return logo.type.unbox(firstItem);
    }

    async function applyNamedProcedure(template, srcmap, slot = {}, inputListSrcmap) {
        if (!isProc(template)) {
            throw logo.type.LogoException.UNKNOWN_PROC.withParam([template], srcmap);
        }

        let parsedFormal = getProcParsedFormal(template);
        checkSlotLength(template, slot.param, inputListSrcmap, parsedFormal.minInputCount, parsedFormal.maxInputCount);

        if (!isPrimitive(template)) {
            prepareCallProc(logo.type.LAMBDA_EXPR, srcmap, slot);
        }

        slot.param.splice(0, 0, template, srcmap);
        let retVal = await logo.env.callProcAsync.apply(undefined, slot.param);

        if (!isPrimitive(template)) {
            completeCallProc(logo.type.LAMBDA_EXPR);
        }

        return retVal;
    }
    env.applyNamedProcedure = applyNamedProcedure;

    async function applyProcText(template, srcmap, slot = {}, inputListSrcmap) {
        let formal = logo.type.formalFromProcText(template);
        checkSlotLength(logo.type.LAMBDA_EXPR, slot.param, inputListSrcmap, formal.length);
        prepareCallProc(logo.type.LAMBDA_EXPR, srcmap, slot);

        let proc = makeProcMetadata(formal,
            logo.type.formalSrcmapFromProcText(template),
            logo.type.bodyFromProcText(template),
            logo.type.bodySrcmapFromProcText(template));

        let retVal = getGenJs() ? await callLogoProcTextAsync(template, slot.param) :
            await logo.interpreter.evxProc(proc, slot.param);

        completeCallProc(logo.type.LAMBDA_EXPR);
        return retVal;
    }
    env.applyProcText = applyProcText;

    async function callLogoProcTextAsync(template, param) {
        justInTimeTranspileProcText(template);
        return await env._userBlock.get(template).apply(undefined, param);
    }

    function checkSlotLength(template, slot, srcmap, length, maxLength) {
        if (slot.length < length) {
            throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([template], srcmap);
        }

        if (maxLength !== -1 && (slot.length > length || (maxLength !== undefined && slot.length > maxLength))) {
            throw logo.type.LogoException.TOO_MANY_INPUTS.withParam([template], srcmap);
        }
    }
    env.checkSlotLength = checkSlotLength;

    async function loadLogoModules(modules) {
        for (let mod of modules) {
            logo.io.stdout("LOAD \"" + mod);
            await logo.entry.exec(logo.logofs.get(mod));
        }
    }

    async function loadDefaultLogoModules() {
        for (let configKey in defaultModules) {
            if (logo.config.get(configKey)) {
                loadLogoModules(defaultModules[configKey]);
            }
        }
    }
    env.loadDefaultLogoModules = loadDefaultLogoModules;

    function makeSlotObj(param, index, rest) {
        return {
            "param": param,
            "rest": rest,
            "index": index
        };
    }
    env.makeSlotObj = makeSlotObj;

    function getProcParsedFormal(procName) {
        let procMetaData = _procMetadata[procName];
        if (!("parsedFormal" in procMetaData)) {
            procMetaData.parsedFormal = parseFormalParams(procMetaData.formal, procMetaData.formalSrcmap);
        }

        return procMetaData.parsedFormal;
    }
    env.getProcParsedFormal = getProcParsedFormal;

    function getProcAttribute(procName) {
        return procName in _procMetadata ? _procMetadata[procName].attributes : PROC_ATTRIBUTE.EMPTY;
    }

    function procReturnsInLambda(procName) {
        return getProcAttribute(procName) & PROC_ATTRIBUTE.RETURNS_IN_LAMBDA;
    }
    env.procReturnsInLambda = procReturnsInLambda;

    function requiresStashLocalVar(procName) {
        return getProcAttribute(procName) & PROC_ATTRIBUTE.STASH_LOCAL_VAR;
    }
    env.requiresStashLocalVar = requiresStashLocalVar;

    function isPrimitive(procName) {
        return getProcAttribute(procName) & PROC_ATTRIBUTE.PRIMITIVE;
    }
    env.isPrimitive = isPrimitive;

    function isProc(procName) {
        return procName in _procMetadata;
    }
    env.isProc = isProc;

    function isProcBodyDefined(procName) {
        return isProc(procName) && _procMetadata[procName].body !== undefined;
    }
    env.isProcBodyDefined = isProcBodyDefined;

    function existsProcJsFunc(procName) {
        return procName in _procJsFunc;
    }
    env.existsProcJsFunc = existsProcJsFunc;

    function getProcJsFunc(procName) {
        return _procJsFunc[procName];
    }

    function getProcMetadata(procName) {
        return _procMetadata[procName];
    }
    env.getProcMetadata = getProcMetadata;

    function bindPrimitive(primitiveName, primitiveJsFunc, formal = undefined, attributes = PROC_ATTRIBUTE.PRIMITIVE, precedence = 0) {
        let parsedFormal = (formal !== undefined) ? parseFormalParams(formal) : makeDefaultFormal(primitiveJsFunc.length);
        _primitiveJsFunc[primitiveName] = primitiveJsFunc;
        _primitiveMetadata[primitiveName] = makePrimitiveMetadata(parsedFormal, attributes | PROC_ATTRIBUTE.PRIMITIVE, precedence);
    }
    env.bindPrimitive = bindPrimitive;

    function getPrimitive(primitiveName) {
        return _primitiveJsFunc[primitiveName];
    }
    env.getPrimitive = getPrimitive;

    function isAsyncProc(procName) {
        return existsProcJsFunc(procName) && getProcJsFunc(procName).constructor.name === "AsyncFunction";
    }
    env.isAsyncProc = isAsyncProc;

    function isMacro(procName) {
        return getProcAttribute(procName) & PROC_ATTRIBUTE.MACRO;
    }
    env.isMacro = isMacro;

    function bindJsProc(procName, proc) {
        _procJsFunc[procName] = proc;
    }
    env.bindJsProc = bindJsProc;

    function getCallTarget(procName) {
        return existsProcJsFunc(procName) ? getProcJsFunc(procName) : logo.interpreter.evxCallProcDefault;
    }
    env.getCallTarget = getCallTarget;

    function getPrecedence(procName) {
        return _procMetadata[procName].precedence;
    }
    env.getPrecedence = getPrecedence;

    function isCallableProc(procName) {
        return existsProcJsFunc(procName) || isProcBodyDefined(procName);
    }
    env.isCallableProc = isCallableProc;

    function logoVar(v, varname, srcmap) {
        if (v === undefined) {
            throw logo.type.LogoException.VAR_HAS_NO_VALUE.withParam([varname], srcmap);
        }

        return v;
    }
    env.logoVar = logoVar;

    return env;
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
