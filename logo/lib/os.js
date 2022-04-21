//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements Logo's OS-related primitives
// Runs in Logo worker thread

export default {
    "create": function(logo) {
        const os = {};

        const methods = {

            "time": primitiveTime,

            "timemilli": primitiveTimeMilli,

            ".novalue": dotNovalue,

        };
        os.methods = methods;

        function primitiveTime() {
            let date = new Date().toString().split(" "); // E.g. [Sat Sep 01 2018 14:53:26 GMT+1400 (LINT)]
            return logo.type.makeLogoList(date.slice(0, 3).concat(date[4], date[3]));
        }

        function primitiveTimeMilli() {
            return new Date().getTime();
        }

        function dotNovalue() {
            return undefined;
        }

        return os;
    }
};
