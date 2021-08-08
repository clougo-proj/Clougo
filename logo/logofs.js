//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var $obj = {};
$obj.create = function(logo, sys) {
    const logofs = {};

    const MOUNT_MODE = {
        "READONLY": 0,
        "READWRITE": 1
    };

    const jsonFile = {
        "demo": sys.global.demoJsSrcFile,
        "ucblogo": sys.global.ucbLogoJsSrcFile,
        "mod": sys.global.modJsSrcFile
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

    function mountIfNeeded(top) {
        if (!(top in root) && (top in jsonFile)) {
            mount(sys.util.fromJs(getJsonFileName(top)), top, MOUNT_MODE.READONLY);
        }
    }

    function isFile(obj) {
        return typeof obj === "string";
    }

    function get(filePath) {
        sys.assert(!isRelativePath(filePath)); // relative path will be supported in the future
        let path = filePath.split("/");
        path.shift();
        let top = path.shift();
        mountIfNeeded(top);
        if (!(top in root)) {
            throwCantOpenFile();
        }

        return getFileObj(top, path);

        function getFileObj(top, path) {
            let currentObj =  root[top].JSON;
            while (path.length > 0) {
                let objName = path.shift();
                if (!(objName in currentObj)) {
                    throwCantOpenFile();
                }

                currentObj = currentObj[objName];
            }

            if (!isFile(currentObj)) {
                throwCantOpenFile();
            }

            return currentObj;
        }

        function throwCantOpenFile() {
            throw logo.type.LogoException.CANT_OPEN_FILE.withParam([filePath], logo.env.getProcSrcmap());
        }
    }
    logofs.get = get;

    function isRelativePath(filePath) {
        return filePath.substring(0, 1) !== "/";
    }

    function put(top, key, value) {
        sys.assert(top);
        sys.assert(key);
        sys.assert(value);
    }
    logofs.put = put;

    return logofs;
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
