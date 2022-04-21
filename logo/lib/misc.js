//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements miscellaneous primitives
// Runs in Logo worker thread

export default {
    "create": function(logo) {
        const misc = {};

        const methods = {

            "demo": primitiveDemo,

            ".test": dotTest
        };
        misc.methods = methods;

        async function primitiveDemo(name) {
            let option = undefined;
            if (logo.type.isLogoList(name)) {
                option = logo.type.listItem(2, name).toLowerCase();
                name = logo.type.listItem(1, name).toLowerCase();
            } else {
                name = name.toLowerCase();
            }

            let demoFileName = name + ".lgo";

            let src = await logo.logofs.readFile("/demo/" + demoFileName);

            if (option !== undefined && option == "load") {
                logo.io.editorLoad(src);
            }

            await logo.entry.exec(src, "/demo/" + demoFileName);
        }

        async function dotTest(testName, testMethod) {
            await logo.entry.runSingleTest(testName, testMethod);
        }

        return misc;
    }
};
