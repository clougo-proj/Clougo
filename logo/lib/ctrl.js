//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements Logo's control primitives
// Runs in Logo worker thread

"use strict";

var $obj = {};
$obj.create = function(logo, sys) {
    const ctrl = {};

    const methods = {

        "run": primitiveRun,

        "repeat": primitiveRepeat,

        "if": primitiveIf,

        "ifelse": primitiveIfelse,

        "catch": primitiveCatch,

        "throw": [primitiveThrow, "tag [value .novalue]"],

        "wait": primitiveWait,

        "ignore": primitiveIgnore,

        "for": primitiveFor,

        "apply": primitiveApply,

        "invoke": [primitiveInvoke, "template [inputs] 2"],

        "foreach": [primitiveForeach, "[inputs] 2"],

        "?": [primitiveQuestionMark, "[slotNum 1]"],

        "?rest": [primitiveQuestionMarkRest, "[slotNum 1]"],

        "#": primitiveHashMark,
    };
    ctrl.methods = methods;

    async function primitiveApply(template, inputList) {
        return await applyHelper(template, inputList);
    }

    async function applyHelper(template, inputList, index = 1, unboxedRestList = []) {
        logo.type.validateInputList(inputList);

        let unboxedInputList = logo.type.unbox(inputList);
        let srcmap = logo.env.getPrimitiveSrcmap();
        let slot = logo.env.makeSlotObj(unboxedInputList, index, unboxedRestList);

        let inputListSrcmap = logo.type.getEmbeddedSrcmap(inputList);
        if (inputListSrcmap === logo.type.SRCMAP_NULL) {
            inputListSrcmap = srcmap;
        }

        if (logo.type.isLogoWord(template)) {
            return await logo.env.applyNamedProcedure(template, srcmap, slot, inputListSrcmap);
        }

        logo.type.validateInputList(template);

        if (logo.type.isProcText(template)) {
            return await logo.env.applyProcText(template, srcmap, slot, inputListSrcmap);
        }

        return await logo.env.applyInstrList(template, srcmap, true, slot, inputListSrcmap);
    }

    async function primitiveInvoke(template, ...inputs) {
        return await applyHelper(template, logo.type.makeLogoList(inputs));
    }

    function sameLength(lists) {
        let lengths = lists.map(list => list.length);
        return Math.max.apply(null, lengths) === Math.min.apply(null, lengths);
    }

    async function primitiveForeach(...inputs) {
        let template = inputs.pop();
        inputs.forEach(logo.type.validateInputWordOrList);
        inputs = inputs.map(input => logo.type.isLogoList(input) ? logo.type.unbox(input) :
            logo.type.toString(input).split(""));

        if (!sameLength(inputs)) {
            throw logo.type.LogoException.NOT_SAME_LENGTH.withParam(["foreach"], logo.env.getPrimitiveSrcmap());
        }

        let length = inputs[0].length;
        let srcmap = logo.env.getPrimitiveSrcmap();
        for (let i = 0; i < length; i++) {
            let retVal = await applyHelper(template, logo.type.makeLogoList(inputs.map(v => v[i])), i + 1,
                inputs.map(v => v.slice(i + 1)));

            logo.env.checkUnusedValue(retVal, srcmap);
        }
    }

    async function primitiveRepeat(count, template) {
        logo.type.validateInputPosNumber(count);
        logo.type.validateInputList(template);

        let srcmap = logo.env.getPrimitiveSrcmap();

        for (let i = 0; i < count; i++) {
            let ret = await logo.env.applyInstrList(template, srcmap);
            logo.env.checkUnusedValue(ret, srcmap);
        }
    }

    function wordTemplateToList(template) {
        return logo.type.isLogoWord(template) ? logo.type.makeLogoList([template]) : template;
    }

    function getTemplateSrcmap(template) {
        let templateSrcmap = logo.type.getEmbeddedSrcmap(template);
        return Array.isArray(templateSrcmap) ? templateSrcmap[0] : templateSrcmap;
    }

    async function callTemplate(template) {
        let srcmap = logo.env.getPrimitiveSrcmap();
        let ret = await logo.env.applyInstrList(template, srcmap,
            !logo.type.inSameLine(srcmap, getTemplateSrcmap(template)));
        logo.env.checkUnusedValue(ret, srcmap);
    }

    async function primitiveRun(template) {
        template = wordTemplateToList(template);
        logo.type.validateInputList(template);
        await callTemplate(template);
    }

    async function primitiveIf(predicate, template) {
        logo.type.validateInputBoolean(predicate);

        template = wordTemplateToList(template);
        logo.type.validateInputList(template);

        if (logo.type.logoBoolean(predicate)) {
            await callTemplate(template);
        }
    }

    async function primitiveIfelse(predicate, templateTrue, templateFalse) {
        logo.type.validateInputBoolean(predicate);

        templateTrue = wordTemplateToList(templateTrue);
        templateFalse = wordTemplateToList(templateFalse);

        logo.type.validateInputList(templateTrue);
        logo.type.validateInputList(templateFalse);

        if (logo.type.logoBoolean(predicate)) {
            await callTemplate(templateTrue);
        } else {
            await callTemplate(templateFalse);
        }
    }

    async function primitiveCatch(label, template) {
        logo.type.validateInputWord(label);
        template = wordTemplateToList(template);
        logo.type.validateInputList(template);

        try {
            let srcmap = logo.env.getPrimitiveSrcmap();
            let retVal = await logo.env.applyInstrList(template, srcmap,
                !logo.type.inSameLine(srcmap, getTemplateSrcmap(template)));
            if (logo.config.get("unusedValue")) {
                logo.env.checkUnusedValue(retVal, getTemplateSrcmap(template));
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

    function primitiveThrow(tag, value = undefined) {
        throw logo.type.LogoException.CUSTOM.withParam([tag, value], logo.env.getPrimitiveSrcmap(), logo.env._curProc);
    }

    async function primitiveFor(forCtrlComp, bodyComp) {
        let srcmap = logo.env.getPrimitiveSrcmap();

        let forCtrlSrcmap = logo.type.getEmbeddedSrcmap(forCtrlComp);
        if (forCtrlSrcmap === logo.type.SRCMAP_NULL) {
            forCtrlSrcmap = srcmap;
        }

        if (logo.type.isLogoList(forCtrlComp)) {
            forCtrlComp = logo.parse.parseBlock(forCtrlComp);
        }

        let evxContext = logo.interpreter.makeEvalContext(forCtrlComp);
        let forVarName = evxContext.getToken();

        await evxForNextNumberExpr(evxContext, forCtrlComp, forCtrlSrcmap);

        let forBegin = sys.toNumberIfApplicable(evxContext.retVal);
        await evxForNextNumberExpr(evxContext, forCtrlComp, forCtrlSrcmap);

        let forEnd = sys.toNumberIfApplicable(evxContext.retVal);
        evxContext.retVal = undefined;
        if (evxContext.hasNext()) {
            await evxForNextNumberExpr(evxContext, forCtrlComp, forCtrlSrcmap);
        }

        let curScope = logo.env._scopeStack[logo.env._scopeStack.length - 1];
        let isDecrease = forEnd < forBegin;
        let forStep = !sys.isUndefined(evxContext.retVal) ? evxContext.retVal : isDecrease ? -1 : 1;

        for (curScope[forVarName] = forBegin;
            (!isDecrease && curScope[forVarName] <= forEnd) || (isDecrease && curScope[forVarName] >= forEnd);
            curScope[forVarName] += forStep) {
            await decorateSrcmap(async () => {
                let retVal = await logo.interpreter.evxInstrList(bodyComp, undefined, false);
                if (logo.config.get("unusedValue")) {
                    logo.env.checkUnusedValue(retVal, srcmap);
                }
            }, srcmap);
        }
    }

    async function evxForNextNumberExpr(evxContext, forCtrlComp, forCtrlSrcmap) {
        await logo.interpreter.evxNextNumberExpr(evxContext, logo.type.LogoException.INVALID_INPUT, ["for", forCtrlComp], forCtrlSrcmap);
    }

    async function decorateSrcmap(func, srcmap) {
        try {
            await func();
        } catch (e) {
            if (logo.type.LogoException.is(e)) {
                throw e.withParam(e.getValue(),
                    e.getSrcmap() === logo.type.SRCMAP_NULL || logo.env._curProc === undefined ? srcmap : e.getSrcmap());
            }

            throw e;
        }
    }

    async function primitiveWait(delay) {
        logo.env.prepareToBeBlocked();
        await new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, 50 / 3 * delay);
        });

        return;
    }

    function primitiveIgnore(input) { // eslint-disable-line no-unused-vars
        // Does nothing
    }

    function primitiveQuestionMark(slotNum = 1) {
        return logo.env.getSlotValue(slotNum);
    }

    function primitiveQuestionMarkRest(slotNum = 1) {
        return logo.env.getSlotRestValue(slotNum);
    }

    function primitiveHashMark() {
        return logo.env.getSlotIndex();
    }

    return ctrl;
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
