//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Transpiles parsed Logo code into JavaScript
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

var $classObj = {};
$classObj.create = function(logo, sys) {

    const codegen = {};

    const CODEGEN_CONSTANTS = {
        NOP : "undefined;"
    };

    let _funcName = "";

    const _varScopes = (() => {
        let self = {};

        let localVarStack = [];
        let nonGlobalVar = {};

        function enter() {
            localVarStack.push({});
        }
        self.enter = enter;

        function exit() {
            localVarStack.pop();
        }
        self.exit = exit;

        function addVar(varName) {
            scope()[varName] = 1;
            nonGlobalVar[varName] = 1;
        }
        self.addVar = addVar;

        function isLocalVar(varName) {
            return varName in scope();
        }
        self.isLocalVar = isLocalVar;

        function isGlobalVar(varName) {
            return !(varName in nonGlobalVar);
        }
        self.isGlobalVar = isGlobalVar;

        function localVars() {
            return Object.keys(scope());
        }
        self.localVars = localVars;

        function scope() {
            return localVarStack[localVarStack.length - 1];
        }

        return self;
    })();

    const genNativeJs = {
        // token: [func, output, noOperator, noSemicolon]
        "if": [genIf, false, true, true],
        "catch": [genCatch, false, true, true],
        "ifelse": [genIfElse, false, true, true],
        "make": [genMake],
        "localmake": [genLocalmake],
        "local": [genLocal],
        "repeat": [genRepeat, false, true, true],
        "for": [genFor, false, true, true],
        "pi": [genPi, true],
    };

    function getGenNativeJsOutput(name) {
        return (name in genNativeJs) && genNativeJs[name][1];
    }

    function getGenNativeJsNoOperator(name) {
        return (name in genNativeJs) && genNativeJs[name][2];
    }

    function getGenNativeJsNoSemicolon(name) {
        return (name in genNativeJs) && genNativeJs[name][3];
    }

    function genPi() {
        return ["Math.PI"];
    }

    function genLocal(evxContext, isInParen = false) {

        let code = [];

        code.push("let ");

        let expectedParams = 1;
        let generatedParams = 0;
        let varName;

        while ((generatedParams < expectedParams || isInParen) && evxContext.peekNextToken() != ")" && evxContext.next()) {
            varName = evxContext.getToken();

            if (generatedParams > 0) {
                code.push(",");
            }

            sys.assert(logo.type.isQuotedLogoWord(varName));  // TODO: throw Logo exception
            varName = logo.type.unquoteLogoWord(varName).toLowerCase();
            _varScopes.addVar(varName);
            code.push(varName);

            generatedParams++;
        }

        code.push(";");
        sys.trace("VARNAME=" + varName, "codegen.genLocal");

        return code;
    }

    function genInstrList(evxContext, primitiveName, generateCheckUnactionableDatum = true) {
        let code = [];

        let curToken = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();

        if (evxContext.isTokenEndOfStatement(curToken)) {
            code.push("throwRuntimeLogoException('NOT_ENOUGH_INPUTS',",
                logo.type.srcmapToJs(srcmap), ",[\"", primitiveName, "\"])");
        } else if (logo.type.isLogoList(curToken)) {
            let comp = logo.parse.parseBlock(logo.type.embedSrcmap(curToken, srcmap));
            code.push(genBody(logo.interpreter.makeEvalContext(comp), true));
        } else {
            code.push(genInstrListCall(curToken, srcmap));
        }

        if (generateCheckUnactionableDatum && sys.Config.get("unactionableDatum")) {
            code.push(";checkUnactionableDatum($ret,", logo.type.srcmapToJs(srcmap), ");\n");
        }

        return code;
    }

    function genIf(evxContext) {
        let code = [];

        code.push("if (logo.type.isNotLogoFalse(");
        evxContext.next();
        code.push(genToken(evxContext,0));
        code.push(")) {\n");

        evxContext.next();
        code.push(genInstrList(evxContext, "if"));
        code.push("}");

        if (evxContext.peekNextToken() === "else") {
            evxContext.next();
            evxContext.next();
            code.push(" else {");
            code.push(genInstrList(evxContext, "if"));
            code.push("}");
        }

        code.push("\n;$ret=undefined;");

        return code;
    }

    function genCatch(evxContext) {
        let code = [];

        evxContext.next();

        let label = genToken(evxContext, 0);
        if (logo.env.getAsyncFunctionCall()) {
            code.push("($ret=await (async function() {");
        } else {
            code.push("($ret=(() => {");
        }

        code.push("try {\n");
        evxContext.next();

        code.push(genInstrList(evxContext, "catch", false));
        code.push("} catch (e) {\n");

        code.push("if (e.isCustom()) {\n");
        code.push("if (sys.equalToken(");
        code.push(label);
        code.push(", e.getValue()[0])) {return e.getValue()[1];}");
        code.push("throw e;}\n");

        code.push("if (!logo.type.LogoException.is(e) || (e.isError() && !sys.equalToken(");
        code.push(label);
        code.push(", 'error'))) {\n");
        code.push("throw e;\n");

        code.push("}}})(),$ret)\nif($ret !== undefined) return $ret\n");

        return code;
    }

    function genIfElse(evxContext) {
        let code = [];

        code.push("if (logo.type.isNotLogoFalse(");
        evxContext.next();
        code.push(genToken(evxContext,0));
        code.push(")) {\n");

        evxContext.next();
        code.push(genInstrList(evxContext, "ifelse"));

        code.push("} else {\n");
        evxContext.next();
        code.push(genInstrList(evxContext, "ifelse"));

        code.push("}");
        code.push("\n;$ret=undefined;");

        return code;
    }

    function genRepeat(evxContext) {
        let code = [];

        evxContext.next();
        code.push("for (let ");

        let repeatCount = genToken(evxContext, 0);
        let repeatVarName = "$i";

        code.push(repeatVarName, "=0;", repeatVarName, "<", repeatCount, ";", repeatVarName, "++) {\n");
        evxContext.next();
        code.push(genInstrList(evxContext, "repeat"));

        code.push("}");
        code.push("\n;$ret=undefined;");

        return code;
    }

    function genFor(evxContext) {
        let code = [];

        evxContext.next();

        let token = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();

        token = token.map(sys.toNumberIfApplicable);

        let comp = logo.parse.parseBlock(logo.type.embedSrcmap(token, srcmap));
        let forLoopCtrl = logo.interpreter.makeEvalContext(comp);
        let forVarName = genLogoVarLref(forLoopCtrl.getToken());

        forLoopCtrl.next();

        let forBegin = genToken(forLoopCtrl, 0);
        code.push("{const $forBegin = ", forBegin, ";\n");

        forLoopCtrl.next();

        let forEnd = genToken(forLoopCtrl, 0);
        code.push("const $forEnd = ", forEnd, ";\n");
        code.push("const $forDecrease = $forEnd < $forBegin;\n");

        let forStep = forLoopCtrl.next() ? genToken(forLoopCtrl, 0) : "$forDecrease ? -1 : 1";
        code.push("const $forStep = ", forStep, ";\n");

        code.push("if ((!$forDecrease && $forStep > 0) || ($forDecrease && $forStep < 0))\n");
        code.push("for(", forVarName, "=$forBegin; ($forDecrease && ", forVarName, ">=$forEnd) || (!$forDecrease &&", forVarName, "<=$forEnd); ", forVarName, "+=$forStep) {\n");

        evxContext.next();
        code.push(genInstrList(evxContext, "for"));

        code.push("}}");
        code.push("\n;$ret=undefined;");

        return code;
    }

    function genMake(evxContext) {
        let code = [];

        evxContext.next();

        let varName = logo.env.extractVarName(evxContext.getToken());

        Array.prototype.push.apply(code, genLogoVarLref(varName));

        evxContext.next();
        code.push("=");
        code.push(genToken(evxContext,0));
        code.push(";$ret=undefined;");
        return code;
    }

    function genLocalmake(evxContext) {
        let code = [];

        evxContext.next();

        let varName = logo.env.extractVarName(evxContext.getToken());
        _varScopes.addVar(varName);
        code.push("let ");

        Array.prototype.push.apply(code, genLogoVarLref(varName));

        evxContext.next();
        code.push("=");
        code.push(genToken(evxContext,0));
        code.push(";$ret=undefined");
        return code;
    }

    function genLogoVarRef(curToken, srcmap) {
        let varName = logo.env.extractVarName(curToken);
        return _varScopes.isLocalVar(varName) ?  ["logo.lrt.util.logoVar(", varName, ", \"", varName, "\",", logo.type.srcmapToJs(srcmap), ")"] :
            ["logo.lrt.util.logoVar(logo.env.findLogoVarScope(\"", varName, "\", $scopeCache)[\"", varName, "\"", "], \"", varName, "\",", logo.type.srcmapToJs(srcmap), ")"];
    }

    function genLogoVarLref(varName) {
        return _varScopes.isLocalVar(varName) ? [varName] :
            ["logo.env.findLogoVarScope('" + varName + "', $scopeCache)['" + varName + "']"];
    }

    function genLogoSlotRef(curToken, srcmap) {
        let slotNum = logo.env.extractSlotNum(curToken);
        return ["logo.env.callPrimitive(\"?\",", logo.type.srcmapToJs(srcmap), ",", slotNum, ")"];
    }

    function genInstrListCall(curToken, srcmap) {
        let code = [];

        code.push("(");
        code.push(genPrepareCall("[]", srcmap));
        code.push("$ret);\n");

        code.push("$ret=");
        code.push(logo.env.getAsyncFunctionCall() ? "await callLogoInstrListAsync(" : "callLogoInstrList(");
        code.push(genLogoVarRef(curToken, srcmap));
        code.push(");");

        code.push("(");
        code.push(genCompleteCall());
        code.push("$ret);\n");

        return code;
    }

    function insertDelimiters(param, delimiter) {
        let ret = param.map(v => [v, delimiter]).reduce((accumulator, currentValue) =>
            accumulator.concat(currentValue), []);
        ret.pop();
        return ret;
    }

    function genProcCallParam(evxContext, paramListLength, precedence) {
        let param = [];
        for (let j = 0; j < paramListLength; j++) { // push actual parameters
            evxContext.next();
            param.push(genToken(evxContext, precedence));
        }

        return insertDelimiters(param, ",");
    }

    function genPrimitiveCallParam(evxContext, primitiveName, precedence = 0, isInParen = false) {
        let param = [];
        let paramListLength = logo.lrt.util.getPrimitiveParamCount(primitiveName);
        let paramListMinLength = logo.lrt.util.getPrimitiveParamMinCount(primitiveName);
        let paramListMaxLength = logo.lrt.util.getPrimitiveParamMaxCount(primitiveName);
        let j = 0;

        if (isInParen && (paramListMaxLength > paramListLength || paramListMaxLength==-1)) {
            for (; (j < paramListMaxLength || paramListMaxLength == -1) &&
                    (isInParen && evxContext.peekNextToken() != ")" ) && evxContext.next(); j++) {
                param.push(genToken(evxContext));
            }
        } else {
            for (; j < paramListLength && ((isInParen && evxContext.peekNextToken() != ")" ) || !isInParen) ; j++) { // push actual parameters
                evxContext.next();
                let generatedParam = genToken(evxContext, precedence, false, true, isInParen, true);
                if (generatedParam == CODEGEN_CONSTANTS.NOP) {
                    generatedParam = ["throwRuntimeLogoException('NOT_ENOUGH_INPUTS',",
                        logo.type.srcmapToJs(evxContext.getSrcmap()), ",[ \"" + primitiveName + "\"])"];
                }

                param.push(generatedParam);
            }
        }

        if (j < paramListMinLength) {
            param.push(["throwRuntimeLogoException('NOT_ENOUGH_INPUTS',", logo.type.srcmapToJs(evxContext.getSrcmap()),
                ",[ \"" + primitiveName + "\"])"]);
        }

        return insertDelimiters(param, ",");
    }

    function genArray(obj) {
        sys.assert(logo.type.isLogoArray(obj));
        return JSON.stringify(obj.map(sys.toNumberIfApplicable));
    }

    function genLogoList(obj, srcmap) {
        sys.assert(logo.type.isLogoList(obj));
        let comp = logo.type.embedSrcmap(obj, srcmap);
        return JSON.stringify(comp.map(sys.toNumberIfApplicable));
    }

    function genToken(evxContext, precedence = 0, isStatement = false, markRetExpr = false, isInParen = false,
        stopAtLineEnd = false) {

        let code = [];
        let curToken = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();

        while ((!stopAtLineEnd && curToken === "\n") && !sys.isUndefined(curToken) && evxContext.next()) {
            curToken = evxContext.getToken();
        }

        if (sys.isUndefined(curToken) || curToken === "\n") {
            return CODEGEN_CONSTANTS.NOP; //"undefined;"; // add undefined to make sure eval() returns undefined
        }

        srcmap = evxContext.getSrcmap();

        let noOperator = false;
        let noSemicolon = false;

        let tmp = NaN;
        if (typeof curToken !== "object" && !isNaN(tmp = Number(curToken))) {
            if (markRetExpr) {
                code.push("$ret=");
            }

            code.push(tmp);
            evxContext.retExpr = markRetExpr;
        } else if (sys.equalToken(curToken, "stop")) {
            code.push("return");
        } else if (sys.equalToken(curToken, "output") || sys.equalToken(curToken, "op")) {
            evxContext.next();
            code.push(genToken(evxContext, 0, false, true));
            code.push(";return $ret");
        } else if (curToken == "(") {
            code.push(genParen(evxContext, evxContext.peekNextToken() == "local", true));
            evxContext.retExpr = markRetExpr;
        } else if (typeof curToken == "object") {
            if (markRetExpr && !logo.type.isLogoProc(curToken)) {
                code.push("$ret=");
            }

            code.push(logo.type.isLogoProc(curToken) ? genProc(curToken, srcmap) :
                logo.type.isLogoArray(curToken) ?  genArray(curToken, srcmap) :
                    genLogoList(curToken, srcmap));

            evxContext.retExpr = markRetExpr;
        } else if (logo.type.isQuotedLogoWord(curToken)) {
            if (markRetExpr) {
                code.push("$ret=");
            }

            code.push(logo.type.quotedLogoWordToJsStringLiteral(curToken));
            evxContext.retExpr = markRetExpr;
        } else if (logo.type.isLogoVarRef(curToken)) {
            if (markRetExpr) {
                code.push("$ret=");
            }

            Array.prototype.push.apply(code, genLogoVarRef(curToken, srcmap));

            evxContext.retExpr = markRetExpr;
        } else if (logo.type.isLogoSlot(curToken)) {
            if (markRetExpr) {
                code.push("$ret=");
            }

            Array.prototype.push.apply(code, genLogoSlotRef(curToken, srcmap));

            evxContext.retExpr = markRetExpr;
        } else { // call
            if (markRetExpr && (!(curToken in genNativeJs) || getGenNativeJsOutput(curToken))) {
                code.push("$ret=");
            }

            if (curToken in genNativeJs) {
                code.push(genNativeJs[curToken][0](evxContext, isInParen));
                noOperator = getGenNativeJsNoOperator(curToken);
                noSemicolon = getGenNativeJsNoSemicolon(curToken);
                evxContext.retExpr = getGenNativeJsOutput(curToken);
            } else if (curToken in logo.lrt.primitive) {
                if (logo.env.getAsyncFunctionCall()) {
                    code.push("($ret=await logo.env.callPrimitiveAsync(\"");
                } else {
                    code.push("($ret=logo.env.callPrimitive(\"");
                }

                code.push(curToken, "\", ", logo.type.srcmapToJs(srcmap), ",",
                    genPrimitiveCallParam(evxContext, curToken, logo.lrt.util.getPrimitivePrecedence(curToken),
                        isInParen), "))");

                evxContext.retExpr = markRetExpr;
            } else if (curToken in logo.env._ws) {
                code.push("(");
                code.push(genPrepareCall(curToken, srcmap));

                if (logo.env.getAsyncFunctionCall()) {
                    code.push("$ret=(await logo.env._user[", "\"" +
                        curToken + "\"", "](");
                } else {
                    code.push("$ret=(logo.env._user[\"" + curToken +
                        "\"", "](");
                }

                code.push(genProcCallParam(evxContext, logo.env._ws[curToken].formal.length));
                code.push(")),");
                code.push(genCompleteCall());
                code.push("$ret)");
                evxContext.retExpr = markRetExpr;
            } else {
                code.push("throwRuntimeLogoException('UNKNOWN_PROC',", logo.type.srcmapToJs(srcmap), ",[\"" +
                    curToken + "\"])");

                evxContext.retExpr = markRetExpr;
            }
        }

        while (!noOperator && evxContext.isNextTokenBinaryOperator()) {
            let nextOp = evxContext.getNextOperator();
            let nextOpSrcmap = evxContext.getNextOperatorSrcmap();
            let nextPrec = logo.lrt.util.getBinaryOperatorPrecedence(nextOp);

            if (precedence >= nextPrec) {
                break;
            }

            evxContext.next();

            let callTarget = logo.lrt.util.getBinaryOperatorRuntimeFunc(nextOp);
            if (logo.env.getAsyncFunctionCall()) {
                code.splice(0, 0, "($ret=await logo.env.callPrimitiveOperatorAsync(\"", nextOp, "\",", logo.type.srcmapToJs(nextOpSrcmap), ",");
            } else {
                code.splice(0, 0, "($ret=logo.env.callPrimitiveOperator(\"", nextOp, "\",", logo.type.srcmapToJs(nextOpSrcmap), ",");
            }

            code.push(",");
            code.push(genProcCallParam(evxContext, callTarget.length - 1, nextPrec));
            code.push("))");

            evxContext.retExpr = markRetExpr;
        }

        if (isStatement && code.length > 0) {
            if (!noSemicolon) code.push(";");
            code.push("\n");
        }

        return code;
    }

    function genBody(evxContext, isStatement, isInstrList) {
        let code = [];

        do {
            code.push(genToken(evxContext, 0, isStatement, true));
            if (evxContext.retExpr && sys.Config.get("unactionableDatum") && (!isInstrList || evxContext.hasNext())) {
                code.push("checkUnactionableDatum($ret,", logo.type.srcmapToJs(evxContext.getSrcmap()), ");\n");
            }
        } while (evxContext.next());

        return code;
    }
    codegen.genBody = genBody;

    function genInstrListLambdaDeclCode(evxContext) {
        _varScopes.enter();
        let code = [];
        code.push(logo.env.getAsyncFunctionCall() ? "(async()=>{" : "(()=>{");
        code.push("let $scope = logo.env._scopeStack[logo.env._scopeStack.length - 1];\n");
        code.push(genBody(evxContext, true, true));

        code.push("(");
        code.push(genStashLocalVars());
        code.push("$ret);");

        code.push("return $ret;");

        code.push("})");
        _varScopes.exit();
        let mergedCode = mergeCode(code);
        sys.trace(mergedCode, "codegen.lambda");
        sys.Config.get("verbose");

        return mergedCode;
    }
    codegen.genInstrListLambdaDeclCode = genInstrListLambdaDeclCode;

    function genParen(evxContext, isStatement, markRetExpr) {
        let code = [];

        if (!isStatement) {
            code.push("(");
        }

        evxContext.next();

        let codeFromToken = genToken(evxContext, 0, isStatement, false, markRetExpr);
        code.push(codeFromToken);
        evxContext.next();

        if (evxContext.getToken() != ")") {
            code.push(
                "(throwRuntimeLogoException(",
                "\"TOO_MUCH_INSIDE_PAREN\",",
                logo.type.srcmapToJs(evxContext.getSrcmap()),
                "))");
        }

        if (!isStatement) {
            code.push(")");
        }

        return code;
    }

    function mergeCode(code) {
        return Array.isArray(code) ? code.map(mergeCode).join("") :
            typeof code !== "string" ? code.toString() : code;
    }

    function genTopLevelCode(p) {

        let oldFuncName = _funcName;
        _funcName = "";

        let evxContext = logo.interpreter.makeEvalContext(p);

        _varScopes.enter();
        let code = mergeCode(genBody(evxContext, true));
        _varScopes.exit();

        let ret = "$scopeCache={};" +
                "logo.env._user.$ = async function(){\n" +
                "let $scope={},$scopeCache={};\n" +
                "logo.env._scopeStack.push($scope);\n" +
                code + "logo.env._scopeStack.pop();}";

        _funcName = oldFuncName;
        return ret;
    }
    codegen.genTopLevelCode = genTopLevelCode;

    function genPrepareCall(target, srcmap) {
        let code = [];

        if (sys.Config.get("dynamicScope")) {
            code.push(genStashLocalVars());
        }

        code.push("logo.env._callstack.push([logo.env._curProc," + logo.type.srcmapToJs(srcmap) + "]),");
        code.push("logo.env._curProc=\"" + target + "\",\n");

        return code;
    }

    function genCompleteCall() {
        let code = [];
        code.push("logo.env._curProc=logo.env._callstack.pop()[0],");
        if (sys.Config.get("dynamicScope")) {
            code.push(genApplyLocalVars());
        }

        return code;
    }

    function genStashLocalVars() {
        let code = [];
        _varScopes.localVars().forEach((varName) =>
            code.push("($scope['", varName, "']=", varName, "),"));

        return code;
    }

    function genApplyLocalVars() {
        let code = [];
        _varScopes.localVars().forEach(varName =>
            code.push("(", varName, "=$scope['", varName, "']),"));

        return code;
    }

    function genProc(p, srcmap) {
        let code = logo.env.getAsyncFunctionCall() ? ["async function "] : ["function "];

        if(!logo.type.isLogoProc(p)) {
            return;
        }

        let oldFuncName = _funcName;
        _funcName = p[1];

        let evxContext = logo.interpreter.makeEvalContext(logo.type.embedSrcmap(p[3], srcmap[3]));
        code.push(_funcName, "(");

        let params = p[2];

        code.push(insertDelimiters(params, ",") );
        code.push(")");
        code.push("{\n");
        code.push("let $ret;\n");

        if (sys.Config.get("dynamicScope")) {
            code.push("let $scope = {}, $scopeCache = {};\n");
            code.push("logo.env._scopeStack.push($scope);\n");
        }

        _varScopes.enter();
        params.forEach(v => _varScopes.addVar(v));
        code.push(genBody(evxContext, true));
        _varScopes.exit();

        code.push("logo.env._scopeStack.pop();\n");
        code.push("}\n");

        code.splice(0, 0, "logo.env._user[\"" + _funcName + "\"]=");
        code.push("undefined;\n");

        _funcName = oldFuncName;
        return code;
    }

    return codegen;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
