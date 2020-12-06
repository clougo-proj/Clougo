//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var $classObj = {};
$classObj.create = function(logo, sys) {
    const logofs = {};

    const MOUNT_MODE = {
        "READONLY": 0,
        "READWRITE": 1
    };

    const jsonFile = {
        "demo": sys.Config.get("demoJsSrcFile")
    };

    const root = {};

    function getJsonFileName(top) {
        return jsonFile[top];
    }

    function mount(jsonObj, top, mode) {
        root[top] = {
            "MOUNT_MODE": mode,
            "JSON": jsonObj
        };
    }
    logofs.mount = mount;

    function list(top, prefix = undefined) {
        sys.assert(top);
        sys.assert(prefix);
        sys.assert(logo);
    }
    logofs.list = list;

    function exists(top, key) {
        return (top in root) && (key in root[top].JSON);
    }
    logofs.exists = exists;

    function get(top, key) {
        if (!(top in root) && (top in jsonFile)) {
            mount(sys.util.jsonFromJs(getJsonFileName(top)), top, MOUNT_MODE.READONLY);
        }

        if (!exists(top, key)) {
            throw logo.type.LogoException.create("CANT_OPEN_FILE", ["/" + top + "/" + key], logo.env.getPrimitiveSrcmap());
        }

        return root[top].JSON[key];
    }
    logofs.get = get;

    function put(top, key, value) {
        sys.assert(top);
        sys.assert(key);
        sys.assert(value);
    }
    logofs.put = put;

    return logofs;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
