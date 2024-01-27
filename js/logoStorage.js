//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

export default {
    "read": function(key, defaultValue) {
        let ret = window.localStorage.getItem(key);
        if (ret === null || ret === undefined) {
            return defaultValue;
        }

        return ret;
    },
    "write": function(key, value) {
        window.localStorage.setItem(key, value);
    }
};
