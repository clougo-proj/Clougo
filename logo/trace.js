//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

export default {
    "create": function(logo, sys) {
        const traceKeys = [
            "parse",
            "parse.result",
            "env.eagerEval",
            "evx",
            "evalJs",
            "codegen",
            "codegen.genLocal",
            "codegen.lambda",
            "console",
            "lrt",
            "time",
            "draw",
            "tmp"
        ];

        const trace = {};

        const traceTable = {};
        traceKeys.forEach(v => traceTable[v] = () => {});

        function enableTrace(tagPattern) {
            const reTags = sys.makeMatchListRegexp([tagPattern]);
            traceKeys.filter(v => v.match(reTags))
                .forEach(v => traceTable[v] = console.error); // eslint-disable-line no-console
        }
        trace.enableTrace = enableTrace;

        function info(text, tag) {
            sys.assert(tag in traceTable, "Unknown trace tag: " + tag);
            if (logo.config.get("trace")) {
                traceTable[tag](text);
            }
        }
        trace.info = info;

        function getTraceStream(tag) {
            return traceTable[tag];
        }
        trace.getTraceStream = getTraceStream;

        return trace;
    }
};
