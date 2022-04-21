//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

export default {
    "create": function(isNodeJsEnvFlag) {
        const sys = {};

        function isNodeJsEnv() {
            return !!isNodeJsEnvFlag;
        }
        sys.isNodeJsEnv = isNodeJsEnv;

        function getCleartextChar() {
            return "\x1Bc";
        }
        sys.getCleartextChar = getCleartextChar;

        function isUndefined(v) {
            return v === undefined;
        }
        sys.isUndefined = isUndefined;

        sys.isInteger = Number.isInteger || function isInteger(x) {
            return (typeof x === "number") && (x % 1 === 0);
        };

        function makeMatchListRegexp(v) {
            assert(Array.isArray(v));
            return new RegExp(
                "(" + v.map(
                    function (v) {
                        return v.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
                    }
                ).join("|") + ")");
        }
        sys.makeMatchListRegexp = makeMatchListRegexp;

        function equalToken(val1, val2) {
            return (val2 === val1) || ((typeof val1 === "string" && typeof val2 === "string") &&
                val2.toLowerCase() === val1.toLowerCase());
        }
        sys.equalToken = equalToken;

        function assert(cond, msg) {
            if (!cond) {
                throw Error(msg);
            }
        }
        sys.assert = assert;

        function logoFround6(num) {
            return Math.round(num * 1e6) / 1e6;
        }
        sys.logoFround6 = logoFround6;

        sys.global = {
            unitTestsJsSrcFile: async () => {
                return (await import("../generated/unittests.js")).default;
            },
            demoJsSrcFile: async () => {
                return (await import("../generated/demo.js")).default;
            },
            ucbLogoJsSrcFile: async () => {
                return (await import("../generated/UCBLogo.js")).default;
            },
            modJsSrcFile: async () => {
                return (await import("../generated/mod.js")).default;
            }
        };

        function toNumberIfApplicable(s) {
            if (typeof s === "object" || s === "\n") {
                return s;
            }

            let t = Number(s);
            return isNaN(t) ? s : t;
        }
        sys.toNumberIfApplicable = toNumberIfApplicable;

        return sys;
    }
};
