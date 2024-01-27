//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

/* global VanillaTerminal */

import { VanillaTerminal } from "../vanilla-terminal/VanillaTerminal.js";

export default {
    "create": function(terminalId, host) {

        let curLine = "";

        const isReady = {
            "logo": true,
            "canvas": true
        };

        function setReady(id, val) {
            if (id in isReady) {
                isReady[id] = val;
            }
        }

        function getAllReady() {
            return Object.keys(isReady)
                .map(e => isReady[e])
                .reduce(
                    function(acc, cur) { return acc && cur; }
                );
        }

        const term = new VanillaTerminal({
            container: terminalId,
            welcome: "Welcome to Logo",
        });

        term.onInput((commandLine) => {
            if (getAllReady()) {
                host.console(commandLine);
            }

            term.resetCommand();
        });

        return {
            "write": function(text) {
                curLine += text;
            },
            "writeln": function(text) {
                term.output(curLine + text);
                curLine = "";
            },
            "prompt": function(text) {
                term.setPrompt(curLine + text);
                curLine = "";
            },
            "user": function() {
                term.setPrompt(curLine);
                curLine = "";
            },
            "setBusy": function(id) {
                setReady(id, false);
                term.idle();
            },
            "setReady": function(id) {
                setReady(id, true);
                if (getAllReady()) {
                    term.setPrompt();
                }
            },
            "cleartext": function() {
                term.clear();
            }
        };
    }
};
