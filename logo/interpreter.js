//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Interprets parsed Logo code
// Runs in browser's Logo worker thread or Node's main thread

export default {
    "create": function(logo, sys) {
        const interpreter = {};

        const PROC_PARAM = logo.constants.PROC_PARAM;

        function makeEvalContext(body) {
            const obj = Object.create({
                next: function() {
                    if (this.ptr + 1 < this.body.length) {
                        this.ptr++;
                    } else {
                        this.eol = true;
                    }

                    return this;
                },
                setAnchor: function() {
                    this.anchor = this.ptr;
                },
                rewindToAnchor: function() {
                    this.ptr = this.anchor;
                },
                isEol: function() {
                    return this.eol;
                },
                hasNext: function() {
                    return this.ptr + 1 < this.body.length;
                },
                getToken: function() {
                    return (sys.isUndefined(this.body)) ? undefined :
                        !this.eol ? this.body[this.ptr] : undefined;
                },
                getSrcmap: function() {
                    return (sys.isUndefined(this.srcmap)) ? logo.type.SRCMAP_NULL :
                        (this.ptr < this.srcmap.length) ? this.srcmap[this.ptr] : logo.type.SRCMAP_NULL;
                },
                isNextTokenBinaryOperator: function() {
                    return (this.ptr + 1 >= this.body.length) ? false :
                        logo.lrt.util.isBinaryOperator(this.body[this.ptr + 1]);
                },
                isTokenEndOfStatement: function(token) {
                    return sys.isUndefined(token) || token === logo.type.NEWLINE;
                },
                peekNextToken : function() {
                    if (sys.isUndefined(this.body) || this.ptr + 1 >= this.body.length) {
                        return undefined;
                    }

                    return this.body[this.ptr+1];
                },
                peekNextSrcmap : function() {
                    if (sys.isUndefined(this.srcmap) || this.ptr + 1 >= this.srcmap.length) {
                        return logo.type.SRCMAP_NULL;
                    }

                    return this.srcmap[this.ptr+1];
                },
                getNextOperator: function() {
                    return this.body[this.ptr + 1];
                },
                getNextOperatorSrcmap: function() {
                    return this.srcmap[this.ptr + 1];
                }
            });

            obj.ptr = logo.type.LIST_HEAD_SIZE;
            obj.body = body;
            obj.srcmap = logo.type.getEmbeddedSrcmap(body);
            obj.retVal = undefined;
            obj.proc = undefined;
            obj.retExpr = false;
            obj.eol = false;
            obj.endOfStatement = false;

            return obj;
        }
        interpreter.makeEvalContext = makeEvalContext;

        async function evxProcCallRequiredParam(evxContext, procName, formal, precedence = 0, isInParen) {
            let actualParam = [];
            let paramPtr = 0;

            while (paramNotCompleteWithoutParen() || paramNotCompleteWithinParen()) {
                if (logo.lrt.util.isOnlyBinaryOperator(evxContext.peekNextToken())) {
                    throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([procName], evxContext.peekNextSrcmap());
                }

                let param = await evxParam(evxContext, procName, precedence);
                actualParam.push(param);
                paramPtr += 1;
            }

            if (paramPtr < formal.minInputCount) {
                throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([procName], evxContext.getSrcmap());
            }

            return actualParam;

            function paramNotCompleteWithinParen() {
                return isInParen && evxContext.peekNextToken() != ")" &&
                    ((formal.maxInputCount > formal.defaultInputCount && paramPtr < formal.maxInputCount) ||
                        formal.maxInputCount === PROC_PARAM.UNLIMITED || paramPtr < formal.defaultInputCount);
            }

            function paramNotCompleteWithoutParen() {
                return !isInParen && paramPtr < formal.defaultInputCount;
            }
        }

        async function evxProcCallOptionalRestParam(formal, actualParam) {
            let curScope = {};
            logo.env.scopeStackPush(curScope);
            let paramPtr = actualParam.length;

            if (formal.params !== undefined) {
                for (let k = 0; k < actualParam.length; k++) {
                    curScope[formal.params[k]] = actualParam[k];
                }

                await processOptionalParams();
            }

            processRestParam();
            return actualParam;

            function processRestParam() {
                if (formal.restParam !== undefined) {
                    let restParam = logo.type.makeLogoList(actualParam.length > formal.params.length ?
                        actualParam.slice(formal.params.length) : []);
                    curScope[formal.restParam] = restParam;
                }
            }

            async function processOptionalParams() {
                while (paramPtr < formal.params.length) {
                    sys.assert(formal.params[paramPtr] !== undefined);
                    sys.assert(formal.paramTemplates[paramPtr] !== undefined);
                    let param = await evxInstrList(formal.paramTemplates[paramPtr], {}, true, true);
                    actualParam.push(param);
                    curScope[formal.params[paramPtr]] = param;
                    paramPtr += 1;
                }
            }
        }

        async function evxParam(evxContext, name, precedence) {
            await evxToken(evxContext.next(), precedence, false, true);
            if (sys.isUndefined(evxContext.retVal)) {
                if (evxContext.endOfStatement) {
                    throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([name], evxContext.getSrcmap());
                }

                throw logo.type.LogoException.NO_OUTPUT.withParam([evxContext.proc, name], evxContext.getSrcmap());
            }

            return evxContext.retVal;
        }

        async function evxToken(evxContext, precedence = 0, isInParen = false, stopAtLineEnd = false, macroExpand = false) {
            evxContext.retVal = undefined;
            let curToken = evxContext.getToken();

            while ((!stopAtLineEnd && curToken === logo.type.NEWLINE) &&
                !sys.isUndefined(curToken) && evxContext.hasNext()) {

                curToken = evxContext.next().getToken();
            }

            if (evxContext.isTokenEndOfStatement(curToken)) {
                evxContext.endOfStatement = true;
                return;
            }

            let curSrcmap = evxContext.getSrcmap();
            if (logo.type.isStopStmt(curToken)) {
                throw logo.type.LogoException.STOP;
            }

            if (logo.type.isOutputStmt(curToken)) {
                await evxToken(evxContext.next(), 0);
                throw logo.type.LogoException.OUTPUT.withParam(evxContext.retVal);
            }

            if (logo.type.isNumericConstant(curToken)) {
                evxContext.retVal = Number(curToken);
            } else if (logo.type.isOpenParen(curToken)) {
                await evxParen(evxContext);
            } else if (logo.type.isCompoundObj(curToken)) {
                if (logo.type.isLogoProc(curToken)) {
                    sys.assert(logo.type.isLogoProc(curSrcmap));
                    logo.env.defineLogoProcBody(curToken, curSrcmap);
                } else if (logo.type.isLogoArray(curToken)) {
                    evxContext.retVal = curToken.map(sys.toNumberIfApplicable);
                } else if (logo.type.isLogoList(curToken)) {
                    evxContext.retVal = logo.type.embedSrcmap(
                        curToken.map(sys.toNumberIfApplicable), curSrcmap);
                } else {
                    evxContext.retVal = curToken;
                }
            } else if (logo.type.isQuotedLogoWord(curToken)) {
                evxContext.retVal = logo.type.unquoteLogoWord(curToken);
            } else if (logo.type.isLogoVarRef(curToken)) {
                evxContext.retVal = logo.type.getVarValue(logo.env.extractVarName(curToken), curSrcmap);
            } else if (logo.type.isLogoSlot(curToken)) {
                evxContext.proc = "?";
                evxContext.retVal = logo.env.callProc("?", curSrcmap, logo.env.extractSlotNum(curToken));
            } else {
                evxContext.proc = curToken;
                await evxCallProc(evxContext, curToken, curSrcmap, isInParen, macroExpand);
            }

            while(evxContext.isNextTokenBinaryOperator()) {
                let nextOp = evxContext.getNextOperator();
                let nextOpSrcmap = evxContext.getNextOperatorSrcmap();
                let nextPrec = logo.lrt.util.getBinaryOperatorPrecedence(nextOp);

                if (precedence >= nextPrec) {
                    return;
                }

                await evxCtrlInfixOperator(evxContext, nextOp, nextOpSrcmap, nextPrec);
            }
        }

        async function evxMacroOutput(macroOutput, curToken, curSrcmap) {
            if (!logo.type.isLogoList(macroOutput)) {
                throw logo.type.LogoException.INVALID_MACRO_RETURN.withParam([macroOutput, curToken], curSrcmap);
            }

            logo.env.setProcName(curToken);
            logo.env.setProcSrcmap(logo.type.SRCMAP_NULL);

            return await logo.env.getPrimitive("run").apply(undefined, [macroOutput, true]);
        }

        async function evxCallProcDefault(...callParams) {
            let procName = logo.env.getProcName();
            await evxProcCallOptionalRestParam(logo.env.getProcParsedFormal(procName), callParams);
            return await evxProcBody(logo.env.getProcMetadata(procName));
        }
        interpreter.evxCallProcDefault = evxCallProcDefault;

        async function evxCallProc(evxContext, curToken, curSrcmap, isInParen, macroExpand) {
            if (!logo.env.isCallableProc(curToken)) {
                throw logo.type.LogoException.UNKNOWN_PROC.withParam([curToken], curSrcmap);
            }

            evxContext.proc = curToken;
            if (!logo.env.isPrimitive(curToken)) {
                logo.env.prepareCallProc(curToken, curSrcmap);
            }

            let callParams = await evxProcCallRequiredParam(evxContext, curToken, logo.env.getProcParsedFormal(curToken),
                logo.env.getPrecedence(curToken), isInParen);

            logo.env.setProcName(curToken);
            logo.env.setProcSrcmap(curSrcmap);
            evxContext.retVal = await logo.env.getCallTarget(curToken).apply(undefined, callParams);
            if (!logo.env.isPrimitive(curToken)) {
                logo.env.completeCallProc();
            }

            if (!macroExpand && logo.env.isMacro(curToken)) {
                evxContext.retVal = await evxMacroOutput(evxContext.retVal, curToken, curSrcmap);
            }
        }

        async function evxCtrlInfixOperator(evxContext, nextOp, nextOpSrcmap, nextPrec) {
            let retVal = evxContext.next().retVal;
            let actualParam = [await evxParam(evxContext, nextOp, nextPrec)];
            actualParam.splice(0, 0, nextOp, nextOpSrcmap, retVal);
            evxContext.retVal = await logo.env.callPrimitiveOperatorAsync.apply(undefined, actualParam);
        }

        async function evxBody(body, allowRetVal = false, macroExpand = false) {
            let evxContext = makeEvalContext(body);

            do {
                await evxToken(evxContext, 0, false, false, macroExpand);
                if (logo.config.get("unusedValue") && (!allowRetVal || evxContext.hasNext())) {
                    logo.env.checkUnusedValue(evxContext.retVal, evxContext.getSrcmap());
                }

            } while (!evxContext.next().isEol());

            return evxContext.retVal;
        }
        interpreter.evxBody = evxBody;

        async function evxParen(evxContext) {
            await evxToken(evxContext.next(), 0, true);
            if (evxContext.next().getToken() != ")") {
                throw logo.type.LogoException.TOO_MUCH_INSIDE_PAREN.withParam(undefined, evxContext.getSrcmap());
            }
        }

        function assignParams(proc, actualParams) {
            const formal = proc.formal;
            let curScope = {};
            logo.env.scopeStackPush(curScope);

            for (let i = 0; i < formal.length; i++) {
                curScope[formal[i]] = actualParams[i];
            }
        }

        async function evxProcBody(proc) {
            let retVal = undefined;

            try {
                await evxBody(logo.parse.parseBlock(logo.type.embedSrcmap(proc.body, proc.bodySrcmap)));
            } catch(e)  {
                if (!logo.type.LogoException.is(e) || e.isError() || e.isCustom()) {
                    throw e;
                }

                if (logo.type.LogoException.OUTPUT.equalsByCode(e)) {
                    retVal = e.getValue();
                }
            }

            logo.env.scopeStackPop();

            return retVal;
        }
        interpreter.evxProcBody = evxProcBody;

        async function evxProc(proc, actualParams) {
            assignParams(proc, actualParams);
            return await evxProcBody(proc);
        }
        interpreter.evxProc = evxProc;

        async function evxNextNumberExpr(evxContext, exception, exceptionParam, srcmap) {
            await evxToken(evxContext.next());
            logo.type.validateNumber(evxContext.retVal, exception, srcmap, exceptionParam);
        }
        interpreter.evxNextNumberExpr = evxNextNumberExpr;

        async function evxInstrListWithFormalParam(bodyComp, formalParam, slot) {
            let curScope = {};
            logo.env.scopeStackPush(curScope);
            for (let i = 0; i < formalParam.length; i++) {
                curScope[formalParam[i]] = slot.param[i];
            }

            let retVal = await evxInstrList(bodyComp, slot);
            logo.env.scopeStackPop();
            return retVal;
        }
        interpreter.evxInstrListWithFormalParam = evxInstrListWithFormalParam;

        async function evxInstrList(bodyComp, slot = {}, pushStack = true, allowRetVal = false, macroExpand = false) {
            logo.type.validateInputList(bodyComp);
            let parsedBlock = logo.parse.parseBlock(bodyComp);
            if (!logo.type.hasReferenceSrcmap(bodyComp) || !pushStack) {
                return await evxBody(parsedBlock, allowRetVal, macroExpand);
            }

            logo.env.prepareCallProc(logo.type.LAMBDA_EXPR, logo.type.getReferenceSrcmap(bodyComp), slot);
            let retVal = await evxBody(parsedBlock, true);
            logo.env.completeCallProc();
            return retVal;
        }
        interpreter.evxInstrList = evxInstrList;

        return interpreter;
    }
};
