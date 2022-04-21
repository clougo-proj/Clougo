//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

// Library for package a directory into a single JS file

import { existsSync, lstatSync, readdirSync, statSync, readFileSync } from "fs";

import { join } from "path";

export function dirToJs(root, encodeDirectory = encodeDirFiles) {
    if (!(existsSync(root) && lstatSync(root).isDirectory())) {
        throw Error("Directory '" + root + "' does not exist.");
    }

    let splittedPath = splitPath(root);
    let dir = splittedPath[0];
    let parent = splittedPath[1];

    return "export default " + encodeDir(dir, parent, encodeDirectory);
}

function splitPath(path) {
    const pattern = /^(.*)[/\\]([^/\\]+)$/;
    let found = path.match(pattern);
    if (found !== null) {
        return [found[2], found[1]];
    }

    return [path];
}

function encodeDir(dir, parent, encodeDirectory) {
    let path = (typeof parent === "undefined") ? dir : parent + "/" + dir;

    return "{" +  encodeDirectory(path).concat(encodeSubDirs(path, encodeDirectory)).join(",") + "}";
}

function encodeSubDirs(path, encodeDirectory) {
    return readdirSync(path).filter(name => statSync(join(path, name)).isDirectory())
        .map(subDir => "\"" + subDir + "\": " + encodeDir(subDir, path, encodeDirectory));
}

function encodeDirFiles(path) {
    return readdirSync(path).filter(name => statSync(join(path, name)).isFile())
        .map(file => "\"" + file + "\":" + encodeFile(path + "/" + file));
}

function encodeFile(srcfile) {
    return JSON.stringify(readFileSync(srcfile, "utf8"));
}
