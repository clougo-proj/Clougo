//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Logo parser

export default {
    "create": function(logo, sys) {
        const parse = {};

        const LOGO_EVENT = logo.constants.LOGO_EVENT;

        const PROC_ATTRIBUTE = logo.constants.PROC_ATTRIBUTE;

        const PROC_DECL = "to";

        const MACRO_DECL = ".macro";

        const NOT_APPLICABLE = -1;

        const Delimiter = (() => {
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
                "(" : [SP_OPEN, ")"],
                ")" : [SP_CLOSE, "("],
                "[" : [SP_BASE|SP_OPEN, "]", logo.type.makeLogoList],
                "]" : [SP_BASE|SP_CLOSE, "["],
                "{" : [SP_BASE|SP_OPEN, "}", logo.type.makeLogoArray],
                "}" : [SP_BASE|SP_CLOSE, "{"],
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
                    ">": [SP_OPERATOR, "<>"],
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

            Delimiter.getOperatorDef = function getOperatorDef(c, def = definition) {
                return def[c][1];
            };

            Delimiter.isOpening = function isOpening(c) {
                return (c in definition && (definition[c][0] & SP_OPEN)) != 0;
            };

            Delimiter.isClosing = function isClosing(c) {
                return (c in definition && (definition[c][0] & SP_CLOSE)) != 0;
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

        function isMultiline() {
            return _parseStack.length != 0 || _parseInProc || !logo.type.isLogoList(_parseData);
        }

        function isVerticalBar() {
            return _parseInvbar;
        }

        let _parseExpecting, _parseStack, _parseData, _parseSrcmap,
            _parseLine, _parseCol,
            _parseSource,
            _parseWord, _parseWordLine, _parseWordCol, _parseInvbar, _parseInComment,
            _parseLastTo, _parseInProc, _parseLiteralMask;

        function reset() {
            resetParseData();
            _parseExpecting = undefined;
            _parseStack = [];
            _parseLine = 0;
            _parseCol = 0;
            _parseWord = "";
            _parseLiteralMask = [];
            _parseWordLine = 0;
            _parseWordCol = 0;
            _parseInvbar = false;
            _parseInProc = false;
        }
        parse.reset = reset;

        function resetParseData() {
            _parseData = logo.type.makeLogoList();
            _parseSrcmap = logo.type.makeLogoList();
        }

        function makeSrcmap() {
            return [_parseSource, _parseLine + 1, _parseCol + 1];
        }

        function makeWordSrcmap() {
            return _parseLiteralMask.length == 0 ? [_parseSource, _parseWordLine + 1, _parseWordCol + 1] :
                [_parseSource, _parseWordLine + 1, _parseWordCol + 1, _parseLiteralMask];
        }

        function getLiteralMaskFromSrcmap(srcmap) {
            if (Array.isArray(srcmap) && srcmap.length == 4 && Array.isArray(srcmap[3])) {
                return srcmap[3];
            }

            return [];
        }

        function pushParseStack(expectedClosing) {
            _parseStack.push([_parseExpecting]);
            _parseExpecting = expectedClosing;
        }

        function popParseStack() {
            _parseExpecting = _parseStack.pop()[0];
        }

        function pushParseStackWithData(expectedClosing, makeLiteral) {
            _parseStack.push([_parseExpecting, _parseData, _parseSrcmap]);
            _parseExpecting = expectedClosing;
            _parseData =  makeLiteral();
            _parseSrcmap =  logo.type.annotateSrcmap(makeLiteral(), makeSrcmap());
        }

        function popParseStackWithData() {
            let frame = _parseStack.pop();

            frame[1].push(_parseData);
            frame[2].push(_parseSrcmap);

            _parseExpecting = frame[0];
            _parseData = frame[1];
            _parseSrcmap = frame[2];
        }

        function getEscapeChar(c) {
            const escapeChar = {
                "n": "\n",
                "t": "\t",
                "(": "\\(",
                ")": "\\)",
                "[": "\\[",
                "]": "\\]",
                "{": "\\{",
                "}": "\\}",
                "\\": "\\"
            };

            return (c in escapeChar) ? escapeChar[c] : c;
        }

        // parse a block; return the result
        // tokenization: escape character, parentheses, operators
        parse.parseBlock = function(comp) {
            sys.assert(logo.type.isLogoList(comp));
            let list = logo.type.unboxList(comp);
            let blockHasSrcmap = logo.type.isLogoListLiteral(comp);
            let srcmap = blockHasSrcmap ?
                logo.type.unboxList(logo.type.getEmbeddedSrcmap(comp)) :
                logo.type.SRCMAP_NULL;

            let retsrcmap = blockHasSrcmap ? logo.type.makeLogoList() : logo.type.SRCMAP_NULL;
            let ret = logo.type.makeLogoList(undefined, retsrcmap);
            let lastIf = undefined;

            list.forEach(processWord);

            return ret;

            function addSrcmapOffset(origSrcmap, offset) {
                if (origSrcmap === logo.type.SRCMAP_NULL) {
                    return logo.type.SRCMAP_NULL;
                }

                let newSrcmap = origSrcmap.slice(0);
                newSrcmap[2] += offset;
                return newSrcmap;
            }

            function processWord(word, index){
                if (typeof word != "string" || word.length == 0) {
                    ret.push(word);
                    if (blockHasSrcmap) {
                        retsrcmap.push(srcmap[index]);
                    }

                    return;
                }

                let last = 0;
                let ptr = 0;
                let isStringLiteral = false;
                let literalMask = getLiteralMaskFromSrcmap(srcmap[index]);
                let literalMaskPtr = 0;
                let inVbar = false;
                if (word.substring(0, 1) == "\"") {
                    ptr = 1;
                    isStringLiteral = true;
                }

                for (; ptr < word.length; ptr++) {
                    let c = word.charAt(ptr);
                    if (literalMask.length !== 0 && ptr === literalMask[literalMaskPtr]) {
                        inVbar = !inVbar;
                        literalMaskPtr += 1;
                    }

                    if (inVbar) {
                        continue;
                    }

                    if (isStringLiteral) {
                        let c = word.charAt(ptr);
                        if (c == "\\" && ptr < word.length - 1) {
                            ptr++;
                            continue;
                        }
                    }

                    if (c == "(" || c== ")") {
                        if (ptr > last) {
                            captureToken(word.substring(last, ptr), last);
                        }

                        captureToken(c, ptr);
                        last = ptr + 1;
                        isStringLiteral = false;
                        continue;
                    }

                    if (isStringLiteral) {
                        continue;
                    }

                    const re_scientificNotation = /^-?\d*\.?\d+e[+-]?\d+/;
                    let wordSubString = word.substring(ptr);
                    let matched = wordSubString.match(re_scientificNotation);
                    if (matched) {
                        let captured = matched[0];
                        ptr = ptr + captured.length - 1;
                        continue;
                    }

                    if (Delimiter.isOperator(c)) {
                        if (ptr > last) {
                            captureToken(word.substring(last, ptr), last);
                            last = ptr;
                        }

                        if (Delimiter.isMultiChar(c)) {
                            let nextc = getCharAt(word, ptr + 1);
                            let subdef = Delimiter.getOperatorDef(c);

                            if (nextc in subdef) {
                                captureToken(Delimiter.getOperatorDef(nextc, subdef), ptr);
                                ptr++;
                            } else {
                                captureToken(Delimiter.getOperatorDef("", subdef), ptr);
                            }
                        } else {
                            let opdef = Delimiter.getOperatorDef(c);

                            if (c == "-" && ptr == 0 && word.length > 1) {
                                opdef = " " + opdef; // prepend space to signify minus sign identified as unary minus operator (vs. infix difference)
                            }

                            captureToken(opdef, ptr);
                        }

                        last = ptr + 1;
                    }
                }

                if (ptr > last) {
                    captureToken(word.substring(last, ptr), last);
                }

                function captureToken(token, offset) {
                    if (logo.config.get("clougo")) {
                        if (token == "if") {
                            lastIf = ret.length;
                        } else if (token == "else" && lastIf !== undefined) {
                            ret[lastIf] = "ifelse";
                            lastIf = undefined;
                            return;
                        }
                    }

                    ret.push(isStringLiteral ? token : token.toLowerCase());
                    if (blockHasSrcmap) {
                        retsrcmap.push(addSrcmapOffset(srcmap[index], offset));
                    }
                }
            }

        }; // parse.parseBlock

        // parse procedures; return the result
        parse.parseProc = function(comp) {
            sys.assert(logo.type.isLogoList(comp));
            let parseCode = logo.type.unboxList(comp);
            let srcmap = logo.type.unboxList(logo.type.getEmbeddedSrcmap(comp));

            let retsrcmap = logo.type.makeLogoList();
            let ret = logo.type.makeLogoList(undefined, retsrcmap);

            let lastto = NOT_APPLICABLE;

            parseCode.forEach((word, index) => {
                if ((sys.equalToken(word, PROC_DECL) || sys.equalToken(word, MACRO_DECL)) && lastto === NOT_APPLICABLE) {
                    lastto = ret.length;
                }

                if (sys.equalToken(word, "end") && lastto !== NOT_APPLICABLE) {
                    defineParsedProc();
                    return;
                }

                ret.push(word);
                retsrcmap.push(srcmap[index]);
            });

            return ret;

            function processFormalParam(formal) {
                sys.assert(Array.isArray(formal));
                return formal.map(v =>
                    logo.type.isLogoVarRef(v) ? logo.env.extractVarName(v) :
                        (Array.isArray(v) && logo.type.isLogoVarRef(v[2])) ?
                            (v.splice(2, 1, logo.env.extractVarName(v[2])), v) : v);
            }

            function defineParsedProc() {
                sys.assert(lastto != NOT_APPLICABLE, "end without to?");
                let procName = ret[lastto + 1].toLowerCase();
                let formal = processFormalParam(ret[lastto + 2]);
                let formalSrcmap = retsrcmap[lastto + 2];
                let body = logo.type.makeLogoList(ret.slice(lastto + 3));
                let bodySrcmap = logo.type.makeLogoList(retsrcmap.slice(lastto + 3));
                let attributes = (ret[lastto] == MACRO_DECL) ? PROC_ATTRIBUTE.MACRO : PROC_ATTRIBUTE.EMPTY;

                logo.env.defineLogoProcSignatureAtParse(procName, formal, formalSrcmap, attributes);

                ret.splice(lastto, ret.length - lastto, logo.type.makeLogoProc(procName, formal, body, attributes));
                retsrcmap.splice(lastto, retsrcmap.length - lastto,
                    logo.type.makeLogoProc(procName, formalSrcmap, bodySrcmap, attributes));

                lastto = NOT_APPLICABLE;
            }
        }; // parse.parseProc

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
                    if (sys.equalToken(_parseWord, PROC_DECL) || sys.equalToken(_parseWord, MACRO_DECL)) {
                        sys.assert(_parseLastTo == NOT_APPLICABLE, "Nested formal param list?");
                        _parseLastTo = _parseData.length;
                        _parseInProc = true;
                    } else if (sys.equalToken(_parseWord, "end")) {
                        _parseInProc = false;
                    }
                }

                logo.trace.info("TOKEN0="+_parseWord + "\tSRCMAP=" + (_parseWordLine + 1) + "," + (_parseWordCol + 1), "parse");
                _parseData.push(_parseWord);
                _parseSrcmap.push(makeWordSrcmap());
                _parseWord = "";
                _parseLiteralMask = [];
            }

            function convertFormalParam() {
                if (_parseLastTo + 1 === _parseData.length) {
                    throw logo.type.LogoException.NOT_ENOUGH_INPUTS.withParam(["to"], makeSrcmap());
                }

                let formal = _parseData.slice(_parseLastTo + 2, _parseData.length);
                let formalSrcmap = _parseSrcmap.slice(_parseLastTo + 2, _parseSrcmap.length);

                _parseData.splice(_parseLastTo + 2, _parseData.length - _parseLastTo - 2, formal);
                _parseSrcmap.splice(_parseLastTo + 2, _parseSrcmap.length - _parseLastTo - 2, formalSrcmap);
            }

            function terminateLine() {
                if (_parseWord != "") {
                    logo.trace.info("TOKEN2="+_parseWord + "\tSRCMAP=" + (_parseWordLine + 1) + "," + (_parseWordCol + 1), "parse");
                    insertParseWord();
                }

                if (_parseStack.length == 0 && _parseLastTo != NOT_APPLICABLE) {
                    convertFormalParam();
                    _parseLastTo = NOT_APPLICABLE;
                } else if (_parseStack.length == 0) {
                    insertParseWord(logo.type.NEWLINE, s.length);
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

                logo.trace.info("_parseCol=" + _parseCol + "\tc=" + c, "parse");

                let isLastChar = (_parseCol == s.length - 1);
                let isSecondLastChar = (_parseCol == s.length - 2);

                if (_parseInComment) {
                    if (!isLastChar) { // ignore everthing except last character
                        continue;
                    }

                    if (c != "~") {
                        terminateLine();
                        break;
                    }

                    _parseInComment = false;
                    break;
                }

                if (_parseInvbar) {
                    if (c == "|") {
                        _parseInvbar = false;
                        _parseLiteralMask.push(_parseWord.length);
                        if (isLastChar) {
                            terminateLine();
                            break;
                        }
                    } else {
                        _parseWord += c;
                        if (isLastChar) {
                            _parseWord += "\n";
                            break;
                        }
                    }

                    continue;
                }

                if (c == "|") {
                    _parseInvbar = true;
                    _parseLiteralMask.push(_parseWord.length);
                    continue;
                }


                if (c == "\\") {
                    if (isLastChar) {
                        break; // ignores trailing "\"
                    }

                    _parseLiteralMask.push(_parseWord.length);
                    _parseWord += getEscapeChar(s.charAt(++_parseCol));
                    _parseLiteralMask.push(_parseWord.length);

                    if (isSecondLastChar) {
                        terminateLine();
                        break;
                    }

                    continue;
                }

                if (isLastChar && c == "~") {
                    break;
                }

                if (c == ";") {
                    _parseInComment = true;
                    if (isLastChar) {
                        terminateLine();
                        break;
                    }

                    continue;
                }

                if (Delimiter.isBaseDelimiter(c)) {
                    logo.trace.info("TOKEN1="+_parseWord + "\tSRCMAP=" + (_parseWordLine + 1) + "," + (_parseWordCol + 1), "parse");
                    logo.trace.info("DATA=" + JSON.stringify(_parseData), "parse");

                    if (_parseWord != "") {
                        insertParseWord();
                        _parseInComment = false;
                    }

                    if (Delimiter.isOpening(c)) {
                        pushParseStackWithData(Delimiter.getExpectedClosing(c), Delimiter.getLiteralFactory(c));
                    } else if (Delimiter.isClosing(c)) {
                        if (_parseExpecting !== c) {
                            throw logo.type.LogoException.UNEXPECTED_TOKEN.withParam([c], makeSrcmap());
                        }

                        popParseStackWithData();
                    }

                    _parseWordLine = _parseLine;
                    _parseWordCol = _parseCol + 1;

                    if (isLastChar) {
                        terminateLine();
                        break;
                    }

                    continue;
                }

                if (Delimiter.isOpening(c)) {
                    pushParseStack(Delimiter.getExpectedClosing(c));
                } else if (Delimiter.isClosing(c)) {
                    if (_parseExpecting !== c) {
                        throw logo.type.LogoException.UNEXPECTED_TOKEN.withParam([c], makeSrcmap());
                    }
                    popParseStack();
                }

                _parseWord += c;

                if (isLastChar) {
                    terminateLine();
                    break;
                }
            }
        };

        parse.parseSrc = function(s, srcidx, srcLine) {

            function parseLines(lines) {
                lines.forEach(line => {
                    parse.line(line);
                    _parseLine++;
                    _parseCol = 0;
                });
            }

            function tryParseLines(lines) {
                try {
                    parseLines(lines);
                } catch (e) {
                    if (!logo.type.LogoException.is(e)) {
                        throw e;
                    } else {
                        logo.io.stderr(e.formatMessage());
                        logo.io.stderr("    at " + logo.type.srcmapToLineRow(e.getSrcmap()));
                        reset();
                    }
                }
            }

            _parseLine = srcLine === undefined ? 0 : srcLine;
            _parseCol = 0;
            _parseSource = srcidx;
            _parseLastTo = NOT_APPLICABLE;

            tryParseLines(s.split(/\r?\n/));

            if (isVerticalBar() || isMultiline()) {
                return undefined;
            }

            sys.assert(logo.type.isLogoList(_parseData), "expecting list!");
            let comp = parse.parseProc(logo.type.embedSrcmap(_parseData, _parseSrcmap));
            logo.trace.info(JSON.stringify(comp), "parse");

            resetParseData();
            return comp;
        };

        parse.parseSignature = function(s) {
            _parseLine = 0;
            _parseCol = 0;
            _parseSource = 0;
            _parseLastTo = NOT_APPLICABLE;

            parse.line(s);
            let ret = _parseData.slice(2, _parseData.length - 1);
            resetParseData();
            return ret;
        };

        parse.getParserState = function() {
            return isVerticalBar() ? LOGO_EVENT.VERTICAL_BAR :
                isMultiline() ? LOGO_EVENT.MULTILINE : LOGO_EVENT.READY;
        };

        parse.reset();
        return parse;
    }
};
