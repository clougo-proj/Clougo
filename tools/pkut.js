//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

// Package a unit test directory into a JS file
// usage: node pkut.js <dir>

const pktool = require("./pktool");

const filetype = ["lgo", "ljs", "in", "out", "err", "eval", "parse", "codegen", "draw"];

try {
    process.stdout.write(pktool.dirToJs(process.argv[2], encodeDirCases));
} catch (e) {
    process.stderr.write(e.message + "\n");
    process.stderr.write("Usage: node pkut.js <dir>\n");
}

function encodeDirCases(dir) {
    return getListOfCases(dir).map(testCase => encodeCase(testCase, dir));
}

function encodeCase(testCase, dir) {
    let name = testCase[0];
    let tag = testCase[1];
    let file = [];

    file.push("\"" + name + "\": {\"__tag__\": [");
    file.push(tag.map(t => "\"" + t + "\"").join(", "));
    file.push("]");

    filetype.forEach(type => {
        let filename = dir + "/" + name + "." + type;
        if  (pktool.fileExists(filename)) {
            file.push(",\"__" + type + "__\":");
            file.push(pktool.encodeFile(filename));
        }
    });

    file.push("}");

    let ret = file.join("");

    return ret;
}

function getListOfCases(dir) {
    return pktool.readFile(dir + "/list.txt")
        .map(line => line.replace(/#.*$/, ""))
        .filter(line => !line.match(/^\s*$/))
        .map(line => line.split(/\s+/))
        .map(line => [line[0], line.slice(1)]);
}
