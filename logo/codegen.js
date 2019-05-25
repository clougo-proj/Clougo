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

    const CodeWithSrcmap = (function() {
        let CodeWithSrcmap = {};
        CodeWithSrcmap.prototype = {
            getCode: function() { return this._code; },
            getSrcmap: function() { return this._srcmap; }
        };

        CodeWithSrcmap.create = function(code, srcmap) {
            let obj = Object.create(CodeWithSrcmap.prototype);
            obj._code = code;
            obj._srcmap = srcmap;
            return obj;
        };

        CodeWithSrcmap.is = function(obj) {
            return obj.__proto__ == CodeWithSrcmap.prototype;
        };

        return CodeWithSrcmap;
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
        let srcmap = evxContext.getSrcmap();

        code.push(CodeWithSrcmap.create("let ", srcmap));

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
            code.push(CodeWithSrcmap.create("throwRuntimeLogoException('INVALID_INPUT', ", srcmap), "[\"if\", \"" + curToken + "\"],  Error().stack)");
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
            code.push(CodeWithSrcmap.create("throwRuntimeLogoException('INVALID_INPUT', ", srcmap), "[\"catch\", \"" + curToken + "\"],  Error().stack)");
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
            code.push(CodeWithSrcmap.create("throwRuntimeLogoException('INVALID_INPUT', ", srcmap), "[\"ifelse\", \"" + curToken + "\"],  Error().stack)");
        } else {
            let comp = logo.parse.parseBlock([curToken, srcmap]);
            code.push(genBody(logo.interpreter.makeEvalContext(comp[0], comp[1]), true));
        }

        code.push("} else {\n");

        evxContext.next();
        curToken = evxContext.getToken();
        srcmap = evxContext.getSrcmap();

        if (!logo.type.isLogoList(curToken)) {
            code.push(CodeWithSrcmap.create("throwRuntimeLogoException('INVALID_INPUT', ", srcmap), "[\"ifelse\", \"" + curToken + "\"],  Error().stack)");
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
            code.push(CodeWithSrcmap.create("throwRuntimeLogoException('NOT_ENOUGH_INPUTS', ", srcmap), "[\"repeat\"],  Error().stack)");
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
        let forVarName = genLogoVarLref(forLoopCtrl.getToken(), forLoopCtrl.getSrcmap());

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

        Array.prototype.push.apply(code, genLogoVarLref(varName, evxContext.getSrcmap()));

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

        Array.prototype.push.apply(code, genLogoVarLref(varName, evxContext.getSrcmap()));

        evxContext.next();
        code.push("=");
        code.push(genToken(evxContext,0));
        code.push(";undefined");
        return code;
    }

    function genLogoVarRef(curToken, srcmap) {
        let varName = logo.env.extractVarName(curToken);
        return _varScopes.isLocalVar(varName) ?  [CodeWithSrcmap.create("logo.lrt.util.logoVar(", srcmap), varName, ", \"", varName, "\")"] :
            _varScopes.isGlobalVar(varName) ? [CodeWithSrcmap.create("logo.lrt.util.logoVar(_globalScope[", srcmap), "\"" + varName+ "\"" , "], \"", varName, "\")"] :
                [CodeWithSrcmap.create("logo.lrt.util.logoVar(logo.env.findLogoVarScope(\"", srcmap), varName, "\", $scopeCache)[\"", varName, "\"", "], \"", varName, "\")"];
    }

    function genLogoVarLref(varName, srcmap) {
        return _varScopes.isLocalVar(varName) ? [CodeWithSrcmap.create(varName, srcmap)] :
            _varScopes.isGlobalVar(varName) ? ["_globalScope[", CodeWithSrcmap.create("'" + varName + "'", srcmap), "]"] :
                ["logo.env.findLogoVarScope(", CodeWithSrcmap.create("'" + varName + "', $scopeCache)['" + varName + "'", srcmap), "]"];
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
                    generatedParam = [CodeWithSrcmap.create("throwRuntimeLogoException('NOT_ENOUGH_INPUTS', ", evxContext.getSrcmap()),
                        "[ \"" + primitiveName + "\"],  Error().stack)"];
                }

                param.push(generatedParam);
            }
        }

        if (j < paramListMinLength) {
            param.push([CodeWithSrcmap.create("throwRuntimeLogoException('NOT_ENOUGH_INPUTS', ", evxContext.getSrcmap()),
                "[ \"" + primitiveName + "\"],  Error().stack)"]);
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

            code.push(CodeWithSrcmap.create(tmp, srcmap));
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
                code.push(CodeWithSrcmap.create("$ret=", srcmap));
            }

            code.push(logo.type.isLogoProc(curToken) ? genProc(curToken, srcmap) :
                logo.type.isLogoArray(curToken) ?  genArray(curToken, srcmap) :
                    CodeWithSrcmap.create(genLogoList(curToken, srcmap), srcmap));

            evxContext.retExpr = markRetExpr;
        } else if (logo.type.isQuotedLogoWord(curToken)) {
            if (markRetExpr) {
                code.push("$ret=");
            }

            code.push(CodeWithSrcmap.create(logo.type.quotedLogoWordToJsStringLiteral(curToken), srcmap));
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
                    code.push("(await logo.lrt.primitive['");
                } else {
                    code.push("(logo.lrt.primitive['");
                }

                code.push(CodeWithSrcmap.create(curToken, srcmap));
                code.push("'](\"", curToken, "\", ", genPrimitiveCallParam(evxContext, curToken,
                    logo.lrt.util.getPrimitivePrecedence(curToken), isInParen), "))");

                evxContext.retExpr = markRetExpr;
            } else if (curToken in logo.env._ws) {
                code.push("(");

                if (sys.Config.get("dynamicScope")) {
                    _varScopes.localVars().forEach(function(varName) {
                        code.push("($scope['", varName, "']=", varName, "),");
                    });
                }

                if (logo.env.getAsyncFunctionCall()) {
                    code.push(CodeWithSrcmap.create("$ret=(await logo.env._user[", srcmap), "\"" +
                        curToken + "\"", "](");
                } else {
                    code.push(CodeWithSrcmap.create("$ret=(logo.env._user[", srcmap), "\"" + curToken +
                        "\"", "](");
                }

                code.push(genProcCallParam(evxContext, logo.env._ws[curToken].formal.length));
                code.push(")),");

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
                code.push(CodeWithSrcmap.create("throwRuntimeLogoException('UNKNOWN_PROC', ", srcmap), "[\"" +
                    curToken + "\"],  Error().stack)");

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
            let primitiveName = logo.lrt.util.getBinaryOperatorPrimitiveName(nextOp);
            if (primitiveName !== undefined) {
                code.splice(0, 0, "logo.lrt.primitive['", CodeWithSrcmap.create(primitiveName, nextOpSrcmap),
                    "'](\"", primitiveName, "\", ");

                code.push(",");
                code.push(genProcCallParam(evxContext, callTarget.length - 2, nextPrec));
                code.push(")");
            } else {
                code.push(CodeWithSrcmap.create(nextOp, nextOpSrcmap));
                code.push(genProcCallParam(evxContext, callTarget.length - 2, nextPrec));
            }


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
                code.push(CodeWithSrcmap.create("checkUnactionableDatum($ret);\n", evxContext.getSrcmap()));
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
                CodeWithSrcmap.create("(throwRuntimeLogoException(",
                    logo.lrt.util.getSrcmapFirstLeaf(evxContext.getSrcmap())),
                "\"TOO_MUCH_INSIDE_PAREN\", ",
                "undefined, ",
                "Error().stack))");
        }

        if (!isStatement) {
            code.push(")");
        }

        return code;
    }

    function mergeCode(code) {

        let line = 3, col = 0; // line 0: src, line 1: srcmap, line 2: generatedSrcmap, line 3 and after: code

        logo.generatedCodeSrcmap = [];

        function assembleCode(code, srcmap) {
            if (typeof code !== "string") {
                code = code.toString();
            }

            if (!sys.isUndefined(srcmap)) {
                if (!(line in logo.generatedCodeSrcmap)) {
                    logo.generatedCodeSrcmap[line] = [];
                }

                logo.generatedCodeSrcmap[line].push([col + 1, srcmap]);
            }

            let lines = code.split(/\n/);
            line += lines.length - 1;
            col = (lines.length > 1) ? lines[lines.length - 1].length : col + lines[0].length;

            return code;
        }

        return (function mergeCodeHelper(code) {

            if (Array.isArray(code)) {
                return code.map(mergeCodeHelper).join("");
            } else if (CodeWithSrcmap.is(code)) {
                return assembleCode(code.getCode(), code.getSrcmap());
            } else {
                return assembleCode(code);
            }

        })(code);
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
                "logo.generatedCodeSrcmap = " + JSON.stringify(logo.generatedCodeSrcmap) + ";$scopeCache={};" +
                "logo.env._user.$ = async function(){\n" + code + "}";

        sys.trace(JSON.stringify(logo.generatedCodeSrcmap), "codegen");
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

        let funcNameSrcmap = srcmap[1];

        let evxContext = logo.interpreter.makeEvalContext(p[3], srcmap[3]);
        code.push(_funcName, "(");

        let params = p[2];
        let paramSrcmaps = srcmap[2];

        code.push(insertDelimiters(params.map(function(v, n) { return CodeWithSrcmap.create(v, paramSrcmaps[n]); } ) , ",") );
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

        code.splice(0, 0, CodeWithSrcmap.create("logo.env._user[", funcNameSrcmap), "\"" + _funcName + "\"", "]=");
        code.push("undefined;\n");

        _funcName = oldFuncName;
        return code;
    }

    return genCode;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
