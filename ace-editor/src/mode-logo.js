define("ace/mode/logo_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var LogoHighlightRules = function() {
    var keywordControl = "to|end|repeat||loop|if|else|when|for|catch";
    var keywordOperator = "eq|neq|and|or";
    var constantLanguage = "null|nil";
    var supportFunctions = "cs|setsc|setpc|setfc|ellipsearc2|setpc|fd|forward|pu|fill|lt|left|rt" +
            "|right|home|pd|back|bk|arc2|arc|circle|st|showturtle|ht|hideturtle|listp|pr|print" +
            "|make|throw|item|setitem|local|type|output|op|log10|seth|setheading|setxy|setx|sety" +
            "|xcor|ycor|label|mdarray|mditem|mdsetitem|setpensize|round|localmake|list|sentence" +
            "|se|wait|timemilli|ifelse";

    var keywordMapper = this.createKeywordMapper({
        "keyword.control": keywordControl,
        "keyword.operator": keywordOperator,
        "constant.language": constantLanguage,
        "support.function": supportFunctions
    }, "identifier", true);
    this.$rules =
        {
    "start": [
        {
            token : "comment",
            regex : ";.*$"
        },
        {
            token: ["storage.type.function-type.logo", "text", "entity.name.function.logo"],
            regex: "(?:\\b(?:(defun|defmethod|defmacro))\\b)(\\s+)((?:\\w|\\-|\\!|\\?)*)"
        },
        {
            token: ["punctuation.definition.constant.character.logo", "constant.character.logo"],
            regex: "(#)((?:\\w|[\\\\+-=<>'\"&#])+)"
        },
        {
            token: ["punctuation.definition.variable.logo", "variable.other.global.logo"],
            regex: "(:)(\\w*)"
        },
        {
            token : "constant.numeric", // hex
            regex : "0[xX][0-9a-fA-F]+(?:L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b"
        },
        {
            token : "constant.numeric", // float
            regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?(?:L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b"
        },
        {
                token : keywordMapper,
                regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
        },
        {
            token : "string",
            regex : '"',
            next  : "qword"
        },
        {
            token : "string",
            regex : '\\|',
            next  : "qqword"
        }
    ],
    "qword": [
        {
            token: "constant.character.escape.logo",
            regex: "\\\\."
        },
        {
            token : "string",
            regex : '[^"\\s\\\\]+'
        }, {
            token : "string",
            regex : "\\\\$",
            next  : "qword"
        }, {
            token : "string",
            regex : '\\s|$',
            next  : "start"
        }
    ],
    "qqword": [
        {
            token: "constant.character.escape.logo",
            regex: "\\\\."
        },
        {
            token : "string",
            regex : '[^\\|\\\\]+'
        }, {
            token : "string",
            regex : "\\\\$",
            next  : "qqword"
        }, {
            token : "string",
            regex : '\\||$',
            next  : "start"
        }
    ]
};

};

oop.inherits(LogoHighlightRules, TextHighlightRules);

exports.LogoHighlightRules = LogoHighlightRules;
});

define("ace/mode/logo",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/logo_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var LogoHighlightRules = require("./logo_highlight_rules").LogoHighlightRules;

var Mode = function() {
    this.HighlightRules = LogoHighlightRules;
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {

    this.lineCommentStart = ";";

    this.$id = "ace/mode/logo";
}).call(Mode.prototype);

exports.Mode = Mode;
});
                (function() {
                    window.require(["ace/mode/logo"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();