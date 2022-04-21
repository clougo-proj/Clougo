//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

// Package a directory into a JS file
// usage: node pkdir.js <dir>

import { dirToJs } from "./pktool.js";

try {
    process.stdout.write(dirToJs(process.argv[2]));
} catch (e) {
    process.stderr.write(e.message + "\n");
    process.stderr.write("Usage: node pkdir.js <dir>\n");
}
