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
        "repeat": evxCtrlRepeat,
        "for": evxCtrlFor,
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
                if (this.ptr + 1 >= this.body.length) {
                    return undefined;
                }

                return this.body[this.ptr+1];
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
        obj.retExpr = false;
        obj.eol = false;

        return obj;
    }
    interpreter.makeEvalContext = makeEvalContext;

    async function evxProcCallParam(evxContext, procName, paramListLength, precedence = 0) {
        let nextActualParam = [];
        for (let j = 0; j < paramListLength; j++) {
            await evxToken(evxContext.next(), precedence);
            if (sys.isUndefined(evxContext.retVal)) {
                throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([procName], evxContext.getSrcmap());
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
                throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([ctrlName], evxContext.getSrcmap());
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
                    throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam([primitiveName], evxContext.getSrcmap());
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
            evxContext.retVal = logo.env.callPrimitive("?", curSrcmap, logo.env.extractSlotNum(curToken));
        } else if (curToken in ctrl) {
            await evxCtrl(evxContext, curToken, 0);
        } else if (curToken in logo.lrt.primitive) {
            evxContext.retVal = await logo.env.callPrimitiveAsync.apply(undefined,
                await evxPrimitiveCallParam(evxContext, curToken, curSrcmap,
                    logo.lrt.util.getPrimitivePrecedence(curToken), isInParen));
        } else {
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
            logo.env.prepareCallProc(curToken, curSrcmap);
            evxContext.retVal = await callTarget.apply(undefined,
                await evxProcCallParam(evxContext, curToken, callTarget.length));
        } else if (isProcBodyDefined(curToken)) {
            let callTarget = logo.env._ws[curToken];
            logo.env.prepareCallProc(curToken, curSrcmap);
            evxContext.retVal = await evxProc(callTarget,
                await evxProcCallParam(evxContext, curToken, callTarget.formal.length));
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
            if (sys.Config.get("unactionableDatum") && (!allowRetVal || evxContext.hasNext())) {
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

            if (e.codeEquals("OUTPUT")) {
                retVal = e.getValue();
            }
        }

        logo.env._scopeStack.pop();

        return retVal;
    }
    interpreter.evxProc = evxProc;

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

    async function evxInstrList(bodyComp, param) {
        let parsedBlock = logo.parse.parseBlock(bodyComp);
        if (!logo.type.hasReferenceSrcmap(bodyComp)) {
            return await evxBody(parsedBlock);
        }

        logo.env.prepareCallProc("[]", logo.type.getReferenceSrcmap(bodyComp), param);
        let retVal = await evxBody(parsedBlock, true);
        logo.env.completeCallProc();
        return retVal;
    }
    interpreter.evxInstrList = evxInstrList;

    async function evxCtrlRepeat(srcmap, count, bodyComp) {
        for (let i = 0; i < count; i++) {
            let retVal = await evxInstrList(bodyComp);
            if (sys.Config.get("unactionableDatum")) {
                logo.env.checkUnactionableDatum(retVal, srcmap);
            }
        }
    }

    async function evxCtrlFor(srcmap, forCtrlComp, bodyComp) {
        if (logo.type.isLogoList(forCtrlComp)) {
            forCtrlComp = logo.parse.parseBlock(forCtrlComp);
        }

        let evxContext = makeEvalContext(forCtrlComp);
        let forVarName = evxContext.getToken();

        let forBegin, forEnd, forStep;
        await evxToken(evxContext.next());
        forBegin = evxContext.retVal;
        await evxToken(evxContext.next());

        forEnd = evxContext.retVal;
        evxContext.retVal = undefined;
        if (evxContext.hasNext()) {
            await evxToken(evxContext.next());
        }

        forStep = evxContext.retVal;
        let curScope = logo.env._scopeStack[logo.env._scopeStack.length - 1];
        let isDecrease = forEnd < forBegin;

        if (sys.isUndefined(forStep)) {
            forStep = isDecrease ? -1 : 1;
        }

        for (curScope[forVarName] = forBegin;
            (!isDecrease && curScope[forVarName] <= forEnd) || (isDecrease && curScope[forVarName] >= forEnd);
            curScope[forVarName] += forStep) {
            let retVal = await evxInstrList(bodyComp);
            if (sys.Config.get("unactionableDatum")) {
                logo.env.checkUnactionableDatum(retVal, srcmap);
            }
        }
    }

    async function evxCtrlIf(srcmap, predicate, bodyComp) {
        if (logo.type.isNotLogoFalse(predicate)) {
            let retVal = await evxInstrList(bodyComp);
            if (sys.Config.get("unactionableDatum")) {
                logo.env.checkUnactionableDatum(retVal, srcmap);
            }
        }
    }

    async function evxCtrlCatch(srcmap, label, bodyComp) {
        try {
            let retVal = await evxInstrList(bodyComp);
            if (sys.Config.get("unactionableDatum")) {
                logo.env.checkUnactionableDatum(retVal, srcmap);
            }
        } catch(e) {
            if (logo.type.LogoException.is(e) && e.isCustom()) {
                if (sys.equalToken(label, e.getValue()[0])) {
                    return e.getValue()[1];
                }

                throw e; // rethrow if tag doesn't match label
            }

            if (!logo.type.LogoException.is(e) || e.codeEquals("STOP") || e.codeEquals("OUTPUT") ||
                    (e.isError() && !sys.equalToken(label, "error"))) {
                throw e;
            }

            // caught and continue execution past catch statement
        }
    }

    async function evxCtrlIfElse(srcmap, predicate, trueBodyComp, falseBodyComp) {
        if (logo.type.isNotLogoFalse(predicate)) {
            let retVal = await evxInstrList(trueBodyComp);
            if (sys.Config.get("unactionableDatum")) {
                logo.env.checkUnactionableDatum(retVal, srcmap);
            }

        } else {
            let retVal = await evxInstrList(falseBodyComp);
            if (sys.Config.get("unactionableDatum")) {
                logo.env.checkUnactionableDatum(retVal, srcmap);
            }

        }
    }

    return interpreter;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
