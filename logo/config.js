//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var $obj = {};
$obj.create = function(sys, origConfigMap = undefined) {
    const config = {};
    const configMap = (origConfigMap === undefined) ? {
        unactionableDatum : true,  // raise runtime exception for unactionable datum
        genCommand : true,        // use codegen for interactive commands
        dynamicScope: true,
        verbose: false,
        postfix: false,
        deepCallStack: false,
        trace: true
    } : Object.assign({}, origConfigMap);

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

    function clone() {
        return $obj.create(sys, configMap);
    }
    config.clone = clone;

    return config;
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
