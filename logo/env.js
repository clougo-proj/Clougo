//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo runtime environment
// Runs in browser's Logo worker thread or Node's main thread

export default {
    "create": function(logo, sys, ext) {

        const DEFAULT_MODULE = "main";

        const CLASSNAME = logo.constants.CLASSNAME;

        const env = {};

        const LogoMode = {
            "BATCH": 0,
            "INTERACTIVE": 1
        };

        const mod = {
            "pclogo": [
                "/mod/pclogo/pclogo.lgo"
            ],
            "class": [
                "/mod/class/class.lgo"
            ]
        };

        const LOGO_EVENT = logo.constants.LOGO_EVENT;

        const LOGO_LIBRARY = logo.constants.LOGO_LIBRARY;

        const PROC_ATTRIBUTE = logo.constants.PROC_ATTRIBUTE;

        const PROC_PARAM = logo.constants.PROC_PARAM;

        const DEFAULT_PRECEDENCE = 0;

        const NULL_SRC_INDEX = 0;

        const UNDEFINED_PROC_DEFAULT_FORMAL = makeFormal(
            PROC_PARAM.DEFAULT, PROC_PARAM.DEFAULT_MIN,  PROC_PARAM.DEFAULT, PROC_PARAM.UNLIMITED, [], [], undefined);

        const SourceIndex = (function() {
            const self = {};
            let pathByIndex, indexByPath;

            self.reset = function() {
                pathByIndex = [];
                indexByPath = {};
            };

            self.getSrcIndex = function(path) {
                if (path === undefined) {
                    return NULL_SRC_INDEX;
                }

                if (Object.prototype.hasOwnProperty.call(indexByPath, path)) {
                    return indexByPath[path];
                }

                let idx = pathByIndex.length + 1;
                indexByPath[path] = idx;
                pathByIndex.push(path);
                return indexByPath[path];
            };

            self.getSrcPath = function(index) {
                if (index === NULL_SRC_INDEX) {
                    return undefined;
                }

                sys.assert(index < pathByIndex.length + 1);
                return pathByIndex[index - 1];
            };

            self.reset();
            return self;
        })();

        function moduleContext() {
            return _moduleContext[_module];
        }

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
        let _envState, _runTime, _userInput, _resolveUserInput;
        let _callStack, _frameProcName;
        let _genJs;
        let _procName, _procSrcmap;

        let _moduleContext, _moduleExport, _super, _subClass, _module;
        let _globalJsFunc, _globalMetadata;
        let _scopeStackModule, _userBlock, _userBlockCalled;

        let _abortExecution;
        let _curSlot;

        let $ret, $scopeCache; // eslint-disable-line no-unused-vars
        let $param = createParamScope(); // eslint-disable-line no-unused-vars

        let _primitiveJsFunc = {};
        let _primitiveMetadata = {};

        clearWorkspace();

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

        function setProcName(procName) {
            _procName = procName;
        }
        env.setProcName = setProcName;

        function getProcName() {
            return _procName;
        }
        env.getProcName = getProcName;

        function setProcSrcmap(procSrcmap) {
            _procSrcmap = procSrcmap;
        }
        env.setProcSrcmap = setProcSrcmap;

        function getProcSrcmap() {
            return _procSrcmap;
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

        function getModule() {
            return _module;
        }
        env.getModule = getModule;

        function setModule(module = DEFAULT_MODULE) {
            _module = module;
            if (!(_module in _moduleContext)) {
                _moduleContext[_module] = newModuleContext();
            }
        }
        env.setModule = setModule;

        function setIsa(isa, module = _module) {
            _super[module] = isa;
        }
        env.setIsa = setIsa;

        function getIsa(module = _module) {
            return Object.prototype.hasOwnProperty.call(_super, module) ? _super[module] : [];
        }
        env.getIsa = getIsa;

        function getSuperClassMethod(className, methodName) {
            for (let isaClass of getIsa(className)) {
                let procName = getClassMethod(isaClass, methodName);
                if (procName !== undefined) {
                    return procName;
                }
            }

            return undefined;
        }
        env.getSuperClassMethod = getSuperClassMethod;

        function getClassMethod(className, methodName) {
            let procName = className + "." + methodName;
            if (isProc(procName)) {
                return procName;
            }

            return getSuperClassMethod(className, methodName);
        }
        env.getClassMethod = getClassMethod;

        function isSubClassOf(subClass, superClass) {
            if (subClass === superClass) {
                return true;
            }

            if (!Object.prototype.hasOwnProperty.call(subClass, superClass)) {
                _subClass[superClass] = {};
            }

            if (Object.prototype.hasOwnProperty.call(_subClass[superClass], subClass)) {
                return _subClass[superClass][subClass];
            }

            for(let isaClass of getIsa(subClass)) {
                if (isSubClassOf(isaClass, superClass)) {
                    _subClass[superClass][subClass] = true;
                    return true;
                }
            }

            _subClass[superClass][subClass] = false;
            return false;
        }

        function isLogoClassObj(obj, className = undefined) {
            return typeof obj === "object" && obj !== null && !Array.isArray(obj) &&
                (Object.prototype.hasOwnProperty.call(obj, CLASSNAME) &&
                (className === undefined || isSubClassOf(obj[CLASSNAME], className)));
        }
        env.isLogoClassObj = isLogoClassObj;

        function canAccessProperties(obj) {
            return logo.type.isLogoPlist(obj) || isLogoClassObj(obj, _module);
        }
        env.canAccessProperties = canAccessProperties;

        function inDefaultModule() {
            return _module === DEFAULT_MODULE;
        }
        env.inDefaultModule = inDefaultModule;

        function existsModulePlist(plistName) {
            return plistName in moduleContext().modulePlist;
        }

        function setPlistPropertyValue(plistName, propName, val) {
            plistName = logo.type.wordLowerCase(plistName);
            if (!existsModulePlist(plistName)) {
                moduleContext().modulePlist[plistName] = logo.type.makePlist();
            }

            logo.type.plistSet(moduleContext().modulePlist[plistName], propName, val);
        }
        env.setPlistPropertyValue = setPlistPropertyValue;

        function getPlistPropertyValue(plistName, propName) {
            plistName = logo.type.wordLowerCase(plistName);
            return (existsModulePlist(plistName)) ? logo.type.plistGet(moduleContext().modulePlist[plistName], propName) : logo.type.EMPTY_LIST;
        }
        env.getPlistPropertyValue = getPlistPropertyValue;

        function unsetPlistPropertyValue(plistName, propName) {
            plistName = logo.type.wordLowerCase(plistName);
            if (existsModulePlist(plistName)) {
                logo.type.plistUnset(moduleContext().modulePlist[plistName], propName);
            }
        }
        env.unsetPlistPropertyValue = unsetPlistPropertyValue;

        function plistToList(plistName) {
            plistName = logo.type.wordLowerCase(plistName);
            return (existsModulePlist(plistName)) ? logo.type.plistToList(moduleContext().modulePlist[plistName]) : logo.type.EMPTY_LIST;
        }
        env.plistToList = plistToList;

        function getFrameProcName() {
            return _frameProcName;
        }
        env.getFrameProcName = getFrameProcName;

        function callProc(name, srcmap, ...args) {
            setProcName(name);
            setProcSrcmap(srcmap);
            return getCallTarget(name).apply(undefined, args);
        }
        env.callProc = callProc;

        async function callProcAsync(name, srcmap, ...args) {
            setProcName(name);
            setProcSrcmap(srcmap);
            let retVal = await getCallTarget(name).apply(undefined, args);

            if (isMacro(name)) {
                validateMacroOutput(retVal, name, srcmap);
                return await getPrimitive("run").apply(undefined, [retVal, true]);
            }

            return retVal;
        }
        env.callProcAsync = callProcAsync;

        async function callTemplate(template, macroExpand = false, allowRetVal = false) {
            let srcmap = getProcSrcmap();
            let ret = await applyInstrList(template, srcmap,
                !logo.type.inSameLine(srcmap, logo.type.getTemplateSrcmap(template)), {}, undefined, macroExpand, allowRetVal);

            if (!allowRetVal) {
                checkUnusedValue(ret, srcmap);
            }

            return ret;
        }
        env.callTemplate = callTemplate;

        function validateMacroOutput(val, name, srcmap) {
            if (!logo.type.isLogoList(val)) {
                completeCallProc();
                throwRuntimeLogoException(logo.type.LogoException.INVALID_MACRO_RETURN, srcmap, [val, name]);
            }
        }

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
            logo.type.throwIf(_curSlot === undefined || slotNum > _curSlot.param.length,
                logo.type.LogoException.INVALID_INPUT, slotNum);

            return _curSlot.param[slotNum - 1];
        }
        env.getSlotValue = getSlotValue;

        function getSlotIndex() {
            return _curSlot.index;
        }
        env.getSlotIndex = getSlotIndex;

        function getSlotRestValue(slotNum) {
            logo.type.throwIf(_curSlot === undefined || slotNum > _curSlot.rest.length,
                logo.type.LogoException.INVALID_INPUT, slotNum);

            return logo.type.makeLogoList(_curSlot.rest[slotNum - 1]);
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
            let bodyComp = splitBodyByLines(moduleContext().procMetadata[procName].body,  moduleContext().procMetadata[procName].bodySrcmap);
            let text = [logo.type.makeLogoList(moduleContext().procMetadata[procName].formal.slice(0))].concat(bodyComp.body);
            let textSrcmap = [logo.type.makeLogoList(moduleContext().procMetadata[procName].formalSrcmap.slice(0))].concat(bodyComp.bodySrcmap);

            return logo.type.embedSrcmap(logo.type.makeLogoList(text), logo.type.makeLogoList(textSrcmap));
        }
        env.getLogoProcText = getLogoProcText;

        function findLogoVarScope(varname, scopeCache) {
            if (moduleContext().scopeStack.length === 0) {
                return moduleContext().moduleScope;
            }

            let ptr = moduleContext().scopeStack.length - 1;

            if (typeof scopeCache == "object" && varname in scopeCache) {
                return scopeCache[varname];
            }

            while(!(varname in moduleContext().scopeStack[ptr]) && ptr != 0) {
                ptr--;
            }

            let scope = moduleContext().scopeStack[ptr];
            if (typeof scopeCache == "object") {
                scopeCache[varname] = scope;
            }

            return scope;
        }
        env.findLogoVarScope = findLogoVarScope;

        function getGlobalScope() {
            return moduleContext().moduleScope;
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

        function registerOnStdinCallback() {
            if ("io" in ext && "onstdin" in ext.io && typeof ext.io.onstdin == "function") {
                ext.io.onstdin(async function(userInputBody){ // logoUserInputListener
                    setUserInput(userInputBody.toString());

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
                            return;
                        }

                        let ret = await exec(userInput, logo.config.get("genCommand"));
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

            logo.lrt.util.getLibrary(LOGO_LIBRARY.GRAPHICS).reset();

            registerOnStdinCallback();
        }
        env.initLogoEnv = initLogoEnv;

        function newModuleContext() {
            let context = {};

            context.moduleScope = {};
            context.scopeStack = [context.moduleScope];

            context.procJsFunc = Object.create(_globalJsFunc);
            context.procMetadata = Object.create(_globalMetadata);

            context.modulePlist = {};

            return context;
        }

        function clearWorkspace() {

            _moduleContext = {};
            _moduleExport = {};
            _super = {};
            _subClass = {};
            _module = DEFAULT_MODULE;
            _globalJsFunc = Object.create(_primitiveJsFunc);
            _globalMetadata = Object.create(_primitiveMetadata);
            _moduleContext[_module] = newModuleContext();

            _callStack = [];
            _scopeStackModule = [];
            _frameProcName = undefined;
            _userInput = [];
            _resolveUserInput = undefined;

            _userBlock = new WeakMap();
            _userBlockCalled = new WeakMap();

            SourceIndex.reset();

            $ret = undefined; // eslint-disable-line no-unused-vars
        }
        env.clearWorkspace = clearWorkspace;

        function scopeStackPush(scope) {
            _scopeStackModule.push(_module);
            moduleContext().scopeStack.push(scope);
        }
        env.scopeStackPush = scopeStackPush;

        function scopeStackPop() {
            let module = _scopeStackModule.pop();
            return _moduleContext[module].scopeStack.pop();
        }
        env.scopeStackPop = scopeStackPop;

        function curScope() {
            return moduleContext().scopeStack[moduleContext().scopeStack.length - 1];
        }
        env.curScope = curScope;

        function resetInterpreterCallStack() {
            _callStack = [];
            _frameProcName = undefined;
            _curSlot = undefined;
        }
        env.resetInterpreterCallStack = resetInterpreterCallStack;

        function exportProcs(procs) {
            procs.forEach(proc => {
                if (!(_module in _moduleExport)) {
                    _moduleExport[_module] = {};
                }

                let globalProcName = _module + "." + proc;
                _moduleExport[_module][proc] = globalProcName;

                if (!Object.prototype.hasOwnProperty.call(moduleContext().procMetadata, proc)) {
                    throw logo.type.LogoException.UNKNOWN_PROC_MODULE.withParam([getProcName(), proc], getProcSrcmap());
                }

                _globalMetadata[globalProcName] = moduleContext().procMetadata[proc];
                if (Object.prototype.hasOwnProperty.call(moduleContext().procJsFunc, proc)) {
                    _globalJsFunc[globalProcName] = moduleContext().procJsFunc[proc];
                }
            });
        }
        env.exportProcs = exportProcs;

        function importProcs(moduleName, procs) {
            if (!(moduleName in _moduleExport)) {
                throw logo.type.LogoException.MODULE_HAS_NO_EXPORTS.withParam([moduleName, ""], getProcSrcmap());
            }

            if (procs.length === 0) {
                procs = Object.keys(_moduleExport[moduleName]);
            }

            procs.forEach(proc => {
                if (!(proc in _moduleExport[moduleName])) {
                    throw logo.type.LogoException.MODULE_HAS_NO_EXPORTS.withParam([moduleName, proc], getProcSrcmap());
                }

                let globalProcName = _moduleExport[moduleName][proc];
                moduleContext().procMetadata[proc] = _globalMetadata[globalProcName];
                if (_globalJsFunc[globalProcName] !== undefined) {
                    moduleContext().procJsFunc[proc] = _globalJsFunc[globalProcName];
                }
            });
        }
        env.importProcs = importProcs;

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
            return _userBlock.get(block)();
        }

        function prepareCallProc(curToken, curSrcmap, curSlot = _curSlot) {
            _callStack.push([_frameProcName, curSrcmap, _curSlot, _module]);
            let metadata = getProcMetadata(curToken);
            if (metadata !== undefined) {
                _module = getProcMetadata(curToken).module;
            }

            _frameProcName = curToken;
            _curSlot = curSlot;
        }
        env.prepareCallProc = prepareCallProc;

        function completeCallProc() {
            let callStackPop = _callStack.pop();
            _module = callStackPop[3];
            _frameProcName = callStackPop[0];
            _curSlot = callStackPop[2];
        }
        env.completeCallProc = completeCallProc;

        async function callLogoInstrListAsync(block, param) {
            justInTimeTranspileInstrList(block);
            return await _userBlock.get(block).apply(undefined, param);
        }
        env.callLogoInstrListAsync = callLogoInstrListAsync;

        function defineLogoProc(procName, formal, body, formalSrcmap = logo.type.SRCMAP_NULL,
            bodySrcmap = logo.type.SRCMAP_NULL, attributes = PROC_ATTRIBUTE.EMPTY) {

            defineLogoProcCode(procName, formal, body, formalSrcmap, bodySrcmap, attributes);

            if (getGenJs() || existsProcJsFunc(procName)) {
                defineLogoProcJs(procName, formal, body, formalSrcmap, bodySrcmap);
            }

            return false;
        }
        env.defineLogoProc = defineLogoProc;

        function defineLogoProcSignatureAtParse(procName, formal, formalSrcmap = logo.type.SRCMAP_NULL, attributes = PROC_ATTRIBUTE.EMPTY) {
            moduleContext().procMetadata[procName] = makeProcMetadata(formal, formalSrcmap, undefined, undefined, attributes);
        }
        env.defineLogoProcSignatureAtParse = defineLogoProcSignatureAtParse;

        function defineLogoProcCode(procName, formal, body, formalSrcmap, bodySrcmap, attributes) {
            moduleContext().procMetadata[procName] = makeProcMetadata(formal, formalSrcmap, body, bodySrcmap, attributes);
        }

        function defineLogoProcBody(proc, srcmap) {
            let procName = logo.type.getLogoProcName(proc);
            let formal = logo.type.getLogoProcParams(proc);
            let body = logo.type.getLogoProcBody(proc);
            let attributes = logo.type.getLogoProcAttributes(proc);

            if (existsProcJsFunc(procName)) {
                delete moduleContext().procJsFunc[procName];
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
                "module" : _module,
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

        function makeFixedLengthPrimitiveFormal(length) {
            return makeFormal(length, length, length, length, [], [], undefined);
        }

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
                    maxInputCount = PROC_PARAM.UNLIMITED;
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
            if (!_userBlock.has(block)) {
                let blockComp = logo.parse.parseBlock(block);
                let formalParam = getInstrListFormalParam(blockComp);
                if (formalParam === undefined) {
                    let evxContext = logo.interpreter.makeEvalContext(blockComp);
                    _userBlock.set(block, eval(logo.codegen.genInstrListLambdaDeclCode(evxContext)));
                } else {
                    let evxContext = logo.interpreter.makeEvalContext(logo.type.listButFirst(blockComp));
                    _userBlock.set(block, eval(logo.codegen.genInstrListLambdaDeclCode(evxContext, formalParam)));
                }
            }
        }

        function justInTimeTranspileProcText(template) {
            if (!_userBlock.has(template)) {
                _userBlock.set(template, eval(logo.codegen.genProcText(template).merge()));
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
            return (/^\s*\(?\s*(load|module|endmodule|class|endclass|export|import)\b/i).test(logosrc);
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

        async function exec(logoSrc, genjs, srcPath) {
            let srcidx = SourceIndex.getSrcIndex(srcPath);
            snapshot();
            return await timedExec(
                async function() {
                    let ret;
                    let srcSegments = splitEagerEvalCode(logoSrc);
                    _abortExecution = false;
                    while (!_abortExecution && srcSegments.length > 0) {
                        let srcSegment = srcSegments.shift();
                        ret = await logoExecHelper(srcSegment.LOGO_SRC, genjs, srcidx, srcSegment.LINE_NUM);
                    }

                    return ret;
                }
            );
        }
        env.exec = exec;

        async function execByLine(logoSrc, genjs, srcPath) {
            let srcidx = SourceIndex.getSrcIndex(srcPath);
            return await timedExec(
                async function() {
                    let ret;
                    let src = logoSrc.split(/\n/);
                    for (let i = 0; i < src.length; i++) {
                        let line = src[i];
                        if (isInterpretedCommand(line)) {
                            ret = await logoExecHelper(line.substring(2), false, srcidx, i);
                        } else if (isTurtleCanvasMouseEvent(line)) {
                            await logo.lrt.util.getLibrary(LOGO_LIBRARY.GRAPHICS).onMouseEvent(mockMouseEventFromLine(line));
                        } else if (isTurtleCanvasKeyboardEvent(line)) {
                            await logo.lrt.util.getLibrary(LOGO_LIBRARY.GRAPHICS).onKeyboardEvent(mockKeyboardEventFromLine(line));
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

        function mockMouseEventFromLine(line) {
            const eventStart = 2;
            return line.trim().split(" ").slice(eventStart).map(sys.toNumberIfApplicable);
        }

        function isTurtleCanvasKeyboardEvent(line) {
            const pattern = ";turtle keyboard ";
            return line.length > pattern.length && line.substring(0, pattern.length) == pattern;
        }

        function mockKeyboardEventFromLine(line) {
            const eventStart = 2;
            let tokens = line.trim().split(" ").slice(eventStart);
            return [tokens[0], {"key": tokens[1], "code": tokens[2]}];
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
                _callStack.push([_frameProcName, e.getSrcmap()]);
            }

            let stackDump = stackToDump(_callStack.slice(0).reverse());
            if (stackDump) {
                logo.io.stderr(stackDump);
            }
        }
        env.errorOnLogoException = errorOnLogoException;

        async function catchLogoException(f) {
            try {
                await f();
            } catch (e) {
                if (!logo.type.LogoException.is(e)) {
                    throw e;
                } else {
                    errorOnLogoException(e, false);
                    _abortExecution = true;
                }
            }
        }
        env.catchLogoException = catchLogoException;

        async function resetCallStackAfterExecute(f) {
            let callStackLength = _callStack.length;
            let frameProcName = _frameProcName;
            let curSlot = _curSlot;

            let retVal = await f();

            _callStack.splice(callStackLength);
            _frameProcName = frameProcName;
            _curSlot = curSlot;

            return retVal;
        }
        env.resetCallStackAfterExecute = resetCallStackAfterExecute;

        async function resetScopeStackAfterExecute(f) {
            let scopeStackLength = moduleContext().scopeStack.length;
            let retVal = await f();
            moduleContext().scopeStack.splice(scopeStackLength);
            return retVal;
        }
        env.resetScopeStackAfterExecute = resetScopeStackAfterExecute;

        async function evalLogo(parsedCommand) {
            await resetScopeStackAfterExecute(async () => {
                if (!sys.isUndefined(parsedCommand)) {
                    await catchLogoException(async () => await logo.interpreter.evxBody(logo.parse.parseBlock(parsedCommand)));
                }
            });
        }
        env.evalLogo = evalLogo;

        function stackToDump(stack) {
            return sys.isUndefined(stack) ? "" : stack.map(stackFrameToString)
                .filter(v => v !== "")
                .join(logo.type.NEWLINE);
        }

        function isNullSrcpath(srcmap) {
            return logo.type.srcmapToSrcidx(srcmap) === NULL_SRC_INDEX;
        }

        function srcmapToString(srcmap) {
            return logo.type.srcmapToLineRow(srcmap) + "\t" + SourceIndex.getSrcPath(logo.type.srcmapToSrcidx(srcmap));
        }

        function stackFrameToString(frame) {
            let procName = frame[0];
            let srcmap = frame[1];
            return logo.type.isNullSrcmap(srcmap) || isNullSrcpath(srcmap) ? "" :
                typeof procName !== "undefined" ?
                    "    " + procName + " at " + srcmapToString(srcmap) :
                    "    at " + srcmapToString(srcmap);
        }

        async function evalLogoJs(logoJsSrc) {
            await resetScopeStackAfterExecute(async () => {
                await catchLogoException(async () => {
                    $ret = undefined; // eslint-disable-line no-unused-vars
                    eval(logoJsSrc);
                    await moduleContext().procJsFunc.$();
                });
            });
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

        async function applyInstrList(template, srcmap, pushCallStack = true, slot = {}, inputListSrcmap = undefined, macroExpand = false,
            allowRetVal = false) {

            let formalParam = getInstrListFormalParam(template);

            if (formalParam !== undefined) {
                checkSlotLength(logo.type.LAMBDA_EXPR, slot.param, inputListSrcmap, formalParam.length);
            }

            if (getGenJs() && !macroExpand && (_userBlockCalled.has(template) || logo.config.get("eagerJitInstrList"))) {
                return await resetScopeStackAfterExecute(async () => {
                    if (pushCallStack) {
                        prepareCallProc(logo.type.LAMBDA_EXPR, srcmap, slot);
                    }

                    let retVal = await callLogoInstrListAsync(template, slot.param);

                    if (pushCallStack) {
                        completeCallProc();
                    }

                    return retVal;
                });
            }

            _userBlockCalled.set(template, true);
            let bodyComp = logo.type.embedReferenceSrcmap(template, srcmap);
            if (formalParam === undefined) {
                return await resetScopeStackAfterExecute(async () =>
                    await logo.interpreter.evxInstrList(bodyComp, slot, pushCallStack, allowRetVal, macroExpand)
                );
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
                prepareCallProc(template, srcmap, slot);
            }

            slot.param.splice(0, 0, template, srcmap);
            let retVal = await callProcAsync.apply(undefined, slot.param);

            if (!isPrimitive(template)) {
                completeCallProc();
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

            completeCallProc();
            return retVal;
        }
        env.applyProcText = applyProcText;

        async function callLogoProcTextAsync(template, param) {
            justInTimeTranspileProcText(template);
            return await _userBlock.get(template).apply(undefined, param);
        }

        function checkSlotLength(template, slot, srcmap, length, maxLength) {
            if (slot.length < length) {
                throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([template], srcmap);
            }

            if (maxLength !== PROC_PARAM.UNLIMITED && (slot.length > length || (maxLength !== undefined && slot.length > maxLength))) {
                throw logo.type.LogoException.TOO_MANY_INPUTS.withParam([template], srcmap);
            }
        }
        env.checkSlotLength = checkSlotLength;

        async function loadLogoModules(modules) {
            for (let mod of modules) {
                logo.io.stderr("LOAD \"" + mod);
                await logo.entry.exec(await logo.logofs.readFile(mod), mod);
            }
        }

        async function loadDefaultLogoModules() {
            for (let configKey in mod) {
                if (logo.config.get(configKey)) {
                    await loadLogoModules(mod[configKey]);
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
            if (!isProc(procName)) {
                return UNDEFINED_PROC_DEFAULT_FORMAL;
            }

            let procMetadata = moduleContext().procMetadata[procName];
            if (!("parsedFormal" in procMetadata)) {
                procMetadata.parsedFormal = parseFormalParams(procMetadata.formal, procMetadata.formalSrcmap);
            }

            return procMetadata.parsedFormal;
        }
        env.getProcParsedFormal = getProcParsedFormal;

        function getProcAttribute(procName) {
            return isProc(procName) ? moduleContext().procMetadata[procName].attributes : PROC_ATTRIBUTE.EMPTY;
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
            return procName in moduleContext().procMetadata;
        }
        env.isProc = isProc;

        function isProcBodyDefined(procName) {
            return isProc(procName) && moduleContext().procMetadata[procName].body !== undefined;
        }
        env.isProcBodyDefined = isProcBodyDefined;

        function existsProcJsFunc(procName) {
            return procName in moduleContext().procJsFunc;
        }
        env.existsProcJsFunc = existsProcJsFunc;

        function getProcJsFunc(procName) {
            return moduleContext().procJsFunc[procName];
        }

        function getProcMetadata(procName) {
            return moduleContext().procMetadata[procName];
        }
        env.getProcMetadata = getProcMetadata;

        function getClassDefaultExportedProcs(module = _module) {
            return Object.keys( _moduleContext[module].procMetadata)
                .filter(procName => !procName.match(/^_/));
        }
        env.getClassDefaultExportedProcs = getClassDefaultExportedProcs;

        function bindPrimitive(primitiveName, primitiveJsFunc, formal = undefined, attributes = PROC_ATTRIBUTE.PRIMITIVE, precedence = 0) {
            let parsedFormal = (formal !== undefined) ? parseFormalParams(formal) : makeFixedLengthPrimitiveFormal(primitiveJsFunc.length);
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
            return !!(getProcAttribute(procName) & PROC_ATTRIBUTE.MACRO);
        }
        env.isMacro = isMacro;

        function bindJsProc(procName, proc) {
            moduleContext().procJsFunc[procName] = proc;
        }
        env.bindJsProc = bindJsProc;

        function getCallTarget(procName) {
            return existsProcJsFunc(procName) ? getProcJsFunc(procName) : logo.interpreter.evxCallProcDefault;
        }
        env.getCallTarget = getCallTarget;

        function getPrecedence(procName) {
            return isProc(procName) ? moduleContext().procMetadata[procName].precedence : DEFAULT_PRECEDENCE;
        }
        env.getPrecedence = getPrecedence;

        function isCallableProc(procName) {
            return existsProcJsFunc(procName) || (!getGenJs() && isProcBodyDefined(procName));
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
    }
};
