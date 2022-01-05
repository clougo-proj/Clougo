//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

// Library for package a directory into a single JS file

const fs = require("fs");
const { join } = require("path");

function dirToJs(root, encodeDirectory = encodeDirFiles) {
    if (!(fs.existsSync(root) && fs.lstatSync(root).isDirectory())) {
        throw Error("Directory '" + root + "' does not exist.");
    }

    let splittedPath = splitPath(root);
    let dir = splittedPath[0];
    let parent = splittedPath[1];

    return "var $obj = " + encodeDir(dir, parent, encodeDirectory) +
        ";\nif (typeof exports !== \"undefined\") { exports.$obj = $obj; }\n";
}
exports.dirToJs = dirToJs;

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
    return fs.readdirSync(path).filter(name => fs.statSync(join(path, name)).isDirectory())
        .map(subDir => "\"" + subDir + "\": " + encodeDir(subDir, path, encodeDirectory));
}

function encodeDirFiles(path) {
    return fs.readdirSync(path).filter(name => fs.statSync(join(path, name)).isFile())
        .map(file => "\"" + file + "\":" + encodeFile(path + "/" + file));
}

function readFile(fileName) {
    if (!fileExists(fileName)) {
        return [];
    }

    return fs.readFileSync(fileName, "utf8").split(/\r?\n/);
}
exports.readFile = readFile;

function fileExists(fileName) {
    return fs.existsSync(fileName) && fs.lstatSync(fileName).isFile();
}
exports.fileExists = fileExists;

function encodeFile(srcfile) {
    return JSON.stringify(fs.readFileSync(srcfile, "utf8"));
}
exports.encodeFile = encodeFile;
