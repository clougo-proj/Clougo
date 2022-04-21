//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

export default {
    "create": function(logo, sys) {
        const logofs = {};

        const MOUNT_MODE = {
            "READONLY": 0,
            "READWRITE": 1
        };

        const jsonFile = {
            "unittests": sys.global.unitTestsJsSrcFile,
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


        async function mountIfNeeded(top) {
            if (!(top in root) && (top in jsonFile)) {
                mount( await getJsonFileName(top)(), top, MOUNT_MODE.READONLY);
            }
        }

        function exists(obj) {
            return obj !== undefined;
        }
        logofs.exists = exists;

        function isFile(obj) {
            return typeof obj === "string";
        }
        logofs.isFile = isFile;

        function isDir(obj) {
            return typeof obj === "object";
        }
        logofs.isDir = isDir;

        function getLocalFile(filePath) {
            try {
                return logo.io.readfile(filePath);
            } catch (e) {
                throwCantOpenFile(filePath);
            }
        }

        function throwCantOpenFile(filePath) {
            throw logo.type.LogoException.CANT_OPEN_FILE.withParam([filePath], logo.env.getProcSrcmap());
        }

        async function tryGetObj(objPath) {
            sys.assert(!isRelativePath(objPath));

            let path = objPath.split("/");
            path.shift();
            let top = path.shift();
            await mountIfNeeded(top);
            if (!(top in root)) {
                return undefined;
            }

            let currentObj =  root[top].JSON;
            while (path.length > 0) {
                let objName = path.shift();
                if (!(objName in currentObj)) {
                    return undefined;
                }

                currentObj = currentObj[objName];
            }

            if (!exists(currentObj)) {
                return undefined;
            }

            return currentObj;
        }
        logofs.tryGetObj = tryGetObj;

        async function readFile(filePath) {
            if (isRelativePath(filePath)) {
                return getLocalFile(filePath);
            }

            let obj = await tryGetObj(filePath);
            if (obj === undefined || !isFile(obj)) {
                throwCantOpenFile(filePath);
            }

            return obj;
        }
        logofs.readFile = readFile;

        async function readSubDirs(dirPath) {
            sys.assert(!isRelativePath(dirPath));
            let obj = await tryGetObj(dirPath);
            sys.assert(isDir(obj));
            return Object.keys(obj).filter(key => isDir(obj[key]));
        }
        logofs.readSubDirs = readSubDirs;

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
    }
};
