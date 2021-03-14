//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Interprets parsed Logo code
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

var $classObj = {};
$classObj.create = function(logo, sys) {
    const interpreter = {};
    const ctrl = {
        "if": evxCtrlIf,
        "ifelse": evxCtrlIfElse,
        "catch": evxCtrlCatch
    };

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

    async function evxProcCallParam(evxContext, procName, paramListLength, precedence = 0) {
        let nextActualParam = [];
        for (let j = 0; j < paramListLength; j++) {
            await evxToken(evxContext.next(), precedence);
            if (sys.isUndefined(evxContext.retVal)) {
                if (evxContext.endOfStatement) {
                    throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([procName], evxContext.getSrcmap());
                }

                throw logo.type.LogoException.NO_OUTPUT.withParam([evxContext.proc, procName], evxContext.getSrcmap());
            }

            nextActualParam.push(evxContext.retVal);
        }

        return nextActualParam;
    }

    async function evxCtrl(evxContext, ctrlName, precedence = 0) {
        const paramListLength = ctrl[ctrlName].length - 1;
        let nextActualParam = [];

        for (let j = 0; j < paramListLength; j++) {
            await evxToken(evxContext.next(), precedence, false, true);
            if (sys.isUndefined(evxContext.retVal)) {
                if (evxContext.endOfStatement) {
                    throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([ctrlName], evxContext.getSrcmap());
                }

                throw logo.type.LogoException.NO_OUTPUT.withParam([evxContext.proc, ctrlName], evxContext.getSrcmap());
            }

            let param = logo.type.isLogoList(evxContext.retVal) ?
                logo.type.embedReferenceSrcmap(evxContext.retVal, evxContext.getSrcmap()) :
                evxContext.retVal;

            nextActualParam.push(param);
        }

        // if pred [list1] else [list2]
        if (ctrlName === "if" && evxContext.peekNextToken() === "else") {
            await evxToken(evxContext.next().next(), precedence, false, true);
            let param = logo.type.isLogoList(evxContext.retVal) ?
                logo.type.embedReferenceSrcmap(evxContext.retVal, evxContext.getSrcmap()) :
                evxContext.retVal;

            nextActualParam.push(param);
            ctrlName = "ifelse";
        }

        nextActualParam.splice(0, 0, evxContext.getSrcmap());
        logo.env.setPrimitiveName(ctrlName);
        logo.env.setPrimitiveSrcmap(evxContext.getSrcmap());
        evxContext.retVal = await ctrl[ctrlName].apply(null, nextActualParam);
    }

    async function evxPrimitiveCallParam(evxContext, primitiveName, srcmap, precedence, isInParen) {

        const paramListLength = logo.lrt.util.getPrimitiveParamCount(primitiveName);
        const paramListMinLength = logo.lrt.util.getPrimitiveParamMinCount(primitiveName);
        const paramListMaxLength = logo.lrt.util.getPrimitiveParamMaxCount(primitiveName);

        let nextActualParam = [primitiveName, srcmap];

        if (isInParen && (paramListMaxLength > paramListLength || paramListMaxLength == -1)) {
            let j = 0;
            for (; ((!isInParen || ((j < paramListMaxLength || paramListMaxLength == -1) &&
                isInParen && evxContext.peekNextToken() != ")" )) && evxContext.hasNext()); j++) {

                await evxToken(evxContext.next(), precedence);
                if (sys.isUndefined(evxContext.retVal)) {
                    throw logo.type.LogoException.NO_OUTPUT.withParam([evxContext.proc, primitiveName], evxContext.getSrcmap());
                }

                let retVal = evxContext.retVal;
                nextActualParam.push(retVal);
            }

            if (j < paramListMinLength) {
                throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([primitiveName], evxContext.getSrcmap());
            }
        } else {
            let j = 0;
            for (; (j < paramListLength && ((isInParen && evxContext.peekNextToken() != ")" ) || !isInParen)); j++) {
                await evxToken(evxContext.next(), precedence, false, true);
                if (sys.isUndefined(evxContext.retVal)) {
                    if (evxContext.endOfStatement) {
                        throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([primitiveName], evxContext.getSrcmap());
                    }

                    throw logo.type.LogoException.NO_OUTPUT.withParam([evxContext.proc, primitiveName], evxContext.getSrcmap());
                }

                let retVal = evxContext.retVal;
                nextActualParam.push(retVal);
            }

            if (j < paramListMinLength) {
                throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([primitiveName], evxContext.getSrcmap());
            }
        }

        return nextActualParam;
    }

    async function evxToken(evxContext, precedence = 0, isInParen = false, stopAtLineEnd = false) {
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
            evxContext.retVal = logo.env.callPrimitive("?", curSrcmap, logo.env.extractSlotNum(curToken));
        } else if (curToken in ctrl) {
            await evxCtrl(evxContext, curToken, 0);
        } else if (curToken in logo.lrt.primitive) {
            evxContext.proc = curToken;
            evxContext.retVal = await logo.env.callPrimitiveAsync.apply(undefined,
                await evxPrimitiveCallParam(evxContext, curToken, curSrcmap,
                    logo.lrt.util.getPrimitivePrecedence(curToken), isInParen));
        } else {
            evxContext.proc = curToken;
            await evxCallProc(evxContext, curToken, curSrcmap);
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

    async function evxCallProc(evxContext, curToken, curSrcmap) {
        if (isProcJsDefined(curToken)) {
            let callTarget = logo.env._user[curToken];
            let callParams =  await evxProcCallParam(evxContext, curToken, callTarget.length);
            logo.env.prepareCallProc(curToken, curSrcmap);
            evxContext.retVal = await callTarget.apply(undefined, callParams);
        } else if (isProcBodyDefined(curToken)) {
            let callTarget = logo.env._ws[curToken];
            let callParams = await evxProcCallParam(evxContext, curToken, callTarget.formal.length);
            logo.env.prepareCallProc(curToken, curSrcmap);
            evxContext.retVal = await evxProc(callTarget, callParams);
        } else {
            throw logo.type.LogoException.UNKNOWN_PROC.withParam([curToken], curSrcmap);
        }

        logo.env.completeCallProc();
    }

    function isProcBodyDefined(procName) {
        return procName in logo.env._ws && logo.env._ws[procName].body !== undefined;
    }

    function isProcJsDefined(procName) {
        return procName in logo.env._user;
    }

    async function evxCtrlInfixOperator(evxContext, nextOp, nextOpSrcmap, nextPrec) {
        let retVal = evxContext.next().retVal;
        let nextActualParam = await evxProcCallParam(evxContext, nextOp, 1, nextPrec);
        nextActualParam.splice(0, 0, nextOp, nextOpSrcmap, retVal);
        evxContext.retVal = await logo.env.callPrimitiveOperatorAsync.apply(undefined, nextActualParam);
    }

    async function evxBody(body, allowRetVal = false) {
        let evxContext = makeEvalContext(body);

        do {
            await evxToken(evxContext);
            if (logo.config.get("unactionableDatum") && (!allowRetVal || evxContext.hasNext())) {
                logo.env.checkUnactionableDatum(evxContext.retVal, evxContext.getSrcmap());
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

    async function evxProc(proc, actualParam) {
        const formalParam = proc.formal;
        let retVal = undefined;
        let curScope = {};

        logo.env._scopeStack.push(curScope);
        sys.assert(formalParam.length <= actualParam.length, "formalParam.length > actualParam.length at evxProc");

        for (let i = 0; i < formalParam.length; i++) {
            let formalParamName = formalParam[i];
            curScope[formalParamName] = actualParam[i];
        }

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

        logo.env._scopeStack.pop();

        return retVal;
    }
    interpreter.evxProc = evxProc;

    async function evxNextNumberExpr(evxContext, exception, exceptionParam, srcmap) {
        await evxToken(evxContext.next());
        logo.type.validateNumber(evxContext.retVal, exception, srcmap, exceptionParam);
    }
    interpreter.evxNextNumberExpr = evxNextNumberExpr;

    async function evxInstrListWithFormalParam(bodyComp, formalParam, param) {
        let curScope = {};
        logo.env._scopeStack.push(curScope);
        for (let i = 0; i < formalParam.length; i++) {
            curScope[formalParam[i]] = param[i];
        }

        let retVal = await evxInstrList(bodyComp, param);
        logo.env._scopeStack.pop();
        return retVal;
    }
    interpreter.evxInstrListWithFormalParam = evxInstrListWithFormalParam;

    async function evxInstrList(bodyComp, param = undefined, pushStack = true) {
        logo.type.validateInputList(bodyComp);
        let parsedBlock = logo.parse.parseBlock(bodyComp);
        if (!logo.type.hasReferenceSrcmap(bodyComp) || !pushStack) {
            return await evxBody(parsedBlock);
        }

        logo.env.prepareCallProc("[]", logo.type.getReferenceSrcmap(bodyComp), param);
        let retVal = await evxBody(parsedBlock, true);
        logo.env.completeCallProc();
        return retVal;
    }
    interpreter.evxInstrList = evxInstrList;

    async function evxCtrlIf(srcmap, predicate, bodyComp) {
        if (logo.type.isNotLogoFalse(predicate)) {
            let retVal = await evxInstrList(bodyComp);
            if (logo.config.get("unactionableDatum")) {
                logo.env.checkUnactionableDatum(retVal, srcmap);
            }
        }
    }

    async function evxCtrlCatch(srcmap, label, bodyComp) {
        try {
            let retVal = await evxInstrList(bodyComp);
            if (logo.config.get("unactionableDatum")) {
                logo.env.checkUnactionableDatum(retVal, srcmap);
            }
        } catch(e) {
            if (logo.type.LogoException.is(e) && e.isCustom()) {
                if (sys.equalToken(label, e.getValue()[0])) {
                    return e.getValue()[1];
                }

                throw e; // rethrow if tag doesn't match label
            }

            if (!logo.type.LogoException.is(e) || logo.type.LogoException.STOP.equalsByCode(e) ||
                    logo.type.LogoException.OUTPUT.equalsByCode(e) ||
                    (e.isError() && !sys.equalToken(label, "error"))) {
                throw e;
            }

            // caught and continue execution past catch statement
        }
    }

    async function evxCtrlIfElse(srcmap, predicate, trueBodyComp, falseBodyComp) {
        if (logo.type.isNotLogoFalse(predicate)) {
            let retVal = await evxInstrList(trueBodyComp);
            if (logo.config.get("unactionableDatum")) {
                logo.env.checkUnactionableDatum(retVal, srcmap);
            }

        } else {
            let retVal = await evxInstrList(falseBodyComp);
            if (logo.config.get("unactionableDatum")) {
                logo.env.checkUnactionableDatum(retVal, srcmap);
            }

        }
    }

    return interpreter;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
