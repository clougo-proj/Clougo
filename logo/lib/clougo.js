//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements extended primitives introduced in Clougo
// Runs in Logo worker thread

export default {
    "create": function(logo) {

        const DEFAULT_CONSTRUCTOR = "constructor";

        const clougo = {};

        const methods = {

            "module": primitiveModule,

            "endmodule": primitiveEndmodule,

            "export": primitiveExport,

            "import": primitiveImport,

            "class": primitiveModule,

            "endclass": primitiveEndclass,

            "isa": primitiveIsa,

            "new": [primitiveNew, "class_name [args]"],

            "super.constructor": [primitiveSuperConstructor, "[args]"],

            "super.invoke": [primitiveSuperInvoke, "this method_name [args]"],

            "invokemethod": [primitiveInvokemethod, "this method_name [args]"],
            "invokem": [primitiveInvokemethod, "this method_name [args]"]
        };
        clougo.methods = methods;

        function primitiveModule(moduleName) {
            logo.type.throwIf(!logo.config.get("module"), logo.type.LogoException.NOT_ENABLED);
            logo.type.throwIf(!logo.env.inDefaultModule(), logo.type.LogoException.NOT_ALLOWD_IN_MODULE);
            logo.type.validateInputWord(moduleName);
            logo.env.setModule(moduleName);
        }

        function primitiveEndmodule() {
            logo.type.throwIf(!logo.config.get("module"), logo.type.LogoException.NOT_ENABLED);
            logo.type.throwIf(logo.env.inDefaultModule(), logo.type.LogoException.ONLY_IN_MODULE);
            logo.env.setModule();
        }

        function primitiveEndclass() {
            logo.type.throwIf(!logo.config.get("module"), logo.type.LogoException.NOT_ENABLED);
            logo.type.throwIf(logo.env.inDefaultModule(), logo.type.LogoException.ONLY_IN_MODULE);
            logo.env.exportProcs(logo.env.getClassDefaultExportedProcs());
            logo.env.setModule();
        }

        function primitiveExport(procs) {
            logo.type.throwIf(!logo.config.get("module"), logo.type.LogoException.NOT_ENABLED);
            logo.type.validateInputList(procs);
            logo.env.exportProcs(logo.type.unbox(procs));
        }

        function primitiveImport(moduleName, procs) {
            logo.type.throwIf(!logo.config.get("module"), logo.type.LogoException.NOT_ENABLED);
            logo.type.validateInputWord(moduleName);
            logo.type.validateInputList(procs);
            logo.env.importProcs(moduleName, logo.type.unbox(procs));
        }

        function primitiveIsa(superList) {
            logo.type.throwIf(logo.env.inDefaultModule(), logo.type.LogoException.ONLY_IN_MODULE);
            logo.type.validateInputList(superList);
            logo.env.setIsa(logo.type.unbox(superList));
        }

        async function primitiveNew(className, ...args) {
            let self = logo.type.makeLogoClassObj(className, logo.type.makePlist());
            let constructor = logo.env.getClassMethod(className, DEFAULT_CONSTRUCTOR);
            if (constructor !== undefined) {
                args.unshift(self);
                await logo.env.getPrimitive("apply").apply(undefined, [constructor, logo.type.makeLogoList(args)]);
            }

            return self;
        }

        async function primitiveSuperConstructor(...args) {
            let className = logo.env.getModule();
            let constructor = logo.env.getSuperClassMethod(className, DEFAULT_CONSTRUCTOR);
            if (constructor !== undefined) {
                await logo.env.getPrimitive("apply").apply(undefined, [constructor, logo.type.makeLogoList(args)]);
            }
        }

        async function primitiveSuperInvoke(self, methodName, ...args) {
            let className = logo.env.getModule();
            let procName = logo.env.getSuperClassMethod(className, methodName);
            if (procName !== undefined) {
                args.unshift(self);
                return await logo.env.getPrimitive("apply").apply(undefined, [procName, logo.type.makeLogoList(args)]);
            }
        }

        async function primitiveInvokemethod(logoClassObj, methodName, ...args) {
            let className = logo.type.getLogoClassName(logoClassObj);
            let procName = logo.env.getClassMethod(className, methodName);
            if (procName !== undefined) {
                args.unshift(logoClassObj);
                return await logo.env.getPrimitive("apply").apply(undefined, [procName, logo.type.makeLogoList(args)]);
            }
        }

        return clougo;
    }
};
