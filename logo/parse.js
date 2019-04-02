//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

var $classObj = {};
$classObj.create = function(logo, sys) {
    const parse = {};

    const Delimiter = (function() {
        const SP_NONE = 0,
            SP_BASE = 0x1,
            SP_OPEN = 0x2,
            SP_CLOSE = 0x4,
            SP_OPERATOR = 0x8,
            SP_MULTICHAR = 0x10,
            SP_COMMENT = 0x20;

        const definition = {
            " ": [SP_BASE],
            "~": [SP_NONE],
            "\n": [SP_BASE],
            "\t": [SP_BASE],
            undefined: [SP_NONE],
            ";" : [SP_COMMENT],
            "[" : [SP_BASE|SP_OPEN, "]"],
            "]" : [SP_BASE|SP_CLOSE, "[", logo.type.makeLogoList],
            "{" : [SP_BASE|SP_OPEN, "}"],
            "}" : [SP_BASE|SP_CLOSE, "{", logo.type.makeLogoArray],
            "+" : [SP_OPERATOR, "+"],
            "-" : [SP_OPERATOR, "-"],
            "*" : [SP_OPERATOR, "*"],
            "/" : [SP_OPERATOR, "/"],
            "=" : [SP_OPERATOR, "=="],
            ">" : [SP_MULTICHAR|SP_OPERATOR, {
                "=": [SP_OPERATOR, ">="],
                "" : [SP_OPERATOR, ">"]
            }],
            "<" : [SP_MULTICHAR|SP_OPERATOR, {
                "=": [SP_OPERATOR, "<="],
                "" : [SP_OPERATOR, "<"]
            }]
        };

        const Delimiter = {};

        Delimiter.isDelimiter = function isDelimiter(c) {
            return (c in definition);
        };

        Delimiter.isBaseDelimiter = function isBaseDelimiter(c) {
            return (c in definition && (definition[c][0] & SP_BASE) != 0);
        };

        Delimiter.getType = function getType(c) {
            return definition[c][0];
        };

        Delimiter.isOperator = function isOperator(c) {
            return (c in definition && (definition[c][0] & SP_OPERATOR) != 0);
        };

        Delimiter.isMultiChar = function isMultiChar(c) {
            return (definition[c][0] & SP_MULTICHAR) !=  0;
        };

        Delimiter.getOperatorDef = function getOperatorDef(c, def) {
            if (sys.isUndefined(def)) {
                def = definition;
            }
            return def[c][1];
        };

        Delimiter.isOpening = function isOpening(c) {
            return (definition[c][0] & SP_OPEN) != 0;
        };

        Delimiter.isClosing = function isClosing(c) {
            return (definition[c][0] & SP_CLOSE) != 0;
        };

        Delimiter.getExpectedClosing = function getExpectedClosing(c) {
            return definition[c][1];
        };

        Delimiter.getLiteralFactory = function getLiteralFactory(c) {
            return definition[c][2];
        };

        Delimiter.isCommentDelimiter = function isCommentDelimiter(c) {
            return (definition[c][0] & SP_COMMENT) != 0;
        };

        return Delimiter;
    })(); // Delimiter

    function getCharAt(s, _parseCol) {
        return _parseCol < s.length ? s.charAt(_parseCol) : undefined;
    }

    let  _parseExpecting, _parseStack, _parseData, _parseSrcmap, _parseState,
        _parseLine, _parseCol,
        _parseSource,
        _parseWord, _parseWordLine, _parseWordCol, _parseInvbar, _parseInComment,
        _parseLastTo, _parseInProc;

    function reset() { // initialize parser _parseState
        _parseExpecting = undefined;
        _parseStack = [];
        _parseData = logo.type.makeLogoList();
        _parseSrcmap = logo.type.makeLogoList();
        _parseState = "line";
        _parseLine = 0;
        _parseCol = 0;
        _parseWord = "";
        _parseWordLine = 0;
        _parseWordCol = 0;
        _parseInvbar = false;
        _parseInProc = false;
    }
    parse.reset = reset;

    // parse a block; return the result
    // tokenization: escape character, parentheses, operators
    parse.parseBlock = function(comp) {
        function addSrcmapOffset(origSrcmap, offset) {
            let newSrcmap = origSrcmap.slice(0);
            newSrcmap[2] += offset;
            return newSrcmap;
        }

        function processFormalParam(formal) {
            sys.assert(Array.isArray(formal));
            return formal.map(function(v) {
                return logo.type.isLogoVarRef(v) ? logo.env.extractVarName(v) :
                    (Array.isArray(v) && logo.type.isLogoVarRef(v[0])) ? v.splice(0, 1, logo.env.extractVarName(v)) : v;
            });
        }

        let list = comp[0].slice();
        let srcmap = comp[1].slice();

        sys.assert(logo.type.isLogoList(list));

        let ret = logo.type.makeLogoBlock();
        let retsrcmap = logo.type.makeLogoBlock();
        let lastto = -1;

        list.shift();
        srcmap.shift();
        list.forEach(function(word, index){
            if (typeof word != "string" || word.length == 0) {
                ret.push(word);
                retsrcmap.push(srcmap[index]);
                return;
            }

            if (sys.equalToken(word, "to")) {
                sys.assert(lastto == -1, "Nested to?");
                lastto = ret.length;
            } else if (sys.equalToken(word, "end") && lastto != -1) { // ignore end without to
                sys.assert(lastto != -1, "end without to?");
                let proc = logo.type.makeLogoProc([
                    ret[lastto + 1],
                    ret[lastto + 2],
                    logo.type.makeLogoBlock(ret.slice(lastto + 3))]);

                let procsrcmap = logo.type.makeLogoProc([
                    retsrcmap[lastto + 1],
                    retsrcmap[lastto + 2],
                    logo.type.makeLogoBlock(retsrcmap.slice(lastto + 3))]);

                proc[2] = processFormalParam(proc[2]);

                logo.env._ws[proc[1]] = {
                    "formal" : proc[2],
                    "formalsrcmap" : procsrcmap[2],
                    "body" : proc[3],
                    "bodySrcmap" : procsrcmap[3]
                };

                // invalidate generated JS code
                if (proc[1] in logo.env._user) {
                    delete logo.env._user[proc[1]];
                }

                ret.splice(lastto, ret.length - lastto, proc);
                retsrcmap.splice(lastto, retsrcmap.length - lastto, procsrcmap);
                lastto = -1;
                return;
            }

            if (word.substring(0, 1) == "\"") {
                let last = 0;
                let ptr = 1;
                for (; ptr < word.length; ptr++) {
                    let c = word.charAt(ptr);
                    if (c == "\\" && ptr < word.length - 1) {
                        ptr++;
                        continue;
                    }

                    if (c == "(" || c== ")") {
                        if (ptr > last) {
                            ret.push(word.substring(last, ptr));
                            retsrcmap.push(addSrcmapOffset(srcmap[index], last));
                        }

                        ret.push(c);
                        retsrcmap.push(addSrcmapOffset(srcmap[index], ptr));
                        last = ptr + 1;
                        continue;
                    }
                }

                if (ptr > last) {
                    ret.push(word.substring(last, ptr));
                    retsrcmap.push(addSrcmapOffset(srcmap[index], last));
                }

                return;
            }

            let last = 0;
            let ptr = 0;
            for (; ptr < word.length; ptr++) {
                let c = word.charAt(ptr);
                if (c == "(" || c== ")") {
                    if (ptr > last) {
                        ret.push(word.substring(last, ptr).toLowerCase());
                        retsrcmap.push(addSrcmapOffset(srcmap[index], last));
                    }

                    ret.push(c);
                    retsrcmap.push(addSrcmapOffset(srcmap[index], ptr));
                    last = ptr + 1;
                    continue;
                }

                const re_scientificNotation = /^-?\d*\.?\d+e[+-]?\d+/;
                let wordSubString = word.substring(ptr);
                let matched = wordSubString.match(re_scientificNotation);
                if (matched)
                {
                    let captured = matched[0];
                    ptr = ptr + captured.length - 1;
                    continue;
                }

                if (Delimiter.isOperator(c)) {
                    if (ptr > last) {
                        ret.push(word.substring(last, ptr));
                        retsrcmap.push(addSrcmapOffset(srcmap[index], last));
                        last = ptr;
                    }

                    if (Delimiter.isMultiChar(c)) {
                        let nextc = getCharAt(word, ptr + 1);
                        let subdef = Delimiter.getOperatorDef(c);

                        if (nextc in subdef) {
                            ret.push(Delimiter.getOperatorDef(nextc, subdef));
                            retsrcmap.push(addSrcmapOffset(srcmap[index], ptr));
                            ptr++;
                            last = ptr + 1;
                            continue;
                        } else {
                            ret.push(Delimiter.getOperatorDef("", subdef));
                            retsrcmap.push(addSrcmapOffset(srcmap[index], ptr));
                            last = ptr + 1;
                            continue;
                        }
                    }

                    let opdef = Delimiter.getOperatorDef(c);

                    if (c == "-" && ptr == 0 && word.length > 1) {
                        opdef = " " + opdef; // prepend space to signify minus sign identified as unary minus operator (vs. infix difference)
                    }

                    ret.push(opdef);
                    retsrcmap.push(addSrcmapOffset(srcmap[index], ptr));
                    last = ptr + 1;
                    continue;
                }
            }

            if (ptr > last) {
                ret.push(word.substring(last, ptr).toLowerCase());
                retsrcmap.push(addSrcmapOffset(srcmap[index], last));
            }
        });

        return [ret, retsrcmap];
    }; // parse.parseBlock

    // parse a line; result in _parseData/_parseSrcmap
    // tokenization: comments, ~, space, square brackets, curly brackets
    parse.line = function(s) {
        function insertParseWord(parseWordOverride, parseWordPtrOverride) {
            if (!sys.isUndefined(parseWordOverride)) {
                _parseWord = parseWordOverride;
            }

            if (!sys.isUndefined(parseWordPtrOverride)) {
                _parseWordCol = parseWordPtrOverride;
            }

            if (_parseStack.length == 0) {
                if (sys.equalToken(_parseWord, "to")) {
                    sys.assert(_parseLastTo == -1, "Nested formal param list?");
                    _parseLastTo = _parseData.length;
                    _parseInProc = true;
                } else if (sys.equalToken(_parseWord, "end")) {
                    _parseInProc = false;
                }
            }

            sys.trace("TOKEN0="+_parseWord + "\tSRCMAP=" + (_parseWordLine + 1) + "," + (_parseWordCol + 1), "parse");
            _parseData.push(_parseWord);
            _parseSrcmap.push([_parseSource, _parseWordLine + 1, _parseWordCol + 1]);
            _parseWord = "";
        }

        function convertFormalParam() {
            let formal = _parseData.slice(_parseLastTo + 2, _parseData.length);
            let formalsrcmap = _parseSrcmap.slice(_parseLastTo + 2, _parseSrcmap.length);

            _parseData.splice(_parseLastTo + 2, _parseData.length - _parseLastTo - 2, formal);
            _parseSrcmap.splice(_parseLastTo + 2, _parseSrcmap.length - _parseLastTo - 2, formalsrcmap);
        }

        function terminateLine() {
            if (_parseWord != "") {
                //sys.trace("TOKEN="+_parseWord, "parse");
                sys.trace("TOKEN2="+_parseWord + "\tSRCMAP=" + (_parseWordLine + 1) + "," + (_parseWordCol + 1), "parse");
                insertParseWord();
            }

            if (_parseStack.length == 0 && _parseLastTo != -1) {
                convertFormalParam();
                _parseLastTo = -1;
            } else if (_parseStack.length == 0) {
                insertParseWord("\\n", s.length);
            }

            _parseWordLine = _parseLine + 1;
            _parseWordCol = 0;
            _parseInComment = false;
        }

        s = s.replace(/\s+$/g, "");
        for ( ; _parseCol < s.length; _parseCol++) {
            let c = s.charAt(_parseCol);
            if (_parseWord == "") {
                _parseWordLine = _parseLine;
                _parseWordCol = _parseCol;
            }

            sys.trace("_parseCol=" + _parseCol + "\tc=" + c, "parse");

            let isLastChar = (_parseCol == s.length - 1);
            let isSecondLastChar = (_parseCol == s.length - 2);

            if (_parseInComment) {
                if (!isLastChar) { // ignore everthing except last character
                    continue;
                }

                if (c != "~") {
                    if (_parseWord != "") {
                        insertParseWord();
                    }

                    if (_parseStack.length == 0 && _parseLastTo != -1) {
                        convertFormalParam();
                        _parseLastTo = -1;
                    }

                    _parseWordLine = _parseLine + 1;
                    _parseWordCol = 0;
                }

                _parseInComment = false;
                break;
            }

            if (c == "\\") {
                if (isLastChar) {
                    break; // ignores trailing "\"
                }

                _parseWord += c;
                _parseCol++;
                _parseWord += s.charAt(_parseCol);

                if (isSecondLastChar) {
                    terminateLine();
                    break;
                }

                continue;
            }

            if (_parseInvbar) {
                if (c != "|") {
                    _parseWord += c;
                    continue;
                }

                _parseInvbar = false;
                continue;
            }

            if (isLastChar && c == "~") {
                break;
            }

            if (c == ";") {
                _parseInComment = true;
                continue;
            }

            if (Delimiter.isBaseDelimiter(c)) {
                sys.trace("TOKEN1="+_parseWord + "\tSRCMAP=" + (_parseWordLine + 1) + "," + (_parseWordCol + 1), "parse");
                sys.trace("DATA=" + JSON.stringify(_parseData), "parse");

                if (_parseWord != "") {
                    insertParseWord();
                    _parseInComment = false;
                }

                if (Delimiter.isOpening(c)) {
                    _parseStack.push([_parseState, _parseData, _parseExpecting, _parseSrcmap]);
                    _parseState = "line";
                    _parseData = [];
                    _parseSrcmap = [];
                    _parseExpecting = Delimiter.getExpectedClosing(c);
                } else if (Delimiter.isClosing(c)) {
                    if (_parseExpecting != c) {
                        sys.assert(false, "Expecting " + _parseExpecting);
                    }

                    let frame = _parseStack.pop();
                    _parseState = frame[0];

                    let makeLiteral = Delimiter.getLiteralFactory(c);

                    frame[1].push(makeLiteral(_parseData));
                    frame[3].push(makeLiteral(_parseSrcmap));
                    _parseData = frame[1];
                    _parseSrcmap = frame[3];
                    _parseExpecting = frame[2];
                }

                _parseWordLine = _parseLine;
                _parseWordCol = _parseCol + 1;
                continue;
            }

            _parseWord += c;

            if (isLastChar) {
                terminateLine();
                break;
            }
        }
    };

    parse.parseSrc = function(s, srcidx, srcLine) {
        _parseLine = srcLine === undefined ? 0 : srcLine;
        _parseCol = 0;
        _parseSource = srcidx;
        _parseLastTo = -1;

        let lines = s.split(/\r?\n/);

        // parse lines
        lines.forEach(function(line) {
            parse.line(line);
            _parseLine++;
            _parseCol = 0;
        });

        if (_parseStack.length != 0 || _parseInProc || !logo.type.isLogoList(_parseData)) {
            return undefined;
        }

        sys.trace("DATA="+JSON.stringify(_parseData), "parse");
        sys.trace("SRCM="+JSON.stringify(_parseSrcmap), "parse");

        // parse top-level as a block; deploy procs to ws
        let comp = parse.parseBlock([_parseData, _parseSrcmap]);
        _parseData = comp[0];
        _parseSrcmap = comp[1];

        sys.trace("DATA="+JSON.stringify(_parseData), "parse");
        sys.trace("SRCM="+JSON.stringify(_parseSrcmap), "parse");

        // reset
        _parseData = logo.type.makeLogoList();
        _parseSrcmap = logo.type.makeLogoList();

        sys.trace(JSON.stringify(comp), "parse");
        return comp;
    };

    parse.reset();
    return parse;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
