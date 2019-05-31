//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Transpiles parsed Logo code into JavaScript
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

var $classObj = {};
$classObj.create = function(logo, sys) {

    const CODEGEN_CONSTANTS = {
        NOP : "undefined;"
    };

    let _funcName = "";

    const _varScopes = (function() {
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

    function genLocal(evxContext, isInParen) {
        if (sys.isUndefined(isInParen)) {
            isInParen = false;
        }

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

    function genIf(evxContext) {
        let code = [];

        code.push("if (logo.type.isNotLogoFalse(");
        evxContext.next();
        code.push(genToken(evxContext,0));
        code.push(")) {\n");
        evxContext.next();

        let curToken = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();

        if (!logo.type.isLogoList(curToken)) {
            code.push("throwRuntimeLogoException('INVALID_INPUT',", logo.type.srcmapToJs(srcmap),
                ",[\"if\", \"" + curToken + "\"])");
        } else {
            let comp = logo.parse.parseBlock([curToken, srcmap]);
            code.push(genBody(logo.interpreter.makeEvalContext(comp[0], comp[1]), true));
        }

        code.push("}");

        curToken = evxContext.peekNextToken();
        if (curToken == "else") {
            evxContext.next();
            curToken = evxContext.peekNextToken();
            // TODO: if (logo.type.isLogoList(curToken)) { throw error }
        }

        if (logo.type.isLogoList(curToken)) {
            evxContext.next();
            code.push(" else {");
            srcmap = evxContext.getSrcmap();

            let comp = logo.parse.parseBlock([curToken, srcmap]);
            code.push(genBody(logo.interpreter.makeEvalContext(comp[0], comp[1]), true));
            code.push("}");
        }

        return code;
    }

    function genCatch(evxContext) {
        let code = [];

        evxContext.next();

        let label = genToken(evxContext, 0);
        if (logo.env.getAsyncFunctionCall()) {
            code.push("($ret=await (async function() {");
        } else {
            code.push("($ret=(function() {");
        }

        code.push("try {\n");
        evxContext.next();

        let curToken = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();

        if (!logo.type.isLogoList(curToken)) {
            code.push("throwRuntimeLogoException('INVALID_INPUT',",
                logo.type.srcmapToJs(srcmap), ",[\"catch\", \"" + curToken + "\"])");
        } else {
            let comp = logo.parse.parseBlock([curToken, srcmap]);
            code.push(genBody(logo.interpreter.makeEvalContext(comp[0], comp[1]), true));
        }

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

        let curToken = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();

        if (!logo.type.isLogoList(curToken)) {
            code.push("throwRuntimeLogoException('INVALID_INPUT',",
                logo.type.srcmapToJs(srcmap), ",[\"ifelse\", \"" + curToken + "\"])");
        } else {
            let comp = logo.parse.parseBlock([curToken, srcmap]);
            code.push(genBody(logo.interpreter.makeEvalContext(comp[0], comp[1]), true));
        }

        code.push("} else {\n");

        evxContext.next();
        curToken = evxContext.getToken();
        srcmap = evxContext.getSrcmap();

        if (!logo.type.isLogoList(curToken)) {
            code.push("throwRuntimeLogoException('INVALID_INPUT',",
                logo.type.srcmapToJs(srcmap), ",[\"ifelse\", \"" + curToken + "\"])");
        } else {
            let comp = logo.parse.parseBlock([curToken, srcmap]);
            code.push(genBody(logo.interpreter.makeEvalContext(comp[0], comp[1]), true));
        }

        code.push("}");

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

        let curToken = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();
        if (evxContext.isTokenEndOfStatement(curToken)) {
            code.push("throwRuntimeLogoException('NOT_ENOUGH_INPUTS',",
                logo.type.srcmapToJs(srcmap), ",[\"repeat\"])");
        } else {
            let bodycomp = logo.parse.parseBlock([curToken, srcmap]);
            code.push(genBody(logo.interpreter.makeEvalContext(bodycomp[0], bodycomp[1]), true));
        }

        code.push("}");
        return code;
    }

    function genFor(evxContext) {
        let code = [];

        evxContext.next();

        let token = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();

        token = token.map(sys.toNumberIfApplicable);

        let comp = logo.parse.parseBlock([token, srcmap]);
        let forLoopCtrl = logo.interpreter.makeEvalContext(comp[0], comp[1]);
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

        comp = logo.parse.parseBlock([evxContext.getToken(), evxContext.getSrcmap()]);
        code.push(genBody(logo.interpreter.makeEvalContext(comp[0], comp[1]), true));
        code.push("}}");

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
        code.push(";undefined");
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
        code.push(";undefined");
        return code;
    }

    function genLogoVarRef(curToken, srcmap) {
        let varName = logo.env.extractVarName(curToken);
        return _varScopes.isLocalVar(varName) ?  ["logo.lrt.util.logoVar(", varName, ", \"", varName, "\",", logo.type.srcmapToJs(srcmap), ")"] :
            _varScopes.isGlobalVar(varName) ? ["logo.lrt.util.logoVar(_globalScope[\"", varName, "\"" , "], \"", varName, "\",",  logo.type.srcmapToJs(srcmap), ")"] :
                ["logo.lrt.util.logoVar(logo.env.findLogoVarScope(\"", varName, "\", $scopeCache)[\"", varName, "\"", "], \"", varName, "\",", logo.type.srcmapToJs(srcmap), ")"];
    }

    function genLogoVarLref(varName) {
        return _varScopes.isLocalVar(varName) ? [varName] :
            _varScopes.isGlobalVar(varName) ? ["_globalScope['" + varName + "']"] :
                ["logo.env.findLogoVarScope('" + varName + "', $scopeCache)['" + varName + "']"];
    }

    function insertDelimiters(param, delimiter) {
        let ret = [];

        param.forEach(function(v, i) {
            ret[i * 2] = param[i];
            if (i > 0) {
                ret[i * 2 - 1] = delimiter;
            }
        });

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

    function genPrimitiveCallParam(evxContext, primitiveName, precedence, isInParen) {
        let param = [];

        if (sys.isUndefined(precedence)) {
            precedence = 0;
        }

        if (sys.isUndefined(isInParen)) {
            isInParen = false;
        }

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

    function genLogoList(obj) {
        sys.assert(logo.type.isLogoList(obj));
        return JSON.stringify(obj.map(sys.toNumberIfApplicable));
    }

    function genToken(evxContext, precedence, isStatement, markRetExpr, isInParen, stopAtLineEnd) {
        let code = [];

        if (sys.isUndefined(precedence)) {
            precedence = 0;
        }

        if (sys.isUndefined(isStatement)) {
            isStatement = false;
        }

        if (sys.isUndefined(markRetExpr)) {
            markRetExpr = false;
        }

        if (sys.isUndefined(isInParen)) {
            isInParen = false;
        }

        if (sys.isUndefined(stopAtLineEnd)) {
            stopAtLineEnd = false;
        }

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
            code.push(genParen(evxContext, evxContext.peekNextToken() == "local"));
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
                    code.push("(await logo.env.callPrimitiveAsync(\"");
                } else {
                    code.push("(logo.env.callPrimitive(\"");
                }

                code.push(curToken, "\", ", logo.type.srcmapToJs(srcmap), ",",
                    genPrimitiveCallParam(evxContext, curToken, logo.lrt.util.getPrimitivePrecedence(curToken),
                        isInParen), "))");

                evxContext.retExpr = markRetExpr;
            } else if (curToken in logo.env._ws) {
                code.push("(");

                if (sys.Config.get("dynamicScope")) {
                    _varScopes.localVars().forEach(function(varName) {
                        code.push("($scope['", varName, "']=", varName, "),");
                    });
                }

                code.push("logo.env._callstack.push([logo.env._curProc," + logo.type.srcmapToJs(srcmap) + "]),");
                code.push("logo.env._curProc=\"" + curToken + "\",\n");

                if (logo.env.getAsyncFunctionCall()) {
                    code.push("$ret=(await logo.env._user[", "\"" +
                        curToken + "\"", "](");
                } else {
                    code.push("$ret=(logo.env._user[\"" + curToken +
                        "\"", "](");
                }

                code.push(genProcCallParam(evxContext, logo.env._ws[curToken].formal.length));
                code.push(")),");

                code.push("logo.env._curProc=logo.env._callstack.pop()[0],");

                if (sys.Config.get("dynamicScope")) {
                    _varScopes.localVars().forEach(function(varName) {
                        code.push("(", varName, "=$scope['", varName, "']),");
                    });
                }

                if (sys.Config.get("dynamicScope")) {
                    code.push("logo.env._scopeStack.splice($scopeStackLength),");
                }

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

    function genBody(evxContext, isStatement) {
        let code = [];

        do {
            code.push(genToken(evxContext, 0, isStatement, true));
            if (evxContext.retExpr && sys.Config.get("unactionableDatum")) {
                code.push("checkUnactionableDatum($ret,", logo.type.srcmapToJs(evxContext.getSrcmap()), ");\n");
            }
        } while (evxContext.next());

        return code;
    }

    function genParen(evxContext, isStatement) {
        let code = [];

        if (!isStatement) {
            code.push("(");
        }

        evxContext.next();

        let codeFromToken = genToken(evxContext, 0, isStatement, false, true);

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

    function genCode(p, srcmap) {

        let oldFuncName = _funcName;
        _funcName = "";
        let evxContext = logo.interpreter.makeEvalContext(p, srcmap);

        _varScopes.enter();
        let code = mergeCode(genBody(evxContext, true));
        _varScopes.exit();

        let ret = "// " + JSON.stringify(p) + "\n" +
                "//" + JSON.stringify(srcmap) + "\n" +
                "$scopeCache={};" +
                "logo.env._user.$ = async function(){\n" + code + "}";

        _funcName = oldFuncName;
        return ret;
    }

    function genProc(p, srcmap) {
        let code = logo.env.getAsyncFunctionCall() ? ["async function "] : ["function "];

        if(!logo.type.isLogoProc(p)) {
            return;
        }

        let oldFuncName = _funcName;
        _funcName = p[1];

        let evxContext = logo.interpreter.makeEvalContext(p[3], srcmap[3]);
        code.push(_funcName, "(");

        let params = p[2];

        code.push(insertDelimiters(params, ",") );
        code.push(")");
        code.push("{\n");
        code.push("let $ret, $scopeStackLength;\n");

        if (sys.Config.get("dynamicScope")) {
            code.push("let $scope = {}, $scopeCache = {};\n");
            code.push("logo.env._scopeStack.push($scope);\n$scopeStackLength = logo.env._scopeStack.length;\n");
        }

        _varScopes.enter();
        params.forEach(function(v) { _varScopes.addVar(v); });
        code.push(genBody(evxContext, true));
        _varScopes.exit();

        code.push("logo.env._scopeStack.pop();\n");
        code.push("}\n");

        code.splice(0, 0, "logo.env._user[\"" + _funcName + "\"]=");
        code.push("undefined;\n");

        _funcName = oldFuncName;
        return code;
    }

    return genCode;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
