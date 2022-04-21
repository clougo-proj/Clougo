//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements Logo's control primitives
// Runs in Logo worker thread

export default {
    "create": function(logo, sys) {
        const ctrl = {};

        const PROC_ATTRIBUTE = logo.constants.PROC_ATTRIBUTE;

        const methods = {

            "run": {jsFunc: primitiveRun, attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

            "runresult": {jsFunc: primitiveRunresult, attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

            "macroexpand": {jsFunc: primitiveMacroexpand, attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

            "repeat": {jsFunc: primitiveRepeat, attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

            "while": {jsFunc: primitiveWhile, attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

            "if": {jsFunc: primitiveIf, attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

            "ifelse": {jsFunc: primitiveIfelse, attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

            "catch": {jsFunc: primitiveCatch, attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

            "throw": [primitiveThrow, "tag [value .novalue]"],

            "wait": primitiveWait,

            "ignore": primitiveIgnore,

            "for": {jsFunc: primitiveFor, attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

            "apply": {jsFunc: primitiveApply, attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

            "invoke": {jsFunc: primitiveInvoke, formal: "template [inputs] 2",
                attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

            "foreach": {jsFunc: primitiveForeach, formal: "[inputs] 2",
                attributes: PROC_ATTRIBUTE.STASH_LOCAL_VAR | PROC_ATTRIBUTE.RETURNS_IN_LAMBDA},

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
            let srcmap = logo.env.getProcSrcmap();
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
                throw logo.type.LogoException.NOT_SAME_LENGTH.withParam(["foreach"], logo.env.getProcSrcmap());
            }

            let length = inputs[0].length;
            let srcmap = logo.env.getProcSrcmap();
            for (let i = 0; i < length; i++) {
                let retVal = await applyHelper(template, logo.type.makeLogoList(inputs.map(v => v[i])), i + 1,
                    inputs.map(v => v.slice(i + 1)));

                logo.env.checkUnusedValue(retVal, srcmap);
            }
        }

        async function primitiveRepeat(count, template) {
            logo.type.validateInputPosNumber(count);
            logo.type.validateInputList(template);

            let srcmap = logo.env.getProcSrcmap();

            for (let i = 0; i < count; i++) {
                let ret = await logo.env.applyInstrList(template, srcmap);
                logo.env.checkUnusedValue(ret, srcmap);
            }
        }

        async function primitiveRun(template, allowRetVal = true) {
            template = logo.type.wordToList(template);
            logo.type.validateInputList(template);
            return await logo.env.callTemplate(template, false, allowRetVal);
        }

        async function primitiveRunresult(template) {
            try {
                let retVal = await primitiveRun(template, true);
                if (retVal === undefined) {
                    return logo.type.EMPTY_LIST;
                }

                return logo.type.makeLogoList([retVal]);
            } catch (e) {
                if (logo.type.LogoException.OUTPUT.equalsByCode(e) || logo.type.LogoException.STOP.equalsByCode(e)) {
                    throw logo.type.LogoException.OUTPUT_STOP_RUNRESULT.withParam([], logo.env.getProcSrcmap());
                }

                throw e;
            }
        }

        async function primitiveMacroexpand(template) {
            template = logo.type.wordToList(template);
            logo.type.validateInputNonEmptyList(template);
            logo.type.validateInputMacro(logo.type.listFirst(template));
            return await logo.env.callTemplate(template, true, true);
        }

        async function primitiveIf(predicate, template) {
            logo.type.validateInputBoolean(predicate);

            template = logo.type.wordToList(template);
            logo.type.validateInputList(template);

            if (logo.type.logoBoolean(predicate)) {
                await logo.env.callTemplate(template);
            }
        }

        async function primitiveWhile(predicate, template) {
            logo.type.validateInputList(predicate);

            template = logo.type.wordToList(template);
            logo.type.validateInputList(template);

            while (await logo.env.callTemplate(predicate, false, true)) {
                await logo.env.callTemplate(template);
            }
        }

        async function primitiveIfelse(predicate, templateTrue, templateFalse) {
            logo.type.validateInputBoolean(predicate);

            templateTrue = logo.type.wordToList(templateTrue);
            templateFalse = logo.type.wordToList(templateFalse);

            logo.type.validateInputList(templateTrue);
            logo.type.validateInputList(templateFalse);

            if (logo.type.logoBoolean(predicate)) {
                await logo.env.callTemplate(templateTrue);
            } else {
                await logo.env.callTemplate(templateFalse);
            }
        }

        async function primitiveCatch(label, template) {
            logo.type.validateInputWord(label);
            template = logo.type.wordToList(template);
            logo.type.validateInputList(template);

            try {
                let srcmap = logo.env.getProcSrcmap();
                let retVal = await logo.env.applyInstrList(template, srcmap,
                    !logo.type.inSameLine(srcmap, logo.type.getTemplateSrcmap(template)));
                if (logo.config.get("unusedValue")) {
                    logo.env.checkUnusedValue(retVal, logo.type.getTemplateSrcmap(template));
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
            throw logo.type.LogoException.CUSTOM.withParam([tag, value], logo.env.getProcSrcmap(), logo.env.getFrameProcName());
        }

        async function primitiveFor(forCtrlComp, bodyComp) {
            let srcmap = logo.env.getProcSrcmap();

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

            let curScope = logo.env.curScope();
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
                        e.getSrcmap() === logo.type.SRCMAP_NULL || logo.env.getFrameProcName() === undefined ? srcmap : e.getSrcmap());
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
    }
};
