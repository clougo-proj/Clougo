//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements extended primitives introduced in Clougo
// Runs in Logo worker thread

"use strict";

var $obj = {};
$obj.create = function(logo) {
    const clougo = {};

    const methods = {

        "module": primitiveModule,

        "endmodule": primitiveEndmodule,

        "export": primitiveExport,

        "import": primitiveImport,
    };
    clougo.methods = methods;

    function primitiveModule(moduleName) {
        logo.type.throwIf(!logo.config.get("module"), logo.type.LogoException.NOT_ENABLED.withParam(["module"]));
        logo.type.throwIf(!logo.env.inDefaultModule(), logo.type.LogoException.NESTED_MODULE);
        logo.type.validateInputWord(moduleName);
        logo.env.setModule(moduleName);
    }

    function primitiveEndmodule() {
        logo.type.throwIf(!logo.config.get("module"), logo.type.LogoException.NOT_ENABLED.withParam(["endmodule"]));
        logo.type.throwIf(logo.env.inDefaultModule(), logo.type.LogoException.UNMATCHED_ENDMODULE);
        logo.env.setModule();
    }

    function primitiveExport(procs) {
        logo.type.throwIf(!logo.config.get("module"), logo.type.LogoException.NOT_ENABLED.withParam(["export"]));
        logo.type.validateInputList(procs);
        logo.env.exportProcs(logo.type.unbox(procs));
    }

    function primitiveImport(moduleName, procs) {
        logo.type.throwIf(!logo.config.get("module"), logo.type.LogoException.NOT_ENABLED.withParam(["import"]));
        logo.type.validateInputWord(moduleName);
        logo.type.validateInputList(procs);
        logo.env.importProcs(moduleName, logo.type.unbox(procs));
    }

    return clougo;
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
