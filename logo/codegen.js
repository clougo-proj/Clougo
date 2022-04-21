//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Transpiles parsed Logo code into JavaScript
// Runs in browser's Logo worker thread or Node's main thread

export default {
    "create": function(logo, sys) {

        const TOP_LEVEL_FUNC = "";

        const PROC_PARAM = logo.constants.PROC_PARAM;

        const codegen = {};

        let _funcName = TOP_LEVEL_FUNC;

        let _isLambda = false;

        let _async = false;

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
            "run": genRun,
            "if": genIf,
            "while": genWhile,
            "catch": genCatch,
            "ifelse": genIfElse,
            "make": genMake,
            "localmake": genLocalmake,
            "local": genLocal,
            "repeat": genRepeat,
            "for": genFor,
            "pi": genPi
        };

        const CODE_TYPE = {
            EXPR: 0,
            STMT: 1,
            ASYNC_MACRO: 2
        };

        class Code {
            constructor(rawCodeArray, codeType, postfix = false) {
                this._code = rawCodeArray.slice(0);
                this._codeType = codeType;
                this._postFix = postfix;
            }

            static expr(...rawCode) {
                return new Code(rawCode, CODE_TYPE.EXPR);
            }

            static stmt(...rawCode) {
                return new Code(rawCode, CODE_TYPE.STMT, true);
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
                    return (_async || logo.config.get("asyncCall")) ? ASYNC_MACRO_CODE[key][0] : ASYNC_MACRO_CODE[key][1];
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
                return this.prepend("(", quoteToken(nextOp), ",", logo.type.srcmapToJs(nextOpSrcmap), ",")
                    .prepend(ASYNC_MACRO.CALL_PRIMITIVE_OPERATOR)
                    .prepend("($ret=")
                    .append(",")
                    .append(nextOpnd)
                    .append("))");
            }

            appendPostfixBinaryOperatorExpr(nextOp, nextOpnd, nextOpSrcmap) {
                return this.withPostFix(true)
                    .prepend("$param.begin([", quoteToken(nextOp), ",", logo.type.srcmapToJs(nextOpSrcmap), "]);\n")
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
            "CALL_PROC": Code.asyncMacro("CALL_PROC"),
            "CALL_PRIMITIVE_OPERATOR": Code.asyncMacro("CALL_PRIMITIVE_OPERATOR"),
            "CALL_LOGO_INSTR_LIST": Code.asyncMacro("CALL_LOGO_INSTR_LIST")
        };

        const ASYNC_MACRO_CODE = {
            "ASYNC": ["async ", ""],
            "AWAIT": ["await ", ""],
            "CALL_PROC": ["callProcAsync", "callProc"],
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

            while ((generatedParams < expectedParams || isInParen) && evxContext.peekNextToken() != logo.type.CLOSE_PAREN &&
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
                code.append(toJsVarName(varName));

                generatedParams++;
            }

            code.append(";");
            logo.trace.info("VARNAME=" + varName, "codegen.genLocal");

            return code;
        }

        function toJsVarName(varName) {
            return "_" + varName.replace(/([^1-9a-z])/g, (p1) => "_" + p1.charCodeAt(0) + "_");
        }

        function genInstrList(evxContext, procName, parentSrcmap = undefined, allowUnusedValue = false) {
            return genInstrListHelper(evxContext.getToken(), evxContext.getSrcmap(), procName,
                parentSrcmap, allowUnusedValue);
        }

        function genInstrListFromTemplate(template, procName) {
            return genInstrListHelper(template, logo.type.getEmbeddedSrcmap(template), procName,
                logo.type.getEmbeddedSrcmap(template), true);
        }

        function genInstrListHelper(curToken, srcmap, procName, parentSrcmap, allowUnusedValue = false) {
            let code = Code.expr();

            if (sys.isUndefined(curToken) || curToken === logo.type.NEWLINE) {
                code.append(genThrowNotEnoughInputs(srcmap, procName));
            } else if (logo.type.isLogoList(curToken)) {
                let comp = logo.parse.parseBlock(logo.type.embedSrcmap(curToken, srcmap));
                code.append(genBody(logo.interpreter.makeEvalContext(comp), allowUnusedValue))
                    .prepend("$ret=undefined;");
            } else {
                code.append(genInstrListCall(curToken, parentSrcmap));
            }

            return code;
        }

        function genRun(evxContext) {
            if (!logo.type.isLogoList(evxContext.peekNextToken())) {
                return;
            }

            return Code.stmt("{", genInstrList(evxContext.next(), "run", undefined, true), "}");
        }

        function genIf(evxContext) {
            let code = Code.stmt();

            evxContext.setAnchor();

            let srcmap = evxContext.getSrcmap();

            code.append(genProcInput(evxContext.next(), 0, false, "if"));

            code.append(";\n");
            code.append("if (logo.type.isLogoBooleanTrue($ret,'if',", logo.type.srcmapToJs(srcmap), ")) {\n");

            if (!logo.type.isLogoList(evxContext.peekNextToken())) {
                evxContext.rewindToAnchor();
                return;
            }

            code.append(genInstrList(evxContext.next(), "if"));
            code.append("}");
            code.append("\n;$ret=undefined;");

            return code;
        }


        function genWhile(evxContext) {
            evxContext.setAnchor();

            let srcmap = evxContext.getSrcmap();

            let code = Code.stmt().append("let $while_cond=", ASYNC_MACRO.ASYNC, "()=>{")
                .append(genInstrList(evxContext.next(), "while", undefined, true).captureRetVal())
                .append("return $ret};\n")
                .append("while (logo.type.isLogoBooleanTrue(")
                .append(ASYNC_MACRO.AWAIT, "$while_cond(),'while',")
                .append(logo.type.srcmapToJs(srcmap))
                .append(")) {\n");

            if (!logo.type.isLogoList(evxContext.peekNextToken())) {
                evxContext.rewindToAnchor();
                return;
            }

            return code.append(genInstrList(evxContext.next(), "if"))
                .append("}")
                .append("\n;$ret=undefined;");
        }

        function genCatch(evxContext) {
            let code = Code.stmt();

            evxContext.setAnchor();

            if (!logo.type.isQuotedLogoWord(evxContext.peekNextToken())) {
                return;
            }

            let label = genProcInput(evxContext.next(), 0, false, "catch");

            if (!label.postFix()) {
                code.append("let $label=", label, ";\n");
            } else {
                code.append(label)
                    .append("\nlet $label=$ret;\n");
            }

            code.append("try {\n");

            if (!logo.type.isLogoList(evxContext.peekNextToken())) {
                evxContext.rewindToAnchor();
                return;
            }

            code.append(genInstrList(evxContext.next(), "catch"));
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

            evxContext.setAnchor();

            let srcmap = evxContext.getSrcmap();

            code.append(genProcInput(evxContext.next(), 0, false, "ifelse"));

            code.append(";\n");
            code.append("if (logo.type.isLogoBooleanTrue($ret,'ifelse',", logo.type.srcmapToJs(srcmap), ")) {\n");

            if (!logo.type.isLogoList(evxContext.peekNextToken())) {
                evxContext.rewindToAnchor();
                return;
            }

            code.append(genInstrList(evxContext.next(), "ifelse"));
            code.append("} else {\n");

            if (!logo.type.isLogoList(evxContext.peekNextToken())) {
                evxContext.rewindToAnchor();
                return;
            }

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
                return Code.stmt(genThrowException(logo.type.LogoException.INVALID_INPUT,
                    srcmap, quoteToken("for"), quoteToken(logo.type.toString(token, true))), ";\n");
            }

            if (!logo.type.isLogoList(evxContext.peekNextToken())) {
                evxContext.rewindToAnchor();
                return;
            }

            return Code.stmt("{")
                .append(forBeginStmt)
                .append(";")
                .append(genValidateNumber(srcmap, token))
                .append("const $forBegin=sys.toNumberIfApplicable($ret);\n")
                .append(forEndStmt)
                .append(";")
                .append(genValidateNumber(srcmap, token))
                .append("const $forEnd=sys.toNumberIfApplicable($ret);\n")
                .append("const $forDecrease = $forEnd < $forBegin;\n")
                .append(forStepStmt)
                .append(";")
                .append(genValidateNumber(srcmap, token))
                .append("const $forStep=sys.toNumberIfApplicable($ret);\n")
                .append("if ((!$forDecrease && $forStep > 0) || ($forDecrease && $forStep < 0))\n")
                .append("for(", forVarName, "=$forBegin; ($forDecrease && ", forVarName, ">=$forEnd) || (!$forDecrease &&",
                    forVarName, "<=$forEnd); ", forVarName, "+=$forStep) {\n")
                .append(genInstrList(evxContext.next(), "for", forSrcmap))
                .append("}}")
                .append("\n;$ret=undefined;");
        }

        function genValidateNumber(srcmap, token) {
            return Code.stmt("logo.type.validateNumber($ret,logo.type.LogoException.INVALID_INPUT,",
                logo.type.srcmapToJs(srcmap), ",['for','", logo.type.toString(token, true), "']);\n");
        }

        function genCheckAndThrowNoOutput(evxContext, funcName) {
            return Code.expr("=($ret===undefined?", genThrowNoOutput(evxContext, funcName), ":$ret)");
        }

        function genMake(evxContext) {
            evxContext.setAnchor();
            let token = evxContext.next().getToken();
            if (!logo.type.isQuotedLogoWord(token)) {
                evxContext.rewindToAnchor();
                return;
            }

            let varName = logo.env.extractVarName(token);
            let nextTokenCode = genToken(evxContext.next());
            if (logo.config.get("postfix") || nextTokenCode.postFix()) {
                return Code.stmt(nextTokenCode)
                    .append(";\n")
                    .append(genLogoVarLref(varName))
                    .append(genCheckAndThrowNoOutput(evxContext, "make"))
                    .append(";$ret=undefined;");
            }

            return Code.expr(nextTokenCode)
                .prepend("(")
                .append(",")
                .append(genLogoVarLref(varName))
                .append(genCheckAndThrowNoOutput(evxContext, "make"))
                .append(",$ret=undefined)");
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
                    .append(Code.expr(toJsVarName(varName)))
                    .append(";\n");

                _varScopes.addVar(varName);
            }

            return code.append(Code.expr(toJsVarName(varName)))
                .append(genCheckAndThrowNoOutput(evxContext, "localmake"))
                .append(";$ret=undefined;");
        }

        function genLogoVarRef(curToken, srcmap) {
            let varName = logo.env.extractVarName(curToken);
            return _varScopes.isLocalVar(varName) ?
                Code.expr("logo.env.logoVar(", toJsVarName(varName), ",", quoteToken(varName), ",", logo.type.srcmapToJs(srcmap),
                    ")") :
                Code.expr("logo.env.logoVar(logo.env.findLogoVarScope(", quoteToken(varName), ",$scopeCache)[",
                    quoteToken(varName), "],", quoteToken(varName), ",", logo.type.srcmapToJs(srcmap), ")");
        }

        function genLogoVarLref(varName) {
            return _varScopes.isLocalVar(varName) ? Code.expr(toJsVarName(varName)) :
                Code.expr("logo.env.findLogoVarScope('" + varName + "', $scopeCache)['" + varName + "']");
        }

        function genLogoSlotRef(curToken, srcmap) {
            let slotNum = logo.env.extractSlotNum(curToken);
            return Code.expr("logo.env.callProc(\"?\",", logo.type.srcmapToJs(srcmap), ",", slotNum, ")");
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

        function genInfixProcCall(curToken, srcmap, param) {
            let code = Code.expr("(");

            if (!logo.env.isPrimitive(curToken)) {
                code = code.append("logo.env.existsProcJsFunc(", quoteToken(escapeProcName(curToken)), ")?(")
                    .append(genPrepareCall(curToken, srcmap));

            } else if (logo.env.requiresStashLocalVar(curToken)) {
                code = code.append(genStashLocalVars());
            }

            code = code.append("$ret=", ASYNC_MACRO.AWAIT, "logo.env.", ASYNC_MACRO.CALL_PROC, "(")
                .append(quoteToken(escapeProcName(curToken)), ",", logo.type.srcmapToJs(srcmap), ",")
                .append(Code.expr.apply(undefined, insertDelimiters(param, ",")))
                .append("),");

            if (!logo.env.isPrimitive(curToken)) {
                code = code.append(genCompleteCall())
                    .append("$ret):", genThrowUnknownProc(srcmap, curToken));
            } else if (logo.env.requiresStashLocalVar(curToken)) {
                code = code.append(genApplyLocalVars())
                    .append("$ret");
            } else {
                code = code.append("$ret");
            }

            return code.append(")");
        }

        function escapeProcName(token) {
            return token.replace(/"/g, "\\\"");
        }

        function genPostfixProcCall(curToken, srcmap, param) {
            let code = Code.expr().withPostFix(true);

            if (!logo.env.isPrimitive(curToken)) {
                code = code.append("if (!logo.env.existsProcJsFunc(", quoteToken(escapeProcName(curToken)), ")) {")
                    .append(genThrowUnknownProc(srcmap, curToken))
                    .append("}\n")
                    .append(genPrepareCall(curToken, srcmap));

            } else if (logo.env.requiresStashLocalVar(curToken)) {
                code = code.append(genStashLocalVars());
            }

            code.append("$param.begin([")
                .append(quoteToken(escapeProcName(curToken)), ",", logo.type.srcmapToJs(srcmap), ",")
                .append("]);\n");

            param.map((p) => {
                code = code.append(p)
                    .append(";\n$param.add($ret);\n");
            });

            code.append("$ret;\n");
            code = code.append("$ret=", ASYNC_MACRO.AWAIT, "logo.env.", ASYNC_MACRO.CALL_PROC, ".apply(undefined,$param.end());\n");

            if (!logo.env.isPrimitive(curToken)) {
                code = code.append(genCompleteCall());
            } else if (logo.env.requiresStashLocalVar(curToken)) {
                code = code.append(genApplyLocalVars());
            }

            return code.append("$ret;\n");
        }

        function isRequiredParam(formal, index) {
            return formal.paramTemplates[index] === undefined;
        }

        function genProcCallParams(evxContext, procName, formal, precedence, isInParen) {
            let param = [];
            let j = 0;

            while (evxContext.peekNextToken() !== logo.type.CLOSE_PAREN &&
                (paramNotCompleteWithoutParen() || paramNotCompleteWithinParen())) {

                evxContext.next();
                param.push(genProcInput(evxContext, precedence, false, procName, isRequiredParam(formal, j)));
                j++;
            }

            if (j < formal.minInputCount) {
                param.push(genThrowNotEnoughInputs(evxContext.getSrcmap(), procName));
            }

            if (restParamNotEmpty()) {
                for (let j = formal.length; j < formal.defaultInputCount; j++) {
                    evxContext.next();
                    param.push(genProcInput(evxContext, precedence, false, procName, true));
                }
            }

            return param;

            function restParamNotEmpty() {
                return  formal.restParam !== undefined && formal.params.length < formal.defaultInputCount &&
                    !(isInParen && evxContext.peekNextToken() == logo.type.CLOSE_PAREN);
            }

            function paramNotCompleteWithinParen() {
                return isInParen && evxContext.peekNextToken() != logo.type.CLOSE_PAREN &&
                    ((formal.maxInputCount > formal.defaultInputCount && j < formal.maxInputCount) ||
                        formal.maxInputCount === PROC_PARAM.UNLIMITED || j < formal.defaultInputCount);
            }

            function paramNotCompleteWithoutParen() {
                return !isInParen && j < formal.length && j < formal.defaultInputCount;
            }
        }

        function genReturnInLambda(code) {
            return code.prepend("try {")
                .append("} catch (e) {\n")
                .append(genApplyLocalVars(), "$ret;\n")
                .append("if(logo.type.LogoException.is(e)){")
                .append((_funcName === TOP_LEVEL_FUNC) ?
                    "if(e.isStop() || e.isOutput()){errorOnLogoException(e);return;}\n" :
                    "if(e.isStop()) return;if(e.isOutput()) return e.getValue();\n")
                .append("}\n")
                .append("throw e;}\n");
        }

        function genProcCall(evxContext, curToken, srcmap, isInParen) {
            if (logo.env.isAsyncProc(curToken) || logo.env.isMacro(curToken) || !logo.env.isProc(curToken)) {
                _async = true;
            }

            let param = genProcCallParams(evxContext, curToken, logo.env.getProcParsedFormal(curToken),
                logo.env.getPrecedence(curToken), isInParen);

            if (logo.env.procReturnsInLambda(curToken)) {
                return genReturnInLambda(genPostfixProcCall(curToken, srcmap, param));
            }

            if (logo.config.get("postfix") || containsPostFix(param)) {
                return genPostfixProcCall(curToken, srcmap, param);
            }

            return genInfixProcCall(curToken, srcmap, param).prepend("$ret=");
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
                return (!_isLambda) ? Code.expr("return") : genThrowException(logo.type.LogoException.STOP, srcmap, quoteToken(curToken));
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
                curToken = logo.type.toString(curToken);
                evxContext.proc = curToken;
                return genCall(evxContext, curToken, srcmap, isInParen);
            }
        }

        function genThrowOutputException(evxContext) {
            let srcmap = evxContext.getSrcmap();
            let nextTokenCode = genToken(evxContext.next());
            let postfix = logo.config.get("postfix") || nextTokenCode.postFix();
            if (!postfix) {
                return genThrowOutput(srcmap, nextTokenCode);
            }

            return nextTokenCode.append(";")
                .append(genThrowOutput(srcmap, "$ret"))
                .append(";");
        }

        function genThrowNoOutput(evxContext, procName) {
            return genThrowException(logo.type.LogoException.NO_OUTPUT, evxContext.getSrcmap(),
                quoteToken(evxContext.proc), quoteToken(procName));
        }

        function genProcInput(evxContext, precedence, isInParen, procName, throwsNotEnoughInputs = true) {
            if (logo.lrt.util.isOnlyBinaryOperator(evxContext.getToken())) {
                return genThrowNotEnoughInputs(evxContext.getSrcmap(), procName);
            }

            let procInput = genToken(evxContext, precedence, isInParen);
            if (procInput == CODEGEN_CONSTANTS.NOP) {
                return throwsNotEnoughInputs ? genThrowNotEnoughInputs(evxContext.getSrcmap(), procName) :
                    Code.expr("$ret=undefined");
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

        function genBody(evxContext, allowUnusedValue) {
            let code = Code.expr();

            do {
                let codeFromToken = genToken(evxContext);
                code.append(codeFromToken);
                code.append(";\n");
                if (codeFromToken.isExpr() && logo.config.get("unusedValue") && (!allowUnusedValue || evxContext.hasNext())) {
                    code.append("checkUnusedValue($ret,", logo.type.srcmapToJs(evxContext.getSrcmap()), ");\n");
                }

            } while (!evxContext.next().isEol());

            return code;
        }

        function genInstrListLambdaDeclCode(evxContext, param) {
            _isLambda = true;
            _async = false;
            _varScopes.enter();
            let code = Code.expr();
            code.append("(", ASYNC_MACRO.ASYNC, "(");

            if (param !== undefined && param.length > 0) {
                code.append(Code.expr.apply(undefined, insertDelimiters(param.map((v) => toJsVarName(v)), ",")));
                param.forEach(v => _varScopes.addVar(v));
            }

            code.append(")=>{");

            code.append("let $scopeCache = {};\n");

            if (param !== undefined) {
                code.append("let $scope = {}; logo.env.scopeStackPush($scope);\n");
            } else {
                code.append("let $scope = logo.env.curScope();\n");
            }

            code.append("$ret=undefined;\n");
            code.append(genBody(evxContext, true));

            code.append("(");
            code.append(genStashLocalVars());
            code.append("$ret);");

            if (param !== undefined) {
                code.append("logo.env.scopeStackPop();\n");
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

            if (evxContext.next().getToken() != logo.type.CLOSE_PAREN) {
                code.append(genThrowException(logo.type.LogoException.TOO_MUCH_INSIDE_PAREN, evxContext.getSrcmap()));
            }

            return code;
        }

        function genTopLevelCode(p) {

            let oldFuncName = _funcName;
            _funcName = TOP_LEVEL_FUNC;
            _isLambda = false;

            let evxContext = logo.interpreter.makeEvalContext(logo.parse.parseBlock(p));

            _async = false;
            _varScopes.enter();
            let code = genBody(evxContext).merge();
            logo.trace.info(code, "codegen");
            _varScopes.exit();

            let ret = "$scopeCache={};" +
                    "logo.env.bindJsProc('$',async function(){\n" +
                    "let $scope={},$scopeCache={};\n" +
                    "logo.env.scopeStackPush($scope);\n" +
                    code + "logo.env.scopeStackPop();})";

            _funcName = oldFuncName;
            return ret;
        }
        codegen.genTopLevelCode = genTopLevelCode;

        function genPrepareCall(target, srcmap) {
            let code = Code.expr();
            if (logo.config.get("dynamicScope")) {
                code.append(genStashLocalVars());
            }

            code.append("logo.env.prepareCallProc(", quoteToken(escapeProcName(target)), ",", logo.type.srcmapToJs(srcmap), "),");
            return code;
        }

        function genCompleteCall() {
            let code = Code.expr();
            code.append("logo.env.completeCallProc(),");
            if (logo.config.get("dynamicScope")) {
                code.append(genApplyLocalVars());
            }

            return code;
        }

        function genStashLocalVars() {
            let code = Code.expr();
            _varScopes.localVars().forEach((varName) =>
                code.append("($scope['", varName, "']=", toJsVarName(varName), "),"));

            return code;
        }

        function genApplyLocalVars() {
            let code = Code.expr();
            _varScopes.localVars().forEach(varName =>
                code.append("(", toJsVarName(varName), "=$scope['", varName, "']),"));

            return code;
        }

        function genProc(proc, srcmap) {
            sys.assert(logo.type.isLogoProc(proc));
            sys.assert(logo.type.isLogoProc(srcmap));

            logo.env.defineLogoProcBody(proc, srcmap);

            let procName = logo.type.getLogoProcName(proc);
            _isLambda = false;

            return genProcBody(procName, logo.env.getProcParsedFormal(procName), logo.type.getLogoProcBodyWithSrcmap(proc, srcmap))
                .prepend("logo.env.bindJsProc(", quoteToken(escapeProcName(procName)), ",(")
                .append("));");
        }
        codegen.genProc = genProc;

        function genProcText(template) {
            let procName = "";
            let params = logo.type.formalFromProcText(template);
            let body = logo.type.bodyFromProcText(template);
            let bodySrcmap = logo.type.bodySrcmapFromProcText(template);
            _isLambda = false;
            let code = genProcBody(procName,
                logo.env.makeFormal(params.length, params.length, params.length, params.length, params, [], undefined),
                logo.type.embedSrcmap(body, bodySrcmap))
                .prepend("(")
                .append(")");

            return code;
        }
        codegen.genProcText = genProcText;

        function genRestParamDecl(formal) {
            let code = Code.expr();
            if (formal.restParam !== undefined) {
                if (formal.params.length > 0) {
                    code.append(",");
                }

                code.append("...", toJsVarName(formal.restParam));
            }

            return code;
        }

        function genConvertRestParamToLogoList(formal) {
            if (formal.restParam !== undefined) {
                _varScopes.addVar(formal.restParam);
                return Code.expr(toJsVarName(formal.restParam), "=logo.type.makeLogoList(", toJsVarName(formal.restParam), ");\n");
            }
        }

        function genOptionalInputDefault(formal, procName) {
            let code = Code.expr();
            if (formal.params !== undefined) {
                for (let i = formal.minInputCount; i < formal.params.length; i++) {
                    code.append("if(", toJsVarName(formal.params[i]), "===undefined){")
                        .append(genInstrListFromTemplate(formal.paramTemplates[i], procName))
                        .append(toJsVarName(formal.params[i]))
                        .append("=$ret;}\n");
                }
            }

            return code;
        }

        function genProcBody(procName, formal, body) {
            let code = Code.expr();
            code.append(ASYNC_MACRO.ASYNC, "function");

            let oldFuncName = _funcName;
            _funcName = procName;

            let evxContext = logo.interpreter.makeEvalContext(logo.parse.parseBlock(body));

            code.append("(");
            code.append(Code.expr.apply(undefined, insertDelimiters(formal.params.map((v) => toJsVarName(v)), ",")));
            code.append(genRestParamDecl(formal));

            code.append(")");
            code.append("{\n");
            code.append("let $ret, $param = logo.env.createParamScope();\n");

            if (logo.config.get("dynamicScope")) {
                code.append("let $scope = {}, $scopeCache = {};\n");
                code.append("logo.env.scopeStackPush($scope);\n");
            }

            _varScopes.enter();
            formal.params.forEach(v => _varScopes.addVar(v));
            code.append(genOptionalInputDefault(formal, procName));
            code.append(genConvertRestParamToLogoList(formal));
            code.append(";$ret=undefined;");
            code.append(genBody(evxContext));
            _varScopes.exit();

            code.append("logo.env.scopeStackPop();\n");
            code.append("}\n");

            _funcName = oldFuncName;
            return code;
        }

        function quoteToken(s) {
            return "\"" + s + "\"";
        }

        function genThrowNotEnoughInputs(srcmap, procName) {
            return genThrowException(logo.type.LogoException.NOT_ENOUGH_INPUTS, srcmap, quoteToken(escapeProcName(procName)));
        }

        function genThrowUnknownProc(srcmap, procName) {
            return genThrowException(logo.type.LogoException.UNKNOWN_PROC, srcmap, quoteToken(escapeProcName(procName)));
        }

        function genThrowException(logoException, srcmap, ...param) {
            return Code.expr("(throwRuntimeLogoException(logo.type.LogoException.", logoException.name(), ",")
                .append(logo.type.srcmapToJs(srcmap))
                .append(",[")
                .append(Code.expr.apply(undefined, insertDelimiters(param, ",")))
                .append("]))");
        }

        function genThrowOutput(srcmap, value) {
            return Code.expr("(throwRuntimeLogoException(logo.type.LogoException.OUTPUT,")
                .append(logo.type.srcmapToJs(srcmap))
                .append(",")
                .append(value)
                .append("))");
        }

        function genCompoundObj(curToken, srcmap) {
            let code = Code.expr();
            if (!logo.type.isLogoProc(curToken)) {
                code.append("$ret=");
            }

            if (logo.type.isLogoProc(curToken)) {
                code.append(genProc(curToken, srcmap));
            } else if (logo.type.isLogoArray(curToken)) {
                code.append(genArray(curToken, srcmap));
            } else if (logo.type.isLogoList(curToken)) {
                code.append(genLogoList(curToken, srcmap));
            } else {
                code.append("undefined");
            }

            return code;
        }

        function genCall(evxContext, curToken, srcmap, isInParen) {
            if (curToken in genNativeJs) {
                let code = genNativeJs[curToken](evxContext, isInParen);
                if (code !== undefined) {
                    return code.isExpr() ? code.prepend("$ret=") : code;
                }
            }

            return genProcCall(evxContext, curToken, srcmap, isInParen);
        }

        return codegen;
    }
};
