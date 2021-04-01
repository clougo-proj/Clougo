//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Transpiles parsed Logo code into JavaScript
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

var $obj = {};
$obj.create = function(logo, sys) {

    const TOP_LEVEL_FUNC = "";

    const codegen = {};

    let _funcName = TOP_LEVEL_FUNC;

    let _isLambda = false;

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
        "if": genIf,
        "catch": genCatch,
        "ifelse": genIfElse,
        "make": genMake,
        "localmake": genLocalmake,
        "local": genLocal,
        "repeat": genRepeat,
        "for": genFor,
        "pi": genPi
    };

    const callLambda = new Set(["apply", "invoke"]);

    const needStashLocalVars = new Set(["apply", "invoke", "repeat", "for", "thing", "namep", "make"]);

    const CODE_TYPE = {
        EXPR: 0,
        STMT: 1,
        ASYNC_MACRO: 2
    };

    class Code {
        constructor(rawCodeArray, codeType) {
            this._code = rawCodeArray.slice(0);
            this._codeType = codeType;
            this._postFix = false;
        }

        static expr(...rawCode) {
            return new Code(rawCode, CODE_TYPE.EXPR);
        }

        static stmt(...rawCode) {
            return new Code(rawCode, CODE_TYPE.STMT);
        }

        static asyncMacro(...rawCode) {
            return new Code(rawCode, CODE_TYPE.ASYNC_MACRO);
        }

        append(...args) {
            Array.prototype.push.apply(this._code, args);
            if (containsPostFix(args)) {
                this._postFix = true;
            }

            return this;
        }

        prepend(...args) {
            args.splice(0, 0, 0, 0);
            Array.prototype.splice.apply(this._code, args);
            if (containsPostFix(args)) {
                this._postFix = true;
            }

            return this;
        }

        captureRetVal() {
            return this.prepend("$ret=");
        }

        length() {
            return this._code.length;
        }

        isExpr() {
            return this._codeType === CODE_TYPE.EXPR;
        }

        isAsyncMacro() {
            return this._codeType === CODE_TYPE.ASYNC_MACRO;
        }

        postFix() {
            return this._postFix;
        }

        merge() {
            if (this.isAsyncMacro()) {
                let key = this._code[0];
                return logo.env.getAsyncFunctionCall() ? ASYNC_MACRO_CODE[key][0] : ASYNC_MACRO_CODE[key][1];
            }

            return this._code.map((v) => (v instanceof Code) ? v.merge() :
                typeof v !== "string" ? JSON.stringify(v) : v)
                .join("");
        }

        withPostFix(postFix) {
            this._postFix = postFix;
            return this;
        }

        last() {
            return this._code.length > 0 ? this._code[this._code.length - 1] : undefined;
        }

        appendBinaryOperatorExprs(evxContext, precedence) {
            while (evxContext.isNextTokenBinaryOperator() &&
                precedence < logo.lrt.util.getBinaryOperatorPrecedence(evxContext.getNextOperator())) {

                this.appendNextBinaryOperatorExpr(evxContext);
            }

            return this;
        }

        appendNextBinaryOperatorExpr(evxContext) {
            let nextOp = evxContext.getNextOperator();
            let nextOpSrcmap = evxContext.getNextOperatorSrcmap();
            let nextPrec = logo.lrt.util.getBinaryOperatorPrecedence(nextOp);

            let nextOpnd = genProcInput(evxContext.next().next(), nextPrec, false, nextOp);
            let lastOpnd = this.last();
            let postfix = logo.config.get("postfix") ||
                ((lastOpnd instanceof Code) && lastOpnd.postFix()) || nextOpnd.postFix();

            return !postfix ? this.appendInfixBinaryOperatorExpr(nextOp, nextOpnd, nextOpSrcmap) :
                this.appendPostfixBinaryOperatorExpr(nextOp, nextOpnd, nextOpSrcmap);
        }

        appendInfixBinaryOperatorExpr(nextOp, nextOpnd, nextOpSrcmap) {
            return this.prepend("(\"", nextOp, "\",", logo.type.srcmapToJs(nextOpSrcmap), ",")
                .prepend(ASYNC_MACRO.CALL_PRIMITIVE_OPERATOR)
                .prepend("($ret=")
                .append(",")
                .append(nextOpnd)
                .append("))");
        }

        appendPostfixBinaryOperatorExpr(nextOp, nextOpnd, nextOpSrcmap) {
            return this.withPostFix(true)
                .prepend("$param.begin([\"", nextOp, "\",", logo.type.srcmapToJs(nextOpSrcmap), "]);\n")
                .append(";\n$param.add($ret);\n")
                .append(nextOpnd)
                .append(";\n$param.add($ret);\n")
                .append("$ret=")
                .append(ASYNC_MACRO.CALL_PRIMITIVE_OPERATOR)
                .append(".apply(undefined,$param.end());\n");
        }
    }

    const ASYNC_MACRO = {
        "ASYNC": Code.asyncMacro("ASYNC"),
        "AWAIT": Code.asyncMacro("AWAIT"),
        "CALL_PRIMITIVE": Code.asyncMacro("CALL_PRIMITIVE"),
        "CALL_PRIMITIVE_OPERATOR": Code.asyncMacro("CALL_PRIMITIVE_OPERATOR"),
        "CALL_LOGO_INSTR_LIST": Code.asyncMacro("CALL_LOGO_INSTR_LIST")
    };

    const ASYNC_MACRO_CODE = {
        "ASYNC": ["async ", ""],
        "AWAIT": ["await ", ""],
        "CALL_PRIMITIVE": ["await logo.env.callPrimitiveAsync", "logo.env.callPrimitive"],
        "CALL_PRIMITIVE_OPERATOR": [ "await logo.env.callPrimitiveOperatorAsync",
            "logo.env.callPrimitiveOperator"],
        "CALL_LOGO_INSTR_LIST": ["await callLogoInstrListAsync(", "callLogoInstrList("]
    };

    const CODEGEN_CONSTANTS = {
        NOP: Code.stmt("undefined;")
    };

    function genPi() {
        return Code.expr("Math.PI");
    }

    function genLocal(evxContext, isInParen = false) {

        evxContext.setAnchor();
        let code = Code.stmt();

        code.append("var ");

        let expectedParams = 1;
        let generatedParams = 0;
        let varName;

        while ((generatedParams < expectedParams || isInParen) && evxContext.peekNextToken() != ")" &&
            evxContext.hasNext()) {

            varName = evxContext.next().getToken();
            if (generatedParams > 0) {
                code.append(",");
            }

            if (!logo.type.isQuotedLogoWord(varName)) {
                evxContext.rewindToAnchor();
                return;
            }

            varName = logo.type.unquoteLogoWord(varName).toLowerCase();
            _varScopes.addVar(varName);
            code.append(varName);

            generatedParams++;
        }

        code.append(";");
        logo.trace.info("VARNAME=" + varName, "codegen.genLocal");

        return code;
    }

    function genInstrList(evxContext, primitiveName, generateCheckUnactionableDatum = true, parentSrcmap = undefined) {
        let code = Code.expr();

        let curToken = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();
        if (parentSrcmap === undefined) {
            parentSrcmap = srcmap;
        }

        if (evxContext.isTokenEndOfStatement(curToken)) {
            code.append(genThrowNotEnoughInputs(evxContext.getSrcmap(), primitiveName));
        } else if (logo.type.isLogoList(curToken)) {
            let comp = logo.parse.parseBlock(logo.type.embedSrcmap(curToken, srcmap));
            code.append(genBody(logo.interpreter.makeEvalContext(comp)));
        } else {
            code.append(genInstrListCall(curToken, parentSrcmap));
        }

        if (generateCheckUnactionableDatum && logo.config.get("unactionableDatum")) {
            code.append(";checkUnactionableDatum($ret,", logo.type.srcmapToJs(parentSrcmap), ");\n");
        }

        return code;
    }

    function genIf(evxContext) {
        let code = Code.stmt();

        code.append(genProcInput(evxContext.next(), 0, false, "if"));

        code.append(";\n");
        code.append("if (logo.type.isNotLogoFalse($ret)) {\n");

        code.append(genInstrList(evxContext.next(), "if"));
        code.append("}");

        if (evxContext.peekNextToken() === "else") {
            code.append(" else {");
            code.append(genInstrList(evxContext.next().next(), "if"));
            code.append("}");
        }

        code.append("\n;$ret=undefined;");

        return code;
    }

    function genCatch(evxContext) {
        let code = Code.stmt();

        let label = genProcInput(evxContext.next(), 0, false, "catch");

        if (!label.postFix()) {
            code.append("let $label=", label, ";\n");
        } else {
            code.append(label)
                .append("\nlet $label=$ret;\n");
        }

        code.append("try {\n");

        code.append(genInstrList(evxContext.next(), "catch", false));
        code.append("} catch (e) {\n");

        code.append("if (logo.type.LogoException.is(e) && e.isCustom()) {\n");
        code.append("if (sys.equalToken(");
        code.append("$label");
        code.append(", e.getValue()[0])){$ret=e.getValue()[1];}\n");
        code.append("else { throw e;} }\n");

        code.append("else if (!logo.type.LogoException.is(e) || (e.isError() && !sys.equalToken(");
        code.append("$label");
        code.append(", 'error'))) {\n");
        code.append("throw e;}else{$ret=undefined;}}\n");

        code.append("if($ret !== undefined) return $ret\n");

        return code;
    }

    function genIfElse(evxContext) {
        let code = Code.stmt();

        code.append(genProcInput(evxContext.next(), 0, false, "ifelse"));

        code.append(";\n");
        code.append("if (logo.type.isNotLogoFalse($ret)) {\n");
        code.append(genInstrList(evxContext.next(), "ifelse"));
        code.append("} else {\n");
        code.append(genInstrList(evxContext.next(), "ifelse"));

        code.append("}");
        code.append("\n;$ret=undefined;");

        return code;
    }

    function genRepeat(evxContext) {
        let code = Code.stmt();
        let repeatVarName = "$i";

        evxContext.setAnchor();

        let repeatCount = genProcInput(evxContext.next(), 0, false, "repeat");

        code.append(repeatCount);
        code.append(";{const $repeatEnd=$ret;\n");
        code.append("for (let ");
        code.append(repeatVarName, "=0;", repeatVarName, "<$repeatEnd;", repeatVarName, "++) {\n");

        if (!logo.type.isLogoList(evxContext.peekNextToken())) {
            evxContext.rewindToAnchor();
            return;
        }

        code.append(genInstrList(evxContext.next(), "repeat"));

        code.append("}");
        code.append("\n;$ret=undefined};");

        return code;
    }

    function genFor(evxContext) {
        evxContext.setAnchor();
        let forSrcmap = evxContext.getSrcmap();
        let token = evxContext.next().getToken();
        let srcmap = evxContext.getSrcmap();

        if (evxContext.isTokenEndOfStatement(token)) {
            return Code.stmt(genThrowNotEnoughInputs(evxContext.getSrcmap(), "for"));
        }

        if (evxContext.isTokenEndOfStatement(evxContext.peekNextToken())) {
            return Code.stmt(genThrowNotEnoughInputs(evxContext.peekNextSrcmap(), "for"));
        }

        if (!logo.type.isLogoList(token)) {
            evxContext.rewindToAnchor();
            return;
        }

        token = token.map(sys.toNumberIfApplicable);

        let comp = logo.parse.parseBlock(logo.type.embedSrcmap(token, srcmap));
        let forLoopCtrl = logo.interpreter.makeEvalContext(comp);
        let forVarName = genLogoVarLref(forLoopCtrl.getToken());

        let forBeginStmt = genToken(forLoopCtrl.next());
        let forEndStmt = genToken(forLoopCtrl.next());
        let forStepStmt = forLoopCtrl.hasNext() ? genToken(forLoopCtrl.next()) : Code.expr("$ret=$forDecrease?-1:1");

        if (forBeginStmt == CODEGEN_CONSTANTS.NOP || forEndStmt == CODEGEN_CONSTANTS.NOP) {
            return Code.stmt("throwRuntimeLogoException(logo.type.LogoException.INVALID_INPUT,",
                logo.type.srcmapToJs(srcmap), ",['for','", logo.type.toString(token, true), "']);\n");
        }

        return Code.stmt("{")
            .append(forBeginStmt)
            .append(genValidateNumber(srcmap, token))
            .append("const $forBegin=sys.toNumberIfApplicable($ret);\n")
            .append(forEndStmt)
            .append(genValidateNumber(srcmap, token))
            .append("const $forEnd=sys.toNumberIfApplicable($ret);\n")
            .append("const $forDecrease = $forEnd < $forBegin;\n")
            .append(forStepStmt)
            .append(genValidateNumber(srcmap, token))
            .append("const $forStep=sys.toNumberIfApplicable($ret);\n")
            .append("if ((!$forDecrease && $forStep > 0) || ($forDecrease && $forStep < 0))\n")
            .append("for(", forVarName, "=$forBegin; ($forDecrease && ", forVarName, ">=$forEnd) || (!$forDecrease &&",
                forVarName, "<=$forEnd); ", forVarName, "+=$forStep) {\n")
            .append(genInstrList(evxContext.next(), "for", true, forSrcmap))
            .append("}}")
            .append("\n;$ret=undefined;");
    }

    function genValidateNumber(srcmap, token) {
        return Code.stmt(";\nlogo.type.validateNumber($ret,logo.type.LogoException.INVALID_INPUT,",
            logo.type.srcmapToJs(srcmap), ",['for','", logo.type.toString(token, true), "']);\n");
    }

    function genMake(evxContext) {
        evxContext.setAnchor();
        let token = evxContext.next().getToken();
        if (!logo.type.isQuotedLogoWord(token)) {
            evxContext.rewindToAnchor();
            return;
        }

        let varName = logo.env.extractVarName(token);

        return Code.stmt(genToken(evxContext.next()))
            .append(";\n")
            .append(genLogoVarLref(varName))
            .append("=$ret;$ret=undefined;");
    }

    function genLocalmake(evxContext) {
        evxContext.setAnchor();
        let token = evxContext.next().getToken();
        if (!logo.type.isQuotedLogoWord(token)) {
            evxContext.rewindToAnchor();
            return;
        }

        let varName = logo.env.extractVarName(token);
        let code = Code.stmt()
            .append(genToken(evxContext.next()))
            .append(";\n");

        if (!_varScopes.isLocalVar(varName)) {
            code = code.append("var ")
                .append(Code.expr(varName))
                .append(";\n");

            _varScopes.addVar(varName);
        }

        return code.append(Code.expr(varName))
            .append("=$ret;$ret=undefined;");
    }

    function genLogoVarRef(curToken, srcmap) {
        let varName = logo.env.extractVarName(curToken);
        return _varScopes.isLocalVar(varName) ?
            Code.expr("logo.lrt.util.logoVar(", varName, ", \"", varName, "\",", logo.type.srcmapToJs(srcmap),
                ")") :
            Code.expr("logo.lrt.util.logoVar(logo.env.findLogoVarScope(\"", varName, "\", $scopeCache)[\"",
                varName, "\"", "], \"", varName, "\",", logo.type.srcmapToJs(srcmap), ")");
    }

    function genLogoVarLref(varName) {
        return _varScopes.isLocalVar(varName) ? Code.expr(varName) :
            Code.expr("logo.env.findLogoVarScope('" + varName + "', $scopeCache)['" + varName + "']");
    }

    function genLogoSlotRef(curToken, srcmap) {
        let slotNum = logo.env.extractSlotNum(curToken);
        return Code.expr("logo.env.callPrimitive(\"?\",", logo.type.srcmapToJs(srcmap), ",", slotNum, ")");
    }

    function genInstrListCall(curToken, srcmap) {
        return Code.expr()
            .append("(")
            .append(genPrepareCall(logo.type.LAMBDA_EXPR, srcmap))
            .append("$ret);\n")
            .append("$ret=")
            .append(ASYNC_MACRO.CALL_LOGO_INSTR_LIST)
            .append(genLogoVarRef(curToken, srcmap))
            .append(");")
            .append("(")
            .append(genCompleteCall())
            .append("$ret);\n");
    }

    function insertDelimiters(param, delimiter) {
        let ret = param.map(v => [v, delimiter]).reduce((accumulator, currentValue) =>
            accumulator.concat(currentValue), []);
        ret.pop();
        return ret;
    }

    function containsPostFix(codeArray) {
        return codeArray.map(p => (p instanceof Code) && p.postFix())
            .reduce((acc, cur) => acc || cur, false);
    }

    function genUserProcCall(evxContext, curToken, srcmap) {
        let param = genUserProcCallParams(evxContext, curToken, logo.env._ws[curToken].formal.length);
        let postfix = logo.config.get("postfix") || containsPostFix(param);
        return !postfix ? genInfixUserProcCall(curToken, srcmap, param) :
            genPostfixUserProcCall(curToken, srcmap, param);
    }

    function genInfixUserProcCall(curToken, srcmap, param) {
        let code = Code.expr()
            .append("(")
            .append("\"", escape(curToken), "\" in logo.env._user ? (");

        if (param.length === 0)  {
            code = code.append(genPrepareCall(curToken, srcmap));
        } else {
            let lastParam = param.pop();
            lastParam = lastParam.prepend("($ret=")
                .append(",")
                .append(genPrepareCall(curToken, srcmap))
                .append("$ret)");

            param.push(lastParam);
        }

        return code.append("$ret=(", ASYNC_MACRO.AWAIT, "logo.env._user[\"", escape(curToken), "\"](")
            .append(Code.expr.apply(undefined, insertDelimiters(param, ",")))
            .append(")),")
            .append(genCompleteCall())
            .append("$ret)")
            .append(":")
            .append(genThrowUnknownProc(srcmap, curToken))
            .append(")");
    }

    function escape(token) {
        return token.replace(/"/g, "\\\"");
    }

    function genPostfixUserProcCall(curToken, srcmap, param) {
        let code = Code.expr();

        code.withPostFix(true);

        code.append("if (!(\"", escape(curToken),"\" in logo.env._user)) {")
            .append(genThrowUnknownProc(srcmap, curToken))
            .append("}\n");

        code.append("$param.begin([]);\n");

        param.map((p) => {
            code.append(p);
            code.append(";\n$param.add($ret);\n");
        });

        code.append(genPrepareCall(curToken, srcmap));
        code.append("$ret;\n");

        code.append("$ret=", ASYNC_MACRO.AWAIT, "logo.env._user[", "\"", escape(curToken), "\"",
            "].apply(undefined,$param.end());\n");

        code.append(genCompleteCall());
        code.append("$ret;\n");

        return code;
    }

    function genUserProcCallParams(evxContext, procName, paramListLength, precedence) {
        let param = [];
        for (let j = 0; j < paramListLength; j++) { // push actual parameters
            evxContext.next();
            param.push(genProcInput(evxContext, precedence, false, procName));
        }

        return param;
    }

    function isAsyncPrimitive(primitiveName) {
        return logo.lrt.primitive[primitiveName].constructor.name === "AsyncFunction";
    }

    function genPrimitiveCall(evxContext, curToken, srcmap, isInParen) {
        let param = genPrimitiveCallParams(evxContext, curToken, logo.lrt.util.getPrimitivePrecedence(curToken),
            isInParen);

        if (isAsyncPrimitive(curToken)) {
            logo.env.setAsyncFunctionCall(true);
        }

        if (!callLambda.has(curToken)) {

            let postfix = logo.config.get("postfix") || containsPostFix(param);

            return !postfix ? genInfixPrimitiveCall(curToken, srcmap, param).prepend("$ret=") :
                genPostfixPrimitiveCall(curToken, srcmap, param).prepend("$ret=");
        }

        return genPostfixPrimitiveCall(curToken, srcmap, param)
            .prepend("try {\n$ret=")
            .append("} catch (e) {\n")
            .append("if(logo.type.LogoException.is(e)){")
            .append((_funcName === TOP_LEVEL_FUNC) ?
                "if(e.isStop() || e.isOutput()){errorOnLogoException(e);return;}\n" :
                "if(e.isStop()) return;if(e.isOutput()) return e.getValue();\n")
            .append("}\n")
            .append("throw e;}\n");
    }

    function genInfixPrimitiveCall(curToken, srcmap, param) {
        let code = Code.expr();

        code.append("(");
        if (needStashLocalVars.has(curToken)) {
            code.append(genStashLocalVars());
        }

        code.append("($ret=");
        code.append(ASYNC_MACRO.CALL_PRIMITIVE);
        code.append("(\"");

        code.append(curToken, "\", ", logo.type.srcmapToJs(srcmap), ",");
        code.append(Code.expr.apply(undefined, insertDelimiters(param, ",")));
        code.append("))");

        if (needStashLocalVars.has(curToken)) {
            code.append(",");
            code.append(genApplyLocalVars());
            code.append("$ret");
        }

        code.append(")");

        return code;
    }

    function genPostfixPrimitiveCall(curToken, srcmap, param) {
        let code = Code.expr();

        code.withPostFix(true);
        if  (needStashLocalVars.has(curToken)) {
            code.append(genStashLocalVars());
        }

        code.append("$param.begin([\"", curToken,"\",", logo.type.srcmapToJs(srcmap), "]);\n");

        param.map((p) => {
            code.append(p);
            code.append(";\n$param.add($ret);\n");
        });

        code.append("$ret=");
        code.append(ASYNC_MACRO.CALL_PRIMITIVE);
        code.append(".apply(undefined,$param.end());\n");

        if  (needStashLocalVars.has(curToken)) {
            code.append(genApplyLocalVars());
            code.append("$ret;");
        }

        return code;
    }

    function genPrimitiveCallParams(evxContext, primitiveName, precedence = 0, isInParen = false) {
        let param = [];
        let paramListLength = logo.lrt.util.getPrimitiveParamCount(primitiveName);
        let paramListMinLength = logo.lrt.util.getPrimitiveParamMinCount(primitiveName);
        let paramListMaxLength = logo.lrt.util.getPrimitiveParamMaxCount(primitiveName);
        let j = 0;

        if (isInParen && (paramListMaxLength > paramListLength || paramListMaxLength == -1)) {
            for (; (j < paramListMaxLength || paramListMaxLength == -1) &&
                    (isInParen && evxContext.peekNextToken() != ")" ) && evxContext.next(); j++) {
                param.push(genProcInput(evxContext, precedence, false, primitiveName));
            }
        } else {
            for (; j < paramListLength && ((isInParen && evxContext.peekNextToken() != ")" ) || !isInParen) &&
                    evxContext.next(); j++) { // push actual parameters
                param.push(genProcInput(evxContext, precedence, false, primitiveName));
            }
        }

        if (j < paramListMinLength) {
            param.push(genThrowNotEnoughInputs(evxContext.getSrcmap(), primitiveName));
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

    function genToken(evxContext, precedence = 0, isInParen = false) {
        return genTokenHelper(evxContext, isInParen).appendBinaryOperatorExprs(evxContext, precedence);
    }

    function genTokenHelper(evxContext, isInParen) {
        let curToken = evxContext.getToken();
        let srcmap = evxContext.getSrcmap();

        if (evxContext.isTokenEndOfStatement(curToken)) {
            evxContext.endOfStatement = true;
            return CODEGEN_CONSTANTS.NOP; // make sure eval() returns undefined
        }

        if (logo.type.isNumericConstant(curToken)) {
            return Code.expr(Number(curToken)).captureRetVal();
        } else if (logo.type.isStopStmt(curToken)) {
            return (!_isLambda) ? Code.expr("return") :
                Code.expr("throwRuntimeLogoException(logo.type.LogoException.STOP,", logo.type.srcmapToJs(srcmap), ",[\"",
                    curToken, "\"])");
        } else if (logo.type.isOutputStmt(curToken)) {
            return (!_isLambda) ? Code.expr(genToken(evxContext.next())).append(";return $ret") :
                genThrowOutputException(evxContext);
        } else if (logo.type.isOpenParen(curToken)) {
            return genParen(evxContext);
        } else if (logo.type.isCompoundObj(curToken)) {
            return genCompoundObj(curToken, srcmap);
        } else if (logo.type.isQuotedLogoWord(curToken)) {
            return Code.expr(logo.type.quotedLogoWordToJsStringLiteral(curToken)).captureRetVal();
        } else if (logo.type.isLogoVarRef(curToken)) {
            return Code.expr(genLogoVarRef(curToken, srcmap)).captureRetVal();
        } else if (logo.type.isLogoSlot(curToken)) {
            evxContext.proc = "?";
            return Code.expr(genLogoSlotRef(curToken, srcmap)).captureRetVal();
        } else { // call
            evxContext.proc = curToken;
            return genCall(evxContext, curToken, srcmap, isInParen);
        }
    }

    function genThrowOutputException(evxContext) {
        let srcmap = evxContext.getSrcmap();
        let nextTokenCode = genToken(evxContext.next());
        let postfix = logo.config.get("postfix") || nextTokenCode.postFix();
        if (!postfix) {
            return Code.expr("throwRuntimeLogoException(logo.type.LogoException.OUTPUT,", logo.type.srcmapToJs(srcmap), ",[")
                .append(nextTokenCode)
                .append("])");
        }

        return nextTokenCode.append(";")
            .append("throwRuntimeLogoException(logo.type.LogoException.OUTPUT,", logo.type.srcmapToJs(srcmap), ",[$ret]);");
    }

    function genThrowNoOutput(evxContext, procName) {
        return Code.expr()
            .append("throwRuntimeLogoException(logo.type.LogoException.NO_OUTPUT,")
            .append(logo.type.srcmapToJs(evxContext.getSrcmap()))
            .append(",['", evxContext.proc, "','", procName, "'])");
    }

    function genProcInput(evxContext, precedence, isInParen, procName) {
        let procInput = genToken(evxContext, precedence, isInParen);
        if (procInput == CODEGEN_CONSTANTS.NOP) {
            return genThrowNotEnoughInputs(evxContext.getSrcmap(), procName);
        }

        if (!procInput.postFix()) {
            return procInput.prepend("($ret=")
                .append(",($ret===undefined?")
                .append(genThrowNoOutput(evxContext, procName))
                .append(":$ret))");
        }

        return procInput.append(";\nif($ret===undefined)")
            .append(genThrowNoOutput(evxContext, procName))
            .append(";\n");
    }

    function genBody(evxContext, isInstrList) {
        let code = Code.expr();

        do {
            let codeFromToken = genToken(evxContext);
            code.append(codeFromToken);
            code.append(";\n");
            if (codeFromToken.isExpr() && logo.config.get("unactionableDatum") && (!isInstrList || evxContext.hasNext())) {
                code.append("checkUnactionableDatum($ret,", logo.type.srcmapToJs(evxContext.getSrcmap()), ");\n");
            }

        } while (!evxContext.next().isEol());

        return code;
    }

    function genInstrListLambdaDeclCode(evxContext, param) {
        _isLambda = true;
        _varScopes.enter();
        let code = Code.expr();
        code.append("(", ASYNC_MACRO.ASYNC, "(");

        if (param !== undefined) {
            code.append(Code.expr.apply(undefined, insertDelimiters(param, ",")));
            param.forEach(v => _varScopes.addVar(v));
        }

        code.append(")=>{");

        code.append("let $scopeCache = {};\n");

        if (param !== undefined) {
            code.append("let $scope = {}; logo.env._scopeStack.push($scope);\n");
        } else {
            code.append("let $scope = logo.env._scopeStack[logo.env._scopeStack.length - 1];\n");
        }

        code.append(genBody(evxContext, true));

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
        logo.trace.info(mergedCode, "codegen.lambda");
        return mergedCode;
    }
    codegen.genInstrListLambdaDeclCode = genInstrListLambdaDeclCode;

    function genParen(evxContext) {
        let code = Code.expr();

        let codeFromToken = genToken(evxContext.next(), 0, true);
        code.append(codeFromToken);

        if (evxContext.next().getToken() != ")") {
            code.append(
                "(throwRuntimeLogoException(",
                "logo.type.LogoException.TOO_MUCH_INSIDE_PAREN,",
                logo.type.srcmapToJs(evxContext.getSrcmap()),
                "))");
        }

        return code;
    }

    function genTopLevelCode(p) {

        let oldFuncName = _funcName;
        _funcName = TOP_LEVEL_FUNC;
        _isLambda = false;

        let evxContext = logo.interpreter.makeEvalContext(logo.parse.parseBlock(p));

        _varScopes.enter();
        let code = genBody(evxContext).merge();
        logo.trace.info(code, "codegen");
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
        let code = Code.expr();

        if (logo.config.get("dynamicScope")) {
            code.append(genStashLocalVars());
        }

        code.append("logo.env._callstack.push([logo.env._curProc," + logo.type.srcmapToJs(srcmap) + "]),");
        code.append("logo.env._curProc=\"", escape(target), "\",\n");

        return code;
    }

    function genCompleteCall() {
        let code = Code.expr();
        code.append("logo.env._curProc=logo.env._callstack.pop()[0],");
        if (logo.config.get("dynamicScope")) {
            code.append(genApplyLocalVars());
        }

        return code;
    }

    function genStashLocalVars() {
        let code = Code.expr();
        _varScopes.localVars().forEach((varName) =>
            code.append("($scope['", varName, "']=", varName, "),"));

        return code;
    }

    function genApplyLocalVars() {
        let code = Code.expr();
        _varScopes.localVars().forEach(varName =>
            code.append("(", varName, "=$scope['", varName, "']),"));

        return code;
    }

    function genProc(proc, srcmap) {
        sys.assert(logo.type.isLogoProc(proc));
        sys.assert(logo.type.isLogoProc(srcmap));

        logo.env.defineLogoProcBody(proc, srcmap);

        let procName = logo.type.getLogoProcName(proc);
        _isLambda = false;

        return genProcBody(procName, logo.type.getLogoProcParams(proc), logo.type.getLogoProcBodyWithSrcmap(proc, srcmap))
            .prepend("logo.env._user[\"", escape(procName), "\"]=");
    }
    codegen.genProc = genProc;

    function genProcText(template) {
        let procName = "";
        let params = logo.type.formalFromProcText(template);
        let body = logo.type.bodyFromProcText(template);
        let bodySrcmap = logo.type.bodySrcmapFromProcText(template);
        _isLambda = false;
        let code = genProcBody(procName, params, logo.type.embedSrcmap(body, bodySrcmap))
            .prepend("(")
            .append(")");

        return code;
    }
    codegen.genProcText = genProcText;

    function genProcBody(procName, params, body) {
        let code = Code.expr();
        code.append(ASYNC_MACRO.ASYNC, "function");

        let oldFuncName = _funcName;
        _funcName = procName;

        let evxContext = logo.interpreter.makeEvalContext(logo.parse.parseBlock(body));

        code.append("(");
        code.append(Code.expr.apply(undefined, insertDelimiters(params, ",")));
        code.append(")");
        code.append("{\n");
        code.append("let $ret, $param = logo.env.createParamScope();\n");

        if (logo.config.get("dynamicScope")) {
            code.append("let $scope = {}, $scopeCache = {};\n");
            code.append("logo.env._scopeStack.push($scope);\n");
        }

        _varScopes.enter();
        params.forEach(v => _varScopes.addVar(v));
        code.append(genBody(evxContext));
        _varScopes.exit();

        code.append("logo.env._scopeStack.pop();\n");
        code.append("}\n");

        _funcName = oldFuncName;
        return code;
    }

    function genThrowNotEnoughInputs(srcmap, procName) {
        return Code.expr("throwRuntimeLogoException(logo.type.LogoException.NOT_ENOUGH_INPUTS,",
            logo.type.srcmapToJs(srcmap), ",[ \"", escape(procName), "\"])");
    }

    function genThrowUnknownProc(srcmap, procName) {
        return Code.expr("throwRuntimeLogoException(logo.type.LogoException.UNKNOWN_PROC,",
            logo.type.srcmapToJs(srcmap), ",[ \"", escape(procName), "\"])");
    }

    function genCompoundObj(curToken, srcmap) {
        let code = Code.expr();
        if (!logo.type.isLogoProc(curToken)) {
            code.append("$ret=");
        }

        code.append(logo.type.isLogoProc(curToken) ? genProc(curToken, srcmap) :
            logo.type.isLogoArray(curToken) ?  genArray(curToken, srcmap) :
                genLogoList(curToken, srcmap));

        return code;
    }

    function genCall(evxContext, curToken, srcmap, isInParen) {
        let code = Code.expr();

        let nativeJsCode = undefined;
        if (curToken in genNativeJs && (nativeJsCode = genNativeJs[curToken](evxContext, isInParen)) !== undefined) {
            if (nativeJsCode.isExpr()) {
                code.append("$ret=");
            }

            code.append(nativeJsCode);
        } else if (curToken in logo.lrt.primitive) {
            code.append(genPrimitiveCall(evxContext, curToken, srcmap, isInParen));
        } else if (curToken in logo.env._ws) {
            code.append(genUserProcCall(evxContext, curToken, srcmap));
        } else {
            code.append(genThrowUnknownProc(srcmap, curToken));
        }

        return code;
    }

    return codegen;
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
