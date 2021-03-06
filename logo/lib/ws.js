//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements Logo's workspace management primitives
// Runs in Logo worker thread

"use strict";

var $obj = {};
$obj.create = function(logo) {
    const ws = {};

    const methods = {

        "to": primitiveTo,

        "define": primitiveDefine,

        "text": primitiveText,

        "make": primitiveMake,

        "local": [primitiveLocal, "[args] 1"],

        "localmake": primitiveLocalmake,

        "namep": primitiveNamep,
        "name?": primitiveNamep,

        "thing": primitiveThing,

        "load": primitiveLoad,

        "help": primitiveHelp,
    };
    ws.methods = methods;

    function getBodyFromText(text) {
        let bodyText = logo.type.unboxList(logo.type.listButFirst(text));
        return logo.type.makeLogoList(logo.type.flattenList(bodyText, logo.type.NEWLINE));
    }

    function getBodySrcmapFromText(text) {
        let srcmap = logo.type.getEmbeddedSrcmap(text);
        if (srcmap === logo.type.SRCMAP_NULL) {
            return logo.type.SRCMAP_NULL;
        }

        let bodyTextSrcmap = logo.type.unboxList(logo.type.listButFirst(srcmap));
        return logo.type.makeLogoList(logo.type.flattenList(bodyTextSrcmap, logo.type.SRCMAP_NULL));
    }

    function getFormalFromText(text) {
        return logo.type.unboxList(logo.type.listFirst(text));
    }

    function getFormalSrcmapFromText(text) {
        let srcmap = logo.type.getEmbeddedSrcmap(text);
        if (srcmap === logo.type.SRCMAP_NULL) {
            return logo.type.SRCMAP_NULL;
        }

        return logo.type.unboxList(logo.type.listFirst(srcmap));
    }

    function primitiveNamep(name) {
        logo.type.validateInputWord(name);
        let scope = logo.env.findLogoVarScope(name);
        return (name in scope) && (scope[name] !== undefined);
    }

    function primitiveThing(name) {
        logo.type.validateInputWord(name);
        return logo.type.getVarValue(logo.type.toString(name).toLowerCase(), logo.env.getPrimitiveSrcmap());
    }

    function primitiveMake(varname, val) {
        logo.env.findLogoVarScope(varname)[varname.toLowerCase()] = val;
    }

    function primitiveLocal(...args) {
        let ptr = logo.env._scopeStack.length - 1;

        args.forEach(varname =>
            logo.env._scopeStack[ptr][varname.toLowerCase()] = undefined);
    }

    function primitiveLocalmake(varname, val) {
        let ptr = logo.env._scopeStack.length - 1;
        logo.env._scopeStack[ptr][varname.toLowerCase()] = val;
    }

    function primitiveDefine(procname, text) {
        logo.env.defineLogoProc(procname.toLowerCase(),
            getFormalFromText(text),
            getBodyFromText(text),
            getFormalSrcmapFromText(text),
            getBodySrcmapFromText(text));
    }

    function primitiveTo() {
        throw logo.type.LogoException.NESTED_TO.withParam([], logo.env.getPrimitiveSrcmap());
    }

    function primitiveText(procname) {
        return logo.env.getLogoProcText(procname.toLowerCase());
    }

    async function primitiveLoad(name) {
        let src = logo.logofs.get(name);
        await logo.entry.exec(src);
    }

    function primitiveHelp(topic) {
        try {
            logo.io.stdout(logo.logofs.get("/ucblogo/HELPFILE/" + topic.toLowerCase()));
        } catch (e) {
            if (logo.type.LogoException.is(e) && logo.type.LogoException.CANT_OPEN_FILE.equalsByCode(e)) {
                throw logo.type.LogoException.NO_HELP_AVAILABLE.withParam([topic], logo.env.getPrimitiveSrcmap());
            } else {
                throw e;
            }
        }
    }

    return ws;
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
