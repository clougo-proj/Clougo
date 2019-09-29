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

    const genLambda = {
        "apply": 1
    };

    const CODE_TYPE = {
        EXPR: 0,
        STMT: 1
    };

    class Code {
        constructor(rawCodeArray = [], codeType = CODE_TYPE.EXPR) {
            this._code = rawCodeArray.slice(0);
            this._codeType = codeType;
        }

        append(...args) {
            Array.prototype.push.apply(this._code, args);
        }

        prepend(...args) {
            args.splice(0, 0, 0, 0);
            Array.prototype.splice.apply(this._code, args);
        }

        length() {
            return this._code.length;
        }

        merge() {
            return this._code.map((v) => (v instanceof Code) ? v.merge() :
                typeof v !== "string" ? JSON.stringify(v) : v).join("");
        }
    }

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
        return new Code(["Math.PI"]);
    }

    function genLocal(evxContext, isInParen = false) {

        let code = new Code([], CODE_TYPE.STMT);

        code.append("let ");

        let expectedParams = 1;
        let generatedParams = 0;
        let varName;

        while ((generatedParams < expectedParams || isInParen) && evxContext.peekNextToken() != ")" && evxContext.next()) {
            varName = evxContext.getToken();

            if (generatedParams > 0) {
                code.append(",");
            }

            sys.assert(logo.type.isQuotedLogoWord(varName));  // TODO: throw Logo exception
            varName = logo.type.unquoteLogoWord(varName).toLowerCase();
            _varScopes.addVar(varName);
            code.append(varName);

            generatedParams++;
        }

        code.append(";");
        sys.trace("VARNAME=" + varName, "codegen.genLocal");

        return code;
    }

    function genInstrList(evxContext, primitiveName, generateCheckUnactionableDatum = true) {
        let code = new Code([], CODE_TYPE.STMT);

        let curToken = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();

        if (evxContext.isTokenEndOfStatement(curToken)) {
            code.append("throwRuntimeLogoException('NOT_ENOUGH_INPUTS',",
                logo.type.srcmapToJs(srcmap), ",[\"", primitiveName, "\"])");
        } else if (logo.type.isLogoList(curToken)) {
            let comp = logo.parse.parseBlock(logo.type.embedSrcmap(curToken, srcmap));
            code.append(genBody(logo.interpreter.makeEvalContext(comp), true));
        } else {
            code.append(genInstrListCall(curToken, srcmap));
        }

        if (generateCheckUnactionableDatum && sys.Config.get("unactionableDatum")) {
            code.append(";checkUnactionableDatum($ret,", logo.type.srcmapToJs(srcmap), ");\n");
        }

        return code;
    }

    function genIf(evxContext) {
        let code = new Code([], CODE_TYPE.STMT);

        evxContext.next();
        code.append(genToken(evxContext));
        code.append(";\n");
        code.append("if (logo.type.isNotLogoFalse($ret)) {\n");

        evxContext.next();
        code.append(genInstrList(evxContext, "if"));
        code.append("}");

        if (evxContext.peekNextToken() === "else") {
            evxContext.next();
            evxContext.next();
            code.append(" else {");
            code.append(genInstrList(evxContext, "if"));
            code.append("}");
        }

        code.append("\n;$ret=undefined;");

        return code;
    }

    function genCatch(evxContext) {
        let code = new Code();

        evxContext.next();

        let label = genToken(evxContext);

        code.append("try {\n");
        evxContext.next();

        code.append(genInstrList(evxContext, "catch", false));
        code.append("} catch (e) {\n");

        code.append("if (e.isCustom()) {\n");
        code.append("if (sys.equalToken(");
        code.append(label);
        code.append(", e.getValue()[0])){$ret=e.getValue()[1];}\n");
        code.append("else { throw e;} }\n");

        code.append("else if (!logo.type.LogoException.is(e) || (e.isError() && !sys.equalToken(");
        code.append(label);
        code.append(", 'error'))) {\n");
        code.append("throw e;}else{$ret=undefined;}}\n");

        code.append("if($ret !== undefined) return $ret\n");

        return code;
    }

    function genIfElse(evxContext) {
        let code = new Code([], CODE_TYPE.STMT);

        evxContext.next();
        code.append(genToken(evxContext));
        code.append(";\n");
        code.append("if (logo.type.isNotLogoFalse($ret)) {\n");

        evxContext.next();
        code.append(genInstrList(evxContext, "ifelse"));

        code.append("} else {\n");
        evxContext.next();
        code.append(genInstrList(evxContext, "ifelse"));

        code.append("}");
        code.append("\n;$ret=undefined;");

        return code;
    }

    function genRepeat(evxContext) {
        let code = new Code([], CODE_TYPE.STMT);

        evxContext.next();

        let repeatVarName = "$i";

        code.append(genToken(evxContext));
        code.append(";const $repeatEnd=$ret;\n");
        code.append("for (let ");
        code.append(repeatVarName, "=0;", repeatVarName, "<$repeatEnd;", repeatVarName, "++) {\n");

        evxContext.next();
        code.append(genInstrList(evxContext, "repeat"));

        code.append("}");
        code.append("\n;$ret=undefined;");

        return code;
    }

    function genFor(evxContext) {
        let code = new Code([], CODE_TYPE.STMT);

        evxContext.next();

        let token = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();

        token = token.map(sys.toNumberIfApplicable);

        let comp = logo.parse.parseBlock(logo.type.embedSrcmap(token, srcmap));
        let forLoopCtrl = logo.interpreter.makeEvalContext(comp);
        let forVarName = genLogoVarLref(forLoopCtrl.getToken());

        forLoopCtrl.next();

        code.append("{");
        code.append(genToken(forLoopCtrl));
        code.append(";const $forBegin=$ret;\n");

        forLoopCtrl.next();

        code.append(genToken(forLoopCtrl));
        code.append(";const $forEnd=$ret;\n");

        code.append("const $forDecrease = $forEnd < $forBegin;\n");

        let forStep = forLoopCtrl.next() ? genToken(forLoopCtrl) : "$forDecrease ? -1 : 1";
        code.append("const $forStep = ", forStep, ";\n");

        code.append("if ((!$forDecrease && $forStep > 0) || ($forDecrease && $forStep < 0))\n");
        code.append("for(", forVarName, "=$forBegin; ($forDecrease && ", forVarName, ">=$forEnd) || (!$forDecrease &&", forVarName, "<=$forEnd); ", forVarName, "+=$forStep) {\n");

        evxContext.next();
        code.append(genInstrList(evxContext, "for"));

        code.append("}}");
        code.append("\n;$ret=undefined;");

        return code;
    }

    function genMake(evxContext) {
        let code = new Code([], CODE_TYPE.STMT);

        evxContext.next();

        let varName = logo.env.extractVarName(evxContext.getToken());

        evxContext.next();

        code.append(genToken(evxContext));
        code.append(";\n");
        code.append(genLogoVarLref(varName));
        code.append("=$ret;$ret=undefined;");

        return code;
    }

    function genLocalmake(evxContext) {
        let code = new Code([], CODE_TYPE.STMT);

        evxContext.next();

        let varName = logo.env.extractVarName(evxContext.getToken());

        evxContext.next();
        _varScopes.addVar(varName);

        code.append(genToken(evxContext));
        code.append(";\n");
        code.append("let ");
        code.append(genLogoVarLref(varName));
        code.append("=$ret;$ret=undefined;");

        return code;
    }

    function genLogoVarRef(curToken, srcmap) {
        let varName = logo.env.extractVarName(curToken);
        return _varScopes.isLocalVar(varName) ?
            new Code(["logo.lrt.util.logoVar(", varName, ", \"", varName, "\",", logo.type.srcmapToJs(srcmap), ")"]) :
            new Code(["logo.lrt.util.logoVar(logo.env.findLogoVarScope(\"", varName, "\", $scopeCache)[\"", varName,
                "\"", "], \"", varName, "\",", logo.type.srcmapToJs(srcmap), ")"]);
    }

    function genLogoVarLref(varName) {
        return _varScopes.isLocalVar(varName) ? new Code([varName]) :
            new Code(["logo.env.findLogoVarScope('" + varName + "', $scopeCache)['" + varName + "']"]);
    }

    function genLogoSlotRef(curToken, srcmap) {
        let slotNum = logo.env.extractSlotNum(curToken);
        return new Code(["logo.env.callPrimitive(\"?\",", logo.type.srcmapToJs(srcmap), ",", slotNum, ")"]);
    }

    function genInstrListCall(curToken, srcmap) {
        let code = new Code();

        code.append("(");
        code.append(genPrepareCall("[]", srcmap));
        code.append("$ret);\n");

        code.append("$ret=");
        code.append(logo.env.getAsyncFunctionCall() ? "await callLogoInstrListAsync(" : "callLogoInstrList(");
        code.append(genLogoVarRef(curToken, srcmap));
        code.append(");");

        code.append("(");
        code.append(genCompleteCall());
        code.append("$ret);\n");

        return code;
    }

    function insertDelimiters(param, delimiter) {
        let ret = param.map(v => [v, delimiter]).reduce((accumulator, currentValue) =>
            accumulator.concat(currentValue), []);
        ret.pop();
        return ret;
    }

    function genUserProcCall(evxContext, curToken, srcmap, markRetExpr) {
        let code = new Code();
        let param = genParamUserProcCall(evxContext, curToken, logo.env._ws[curToken].formal.length);

        code.append("(");
        code.append(genPrepareCall(curToken, srcmap));

        if (logo.env.getAsyncFunctionCall()) {
            code.append("$ret=(await logo.env._user[", "\"" +
                curToken + "\"", "](");
        } else {
            code.append("$ret=(logo.env._user[\"" + curToken +
                "\"", "](");
        }

        code.append(new Code(insertDelimiters(param, ",")));
        code.append(")),");
        code.append(genCompleteCall());
        code.append("$ret)");

        evxContext.retExpr = markRetExpr;

        return code;
    }

    function genParamUserProcCall(evxContext, procName, paramListLength, precedence) {
        let param = [];
        for (let j = 0; j < paramListLength; j++) { // push actual parameters
            evxContext.next();
            let generatedParam = genToken(evxContext, precedence);
            if (generatedParam == CODEGEN_CONSTANTS.NOP) {
                generatedParam = new Code(["throwRuntimeLogoException('NOT_ENOUGH_INPUTS',",
                    logo.type.srcmapToJs(evxContext.getSrcmap()), ",[ \"" + procName + "\"])"]);
            }

            param.push(generatedParam);
        }

        return param;
    }

    function genPrimitiveCall(evxContext, curToken, srcmap, markRetExpr, isInParen) {
        let code = new Code();

        let param = genParamPrimitiveCall(evxContext, curToken, logo.lrt.util.getPrimitivePrecedence(curToken),
            isInParen);

        code.append("(");
        if  (curToken in genLambda) {
            code.append(genStashLocalVars());
        }

        if (logo.env.getAsyncFunctionCall()) {
            code.append("($ret=await logo.env.callPrimitiveAsync(\"");
        } else {
            code.append("($ret=logo.env.callPrimitive(\"");
        }

        code.append(curToken, "\", ", logo.type.srcmapToJs(srcmap), ",");
        code.append(new Code(insertDelimiters(param, ",")));
        code.append("))");

        if (curToken in genLambda) {
            code.append(",");
            code.append(genApplyLocalVars());
            code.append("$ret");
        }

        code.append(")");
        evxContext.retExpr = markRetExpr;

        return code;
    }

    function genParamPrimitiveCall(evxContext, primitiveName, precedence = 0, isInParen = false) {
        let param = [];
        let paramListLength = logo.lrt.util.getPrimitiveParamCount(primitiveName);
        let paramListMinLength = logo.lrt.util.getPrimitiveParamMinCount(primitiveName);
        let paramListMaxLength = logo.lrt.util.getPrimitiveParamMaxCount(primitiveName);
        let j = 0;

        if (isInParen && (paramListMaxLength > paramListLength || paramListMaxLength==-1)) {
            for (; (j < paramListMaxLength || paramListMaxLength == -1) &&
                    (isInParen && evxContext.peekNextToken() != ")" ) && evxContext.next(); j++) {
                param.push(genToken(evxContext, precedence));
            }
        } else {
            for (; j < paramListLength && ((isInParen && evxContext.peekNextToken() != ")" ) || !isInParen) ; j++) { // push actual parameters
                evxContext.next();
                let generatedParam = genToken(evxContext, precedence);
                if (generatedParam == CODEGEN_CONSTANTS.NOP) {
                    generatedParam = new Code(["throwRuntimeLogoException('NOT_ENOUGH_INPUTS',",
                        logo.type.srcmapToJs(evxContext.getSrcmap()), ",[ \"" + primitiveName + "\"])"]);
                }

                param.push(generatedParam);
            }
        }

        if (j < paramListMinLength) {
            param.push(new Code(["throwRuntimeLogoException('NOT_ENOUGH_INPUTS',", logo.type.srcmapToJs(evxContext.getSrcmap()),
                ",[ \"" + primitiveName + "\"])"]));
        }

        return param;
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

    function genToken(evxContext, precedence = 0, isStatement = false, markRetExpr = true, isInParen = false,
        stopAtLineEnd = true) {

        let code = new Code();
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
                code.append("$ret=");
            }

            code.append(tmp);
            evxContext.retExpr = markRetExpr;
        } else if (sys.equalToken(curToken, "stop")) {
            code.append("return");
        } else if (sys.equalToken(curToken, "output") || sys.equalToken(curToken, "op")) {
            evxContext.next();
            code.append(genToken(evxContext));
            code.append(";return $ret");

        } else if (curToken == "(") {
            code.append(genParen(evxContext, evxContext.peekNextToken() === "local", true));
            evxContext.retExpr = markRetExpr;
        } else if (typeof curToken == "object") {
            if (markRetExpr && !logo.type.isLogoProc(curToken)) {
                code.append("$ret=");
            }

            code.append(logo.type.isLogoProc(curToken) ? genProc(curToken, srcmap) :
                logo.type.isLogoArray(curToken) ?  genArray(curToken, srcmap) :
                    genLogoList(curToken, srcmap));

            evxContext.retExpr = markRetExpr;
        } else if (logo.type.isQuotedLogoWord(curToken)) {
            if (markRetExpr) {
                code.append("$ret=");
            }

            code.append(logo.type.quotedLogoWordToJsStringLiteral(curToken));
            evxContext.retExpr = markRetExpr;
        } else if (logo.type.isLogoVarRef(curToken)) {
            if (markRetExpr) {
                code.append("$ret=");
            }

            code.append(genLogoVarRef(curToken, srcmap));
            evxContext.retExpr = markRetExpr;
        } else if (logo.type.isLogoSlot(curToken)) {
            if (markRetExpr) {
                code.append("$ret=");
            }

            code.append(genLogoSlotRef(curToken, srcmap));

            evxContext.retExpr = markRetExpr;
        } else { // call
            if (markRetExpr && (!(curToken in genNativeJs) || getGenNativeJsOutput(curToken))) {
                code.append("$ret=");
            }

            if (curToken in genNativeJs) {
                code.append(genNativeJs[curToken][0](evxContext, isInParen));
                noOperator = getGenNativeJsNoOperator(curToken);
                noSemicolon = getGenNativeJsNoSemicolon(curToken);
                evxContext.retExpr = getGenNativeJsOutput(curToken);
            } else if (curToken in logo.lrt.primitive) {
                code.append(genPrimitiveCall(evxContext, curToken, srcmap, markRetExpr, isInParen));
            } else if (curToken in logo.env._ws) {
                code.append(genUserProcCall(evxContext, curToken, srcmap, markRetExpr));
            } else {
                code.append("throwRuntimeLogoException('UNKNOWN_PROC',", logo.type.srcmapToJs(srcmap), ",[\"" +
                    curToken + "\"])");

                evxContext.retExpr = markRetExpr;
            }
        }

        appendInfixExpr(code, evxContext, noOperator, precedence, markRetExpr);

        if (isStatement && code.length() > 0) {
            if (!noSemicolon) {
                code.append(";");
            }

            code.append("\n");
        }

        return code;
    }

    function appendInfixExpr(code, evxContext, noOperator, precedence, markRetExpr) {

        while (!noOperator && evxContext.isNextTokenBinaryOperator()) {
            let nextOp = evxContext.getNextOperator();
            let nextOpSrcmap = evxContext.getNextOperatorSrcmap();
            let nextPrec = logo.lrt.util.getBinaryOperatorPrecedence(nextOp);

            if (precedence >= nextPrec) {
                break;
            }

            evxContext.next();

            if (logo.env.getAsyncFunctionCall()) {
                code.prepend("($ret=await logo.env.callPrimitiveOperatorAsync(\"", nextOp, "\",", logo.type.srcmapToJs(nextOpSrcmap), ",");
            } else {
                code.prepend("($ret=logo.env.callPrimitiveOperator(\"", nextOp, "\",", logo.type.srcmapToJs(nextOpSrcmap), ",");
            }

            code.append(",");
            evxContext.next();

            let nextOpnd = genToken(evxContext, nextPrec);
            if (nextOpnd == CODEGEN_CONSTANTS.NOP) {
                nextOpnd = new Code(["throwRuntimeLogoException('NOT_ENOUGH_INPUTS',",
                    logo.type.srcmapToJs(evxContext.getSrcmap()), ",[ \"" + nextOp + "\"])"]);
            }

            code.append(nextOpnd);
            code.append("))");

            evxContext.retExpr = markRetExpr;
        }
    }

    function genBody(evxContext, isStatement, isInstrList) {
        let code = new Code();

        do {
            code.append(genToken(evxContext, 0, isStatement));
            if (evxContext.retExpr && sys.Config.get("unactionableDatum") && (!isInstrList || evxContext.hasNext())) {
                code.append("checkUnactionableDatum($ret,", logo.type.srcmapToJs(evxContext.getSrcmap()), ");\n");
            }
        } while (evxContext.next());

        return code;
    }
    codegen.genBody = genBody;

    function genInstrListLambdaDeclCode(evxContext, param) {
        _varScopes.enter();
        let code = new Code();
        code.append(logo.env.getAsyncFunctionCall() ? "(async(" : "((");

        if (param !== undefined) {
            code.append(new Code(insertDelimiters(param, ",")));
            param.forEach(v => _varScopes.addVar(v));
        }

        code.append(")=>{");

        code.append("let $scopeCache = {};\n");

        if (param !== undefined) {
            code.append("let $scope = {}; logo.env._scopeStack.push($scope);\n");
        } else {
            code.append("let $scope = logo.env._scopeStack[logo.env._scopeStack.length - 1];\n");
        }

        code.append(genBody(evxContext, true, true));

        code.append("(");
        code.append(genStashLocalVars());
        code.append("$ret);");

        if (param !== undefined) {
            code.append("logo.env._scopeStack.pop();\n");
        }

        code.append("return $ret;");

        code.append("})");
        _varScopes.exit();
        let mergedCode = code.merge();
        sys.trace(mergedCode, "codegen.lambda");
        sys.Config.get("verbose");

        return mergedCode;
    }
    codegen.genInstrListLambdaDeclCode = genInstrListLambdaDeclCode;

    function genParen(evxContext, isStatement, markRetExpr) {
        let code = new Code();

        evxContext.next();

        let codeFromToken = genToken(evxContext, 0, isStatement, true, markRetExpr);
        code.append(codeFromToken);
        evxContext.next();

        if (evxContext.getToken() != ")") {
            code.append(
                "(throwRuntimeLogoException(",
                "\"TOO_MUCH_INSIDE_PAREN\",",
                logo.type.srcmapToJs(evxContext.getSrcmap()),
                "))");
        }

        return code;
    }

    function genTopLevelCode(p) {

        let oldFuncName = _funcName;
        _funcName = "";

        let evxContext = logo.interpreter.makeEvalContext(p);

        _varScopes.enter();
        let code = genBody(evxContext, true).merge();
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
        let code = new Code();

        if (sys.Config.get("dynamicScope")) {
            code.append(genStashLocalVars());
        }

        code.append("logo.env._callstack.push([logo.env._curProc," + logo.type.srcmapToJs(srcmap) + "]),");
        code.append("logo.env._curProc=\"" + target + "\",\n");

        return code;
    }

    function genCompleteCall() {
        let code = new Code();
        code.append("logo.env._curProc=logo.env._callstack.pop()[0],");
        if (sys.Config.get("dynamicScope")) {
            code.append(genApplyLocalVars());
        }

        return code;
    }

    function genStashLocalVars() {
        let code = new Code();
        _varScopes.localVars().forEach((varName) =>
            code.append("($scope['", varName, "']=", varName, "),"));

        return code;
    }

    function genApplyLocalVars() {
        let code = new Code();
        _varScopes.localVars().forEach(varName =>
            code.append("(", varName, "=$scope['", varName, "']),"));

        return code;
    }

    function genProc(p, srcmap) {
        let code = new Code();
        code.append(logo.env.getAsyncFunctionCall() ? "async function " : "function ");

        if(!logo.type.isLogoProc(p)) {
            return;
        }

        let oldFuncName = _funcName;
        _funcName = p[1];

        let evxContext = logo.interpreter.makeEvalContext(logo.type.embedSrcmap(p[3], srcmap[3]));
        code.append(_funcName, "(");

        let params = p[2];
        code.append(new Code(insertDelimiters(params, ",")));
        code.append(")");
        code.append("{\n");
        code.append("let $ret;\n");

        if (sys.Config.get("dynamicScope")) {
            code.append("let $scope = {}, $scopeCache = {};\n");
            code.append("logo.env._scopeStack.push($scope);\n");
        }

        _varScopes.enter();
        params.forEach(v => _varScopes.addVar(v));
        code.append(genBody(evxContext, true));
        _varScopes.exit();

        code.append("logo.env._scopeStack.pop();\n");
        code.append("}\n");

        code.prepend("logo.env._user[\"" + _funcName + "\"]=");
        code.append("undefined;\n");

        _funcName = oldFuncName;
        return code;
    }

    return codegen;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
