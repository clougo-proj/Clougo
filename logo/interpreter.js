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
                    return true;
                } else {
                    this.eol = true;
                    return false;
                }
            },
            getToken: function() {
                return (sys.isUndefined(this.body)) ? undefined :
                    !this.eol ? this.body[this.ptr] : undefined;
            },
            getSrcmap: function() {
                return (sys.isUndefined(this.srcmap)) ? undefined :
                    (this.ptr < this.srcmap.length) ? this.srcmap[this.ptr] : undefined;
            },
            isNextTokenBinaryOperator: function() {
                return (this.ptr + 1 >= this.body.length) ? false :
                    logo.lrt.util.isBinaryOperator(this.body[this.ptr + 1]);
            },
            isTokenEndOfStatement: function(token) {
                return sys.isUndefined(token) || token === "\n";
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

    async function evxProcCallParam(evxContext, paramListLength, nextActualParam, precedence = 0) {
        for (let j = 0; j < paramListLength; j++) {
            evxContext.next();
            await evxToken(evxContext, precedence);
            nextActualParam.push(evxContext.retVal);
        }
    }

    async function evxCtrlParam(evxContext, ctrlName, nextActualParam, precedence = 0) {
        const paramListLength = ctrl[ctrlName].length;

        for (let j = 0; j < paramListLength; j++) {
            evxContext.next();
            await evxToken(evxContext, precedence, false, true);
            if (sys.isUndefined(evxContext.retVal)) {
                throw logo.type.LogoException.create("NOT_ENOUGH_INPUTS", [ctrlName], evxContext.getSrcmap());
            }

            nextActualParam.push(evxContext.retVal);

        }

        // if pred [list1] else [list2]
        if (ctrlName === "if" && evxContext.peekNextToken() === "else") {
            evxContext.next();
            evxContext.next();
            await evxToken(evxContext, precedence, false, true);
            nextActualParam.push(evxContext.retVal);
            ctrlName = "ifelse";
        }

        evxContext.retVal = await ctrl[ctrlName].apply(null, nextActualParam);
    }

    async function evxPrimitiveCallParam(evxContext, primitiveName, nextActualParam, precedence = 0,
        isInParen = false) {

        const paramListLength = logo.lrt.util.getPrimitiveParamCount(primitiveName);
        const paramListMinLength = logo.lrt.util.getPrimitiveParamMinCount(primitiveName);
        const paramListMaxLength = logo.lrt.util.getPrimitiveParamMaxCount(primitiveName);

        let srcmap = evxContext.getSrcmap();
        if (isInParen && (paramListMaxLength > paramListLength || paramListMaxLength == -1)) {
            let j = 0;
            for (;  ((!isInParen || ((j < paramListMaxLength || paramListMaxLength == -1) &&
                isInParen && evxContext.peekNextToken() != ")" )) && evxContext.next()); j++) {
                await evxToken(evxContext, precedence);
                let retVal = evxContext.retVal;
                nextActualParam.push(retVal);
            }

            if (j < paramListMinLength) {
                throw logo.type.LogoException.create("NOT_ENOUGH_INPUTS", [primitiveName], evxContext.getSrcmap());
            }
        } else {
            let j = 0;
            for (; (j < paramListLength && ((isInParen && evxContext.peekNextToken() != ")" ) || !isInParen)); j++) {
                evxContext.next();
                await evxToken(evxContext, precedence, false, true);
                if (sys.isUndefined(evxContext.retVal)) {
                    throw logo.type.LogoException.create("NOT_ENOUGH_INPUTS", [primitiveName], evxContext.getSrcmap());
                }

                let retVal = evxContext.retVal;
                nextActualParam.push(retVal);
            }

            if (j < paramListMinLength) {
                throw logo.type.LogoException.create("NOT_ENOUGH_INPUTS", [primitiveName], evxContext.getSrcmap());
            }
        }

        try {
            evxContext.retVal = await logo.env.callPrimitive.apply(undefined, nextActualParam);
        } catch (e) {
            if (!logo.type.LogoException.is(e)) {
                throw e;
            }

            throw e.withSrcmap(srcmap);
        }
    }

    async function evxToken(evxContext, precedence = 0, isInParen = false, stopAtLineEnd = false) {
        evxContext.retVal = undefined;
        let curToken = evxContext.getToken();

        while ((!stopAtLineEnd && curToken === "\n") && !sys.isUndefined(curToken) && evxContext.next()) {
            curToken = evxContext.getToken();
        }

        if (evxContext.isTokenEndOfStatement(curToken)) {
            return;
        }

        let curSrcmap = evxContext.getSrcmap();
        if (sys.equalToken(curToken, "stop")) {
            throw logo.type.LogoException.create("STOP");
        }

        if (sys.equalToken(curToken, "output") || sys.equalToken(curToken, "op")) {
            evxContext.next();
            await evxToken(evxContext, 0);
            throw logo.type.LogoException.create("OUTPUT", evxContext.retVal);
        }

        let tmp;
        if (typeof curToken !== "object" && !isNaN(tmp = Number(curToken))) {
            evxContext.retVal = tmp;
        } else if (curToken == "(") {
            await evxParen(evxContext);
        } else if (typeof curToken === "object") {
            if (logo.type.isLogoProc(curToken)) {
                // procedure should have been registered to workspace by parser
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
        } else {
            await evxCtrlCallProc(evxContext, curToken, curSrcmap, isInParen);
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

    async function evxCtrlCallProc(evxContext, curToken, curSrcmap, isInParen) {
        const nextActualParam = [];
        if (curToken in ctrl) {
            await evxCtrlParam(evxContext, curToken, nextActualParam, 0);
        } else if (curToken in logo.lrt.primitive) {
            nextActualParam.push(curToken, curSrcmap);
            await evxPrimitiveCallParam(evxContext, curToken, nextActualParam,
                logo.lrt.util.getPrimitivePrecedence(curToken), isInParen);
        } else if (curToken in logo.env._user) {
            let callTarget = logo.env._user[curToken];
            await evxProcCallParam(evxContext, callTarget.length, nextActualParam);
            evxContext.retVal = callTarget.apply(undefined, nextActualParam);
        } else if (curToken in logo.env._ws) {
            let callTarget = logo.env._ws[curToken];
            await evxProcCallParam(evxContext, callTarget.formal.length, nextActualParam);
            evxContext.retVal = await evxProc(callTarget, nextActualParam, curToken, curSrcmap);  // proc, parentScope, [actualParam]
        } else {
            throw logo.type.LogoException.create("UNKNOWN_PROC", [curToken], curSrcmap);
        }
    }

    async function evxCtrlInfixOperator(evxContext, nextOp, nextOpSrcmap, nextPrec) {
        let nextActualParam = [];
        evxContext.next();

        let callTarget = logo.lrt.util.getBinaryOperatorRuntimeFunc(nextOp);
        nextActualParam = [nextOp, nextOpSrcmap, evxContext.retVal];
        await evxProcCallParam(evxContext, callTarget.length - 1, nextActualParam, nextPrec);
        evxContext.retVal = await logo.env.callPrimitiveOperatorAsync.apply(undefined, nextActualParam);
    }

    async function evxBody(body) {
        let evxContext = makeEvalContext(body);

        do {
            await evxToken(evxContext);
            if (!sys.isUndefined(evxContext.retVal) && sys.Config.get("unactionableDatum")) {
                throw logo.type.LogoException.create("UNACTIONABLE_DATUM", [evxContext.retVal], evxContext.getSrcmap());
            }
        } while (evxContext.next());
    }
    interpreter.evxBody = evxBody;

    async function evxParen(evxContext) {
        evxContext.next();
        await evxToken(evxContext, 0, true);

        evxContext.next();
        if (evxContext.getToken() != ")") {
            throw logo.type.LogoException.create("TOO_MUCH_INSIDE_PAREN", undefined, evxContext.getSrcmap());
        }
    }

    async function evxProc(proc, actualParam, procName, srcmap) {
        const formalParam = proc.formal;
        let retVal = undefined;
        let curScope = {};

        logo.env._scopeStack.push(curScope);
        sys.assert(formalParam.length <= actualParam.length, "formalParam.length > actualParam.length at evxProc");

        for (let i = 0; i < formalParam.length; i++) {
            let formalParamName = formalParam[i];
            curScope[formalParamName] = actualParam[i];
        }

        sys.trace("evxProc "+procName+" token:"+JSON.stringify(proc.body), "evx");
        sys.trace("evxProc "+procName+" srcmap:"+JSON.stringify(proc.srcmap), "evx");
        logo.env._callstack.push([logo.env._curProc, srcmap]);
        logo.env._curProc = procName;

        try {
            await evxBody(logo.type.embedSrcmap(proc.body, proc.bodySrcmap));
        } catch(e)  {
            if (!logo.type.LogoException.is(e) || e.isError() || e.isCustom()) {
                throw e;
            }

            if (e.codeEquals("OUTPUT")) {
                retVal = e.getValue();
            }
        }

        logo.env._curProc = logo.env._callstack.pop()[0];
        logo.env._scopeStack.pop();
        return retVal;
    }

    async function evxCtrlRepeat(count, bodyComp) {
        if (logo.type.isLogoList(bodyComp)) {
            bodyComp = logo.parse.parseBlock(bodyComp);
        }

        for (let i = 0; i < count; i++) {
            await evxBody(bodyComp);
        }
    }

    async function evxCtrlFor(forCtrlComp, bodyComp) {
        if (logo.type.isLogoList(forCtrlComp)) {
            forCtrlComp = logo.parse.parseBlock(forCtrlComp);
        }

        if (logo.type.isLogoList(bodyComp)) {
            bodyComp = logo.parse.parseBlock(bodyComp);
        }

        let evxContext = makeEvalContext(forCtrlComp);
        let forVarName = evxContext.getToken();
        evxContext.next();

        let forBegin, forEnd, forStep;
        await evxToken(evxContext);
        forBegin = evxContext.retVal;
        evxContext.next();
        await evxToken(evxContext);

        forEnd = evxContext.retVal;
        evxContext.retVal = undefined;
        if (evxContext.next()) {
            await evxToken(evxContext);
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
            await evxBody(bodyComp);
        }
    }

    async function evxCtrlIf(predicate, bodyComp) {
        if (logo.type.isNotLogoFalse(predicate)) {
            await evxBody(logo.parse.parseBlock(bodyComp));
        }
    }

    async function evxCtrlCatch(label, bodyComp) {
        try {
            await evxBody(logo.parse.parseBlock(bodyComp));
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

    async function evxCtrlIfElse(predicate, trueBodyComp, falseBodyComp) {
        if (logo.type.isNotLogoFalse(predicate)) {
            await evxBody(logo.parse.parseBlock(trueBodyComp));
        } else {
            await evxBody(logo.parse.parseBlock(falseBodyComp));
        }
    }

    return interpreter;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
