//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

/* global ace */

export default {
    "create": function(editorId) {
        const editor = ace.edit(editorId);
        editor.setTheme("ace/theme/monokai");
        editor.setBehavioursEnabled(false);
        editor.getSession().setMode("ace/mode/logo");

        editor.setOptions({
            fontSize: "12pt",
            tabSize: 2,
            useSoftTabs: true
        });

        return {
            "setValue": (val) => editor.setValue(val),
            "getValue": () => editor.getValue(),
            "resize": () => editor.resize()
        };
    }
};