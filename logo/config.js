//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var $classObj = {};
$classObj.create = function(sys) {
    const config = {};
    const configMap = {
        unactionableDatum : true,  // raise runtime exception for unactionable datum
        genCommand : true,        // use codegen for interactive commands
        dynamicScope: true,
        verbose: false,
        postfix: false,
        trace: true
    };

    config.set = function(configName, val) {
        sys.assert(configName in configMap, "Unknown configMap:" + configName);
        sys.assert(typeof val == typeof configMap[configName], "Expect type:" + typeof configMap[configName] + " but got type:" + typeof val + " on configMap:" + configName);
        configMap[configName] = val;
    };

    config.get = function(configName) {
        sys.assert(configName in configMap, "Unknown configMap:" + configName);
        return configMap[configName];
    };

    config.setConfigs = function(configNames, val) {
        configNames.forEach(configName =>
            config.set(configName, val));
    };

    return config;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
