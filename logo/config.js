//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

export default {
    "create": function create(sys, origConfigMap = undefined) {
        const config = {};
        const configMap = (origConfigMap === undefined) ? {
            unusedValue : true,  // raise runtime exception for unactionable datum
            genCommand : true,        // use codegen for interactive commands
            dynamicScope: true,
            eagerJitInstrList: false, // transpile instruction list at first encounter
            verbose: false,
            postfix: false,
            asyncCall: false,
            pclogo: false,
            class: false,
            module: false,
            clougo: true,
            scopedPlist: true,
            trace: true
        } : Object.assign({}, origConfigMap);

        function set(key, val) {
            if (key in configMap && typeof val === typeof configMap[key]) {
                configMap[key] = val;
            }
        }
        config.set = set;

        function get(key) {
            sys.assert(key in configMap, "Unknown config key:" + key);
            return configMap[key];
        }
        config.get = get;

        function clone() {
            return create(sys, configMap);
        }
        config.clone = clone;

        function override(configOverride) {
            for (let key in configOverride) {
                set(key, configOverride[key]);
            }

            return config;
        }
        config.override = override;

        return config;
    }
};
