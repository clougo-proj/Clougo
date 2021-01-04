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
        verbose: true,
        postfix: false,
        trace: true
    };

    function set(key, val) {
        sys.assert(key in configMap, "Unknown configMap:" + key);
        sys.assert(typeof val == typeof configMap[key], "Expect type:" + typeof configMap[key] + " but got type:" + typeof val + " on configMap:" + key);
        configMap[key] = val;
    }
    config.set = set;

    function get(key) {
        sys.assert(key in configMap, "Unknown configMap:" + key);
        return configMap[key];
    }
    config.get = get;

    return config;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
