//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Interprets parsed Logo code
// Runs in browser's Logo worker thread or Node's main thread

"use strict";

var classObj = {};
classObj.create = function(logo, sys) {
    const interpreter = {};
    const ctrl = {
        "repeat": evxCtrlRepeat,
        "for": evxCtrlFor,
        "if": evxCtrlIf,
        "ifelse": evxCtrlIfElse,
        "catch": evxCtrlCatch
    };

    let _retVal;

    function makeEvalContext(body, srcmap) {
        const obj = Object.create({
            next: function() {
                if (this.ptr + 1 < this.body.length) {
                    this.ptr++;
                    return true;
                } else {
                    return false;
                }
            },
            getToken: function() {
                return (sys.isUndefined(this.body)) ? undefined :
                    (this.ptr < this.body.length) ? this.body[this.ptr] : undefined;
            },
            getSrcmap: function() {
                return (sys.isUndefined(this.srcmap)) ? undefined :
                    (this.ptr < this.srcmap.length) ? this.srcmap[this.ptr] : undefined;
            },
            isNextTokenBinaryOperator: function() {
                return (this.ptr + 1 >= this.body.length) ? false :
                    logo.lrt.util.isBinaryOperator(this.body[this.ptr + 1]);
            },
            isTokenEndOfStatement: function(token) {
                return sys.isUndefined(token) || token == "\\n";
            },
            peekNextToken : function() {
                if (this.ptr + 1 >= this.body.length) {
                    return undefined;
                }

                return this.body[this.ptr+1];
            },
            getNextOperator: function() {
                return this.body[this.ptr + 1];
            },
            getNextOperatorSrcmap: function() {
                return this.srcmap[this.ptr + 1];
            }
        });

        obj.ptr = 1;
        obj.body = body;
        obj.srcmap = srcmap;
        obj.retVal = undefined;
        obj.retExpr = false;

        return obj;
    }
    interpreter.makeEvalContext = makeEvalContext;

    function evxProcCallParam(evxContext, paramListLength, nextActualParam, precedence) {
        if (sys.isUndefined(precedence)) {
            precedence = 0;
        }

        function forLoopBody(j) {
            evxContext.next();
            logo.env.async(function() {
                evxToken(evxContext, precedence);
            }, function() {
                nextActualParam.push(evxContext.retVal);
            }, function() {
                if (++j < paramListLength) {
                    forLoopBody(j);
                }
            });
        }

        if (0 < paramListLength) {
            forLoopBody(0);
        }
    }

    function evxCtrlParam(evxContext, ctrlName, nextActualParam, precedence, isInParen) {
        if (sys.isUndefined(precedence)) {
            precedence = 0;
        }

        if (sys.isUndefined(isInParen)) {
            isInParen = false;
        }

        const paramListLength = ctrl[ctrlName].length;

        logo.env.async(function() {
            function forLoopBody(j) {
                evxContext.next();
                logo.env.async(function() {
                    evxToken(evxContext, precedence, false, true);
                }, function() {
                    if (sys.isUndefined(evxContext.retVal)) {
                        throw logo.type.LogoException.create("NOT_ENOUGH_INPUTS", [ctrlName], evxContext.getSrcmap(), Error().stack);
                    }

                    let retVal = evxContext.retVal;
                    nextActualParam.push(logo.type.isLogoList(retVal) ? logo.type.makeCompound([retVal, evxContext.getSrcmap()]) : retVal);
                    if (++j < paramListLength) {
                        forLoopBody(j);
                    }
                });
            }

            if (paramListLength > 0) {
                forLoopBody(0);
            }
        }, function() {
            // if pred [list1] else [list2]
            if (ctrlName == "if") {
                let nextToken = evxContext.peekNextToken();
                if (nextToken == "else") {
                    evxContext.next();
                    nextToken = evxContext.peekNextToken();

                    // TODO: if (logo.type.isLogoList(nextToken)) { throw error }
                }

                if (logo.type.isLogoList(nextToken)) {
                    evxContext.next();
                    nextActualParam.push(logo.type.makeCompound([nextToken, evxContext.getSrcmap()]));
                    ctrlName = "ifelse";
                }
            }

            evxContext.retVal = ctrl[ctrlName].apply(undefined, nextActualParam);
        }, function() {
            evxContext.retVal = logo.asyncRetVal;
            logo.asyncRetVal = undefined;
        });
    }

    function evxPrimitiveCallParam(evxContext, primitiveName, nextActualParam, precedence, isInParen) {
        if (sys.isUndefined(precedence)) {
            precedence = 0;
        }

        if (sys.isUndefined(isInParen)) {
            isInParen = false;
        }

        const paramListLength = logo.lrt.util.getPrimitiveParamCount(primitiveName);
        const paramListMinLength = logo.lrt.util.getPrimitiveParamMinCount(primitiveName); // eslint-disable-line no-unused-vars
        const paramListMaxLength = logo.lrt.util.getPrimitiveParamMaxCount(primitiveName);

        let srcmap = evxContext.getSrcmap();

        logo.env.async(function() {
            if (isInParen && (paramListMaxLength > paramListLength || paramListMaxLength == -1)) {
                let forLoopBody = function(j) {
                    logo.env.async(function() {
                        evxToken(evxContext, precedence);
                    }, function() {
                        let retVal = evxContext.retVal;
                        nextActualParam.push(retVal);
                    }, function() {
                        if  ((!isInParen || ((++j < paramListMaxLength || paramListMaxLength == -1) &&
                                isInParen && evxContext.peekNextToken() != ")" )) && evxContext.next()) {
                            forLoopBody(j);
                        }
                    });
                };

                if  ((!isInParen || ((0 < paramListMaxLength || paramListMaxLength == -1) &&
                        isInParen && evxContext.peekNextToken() != ")" )) && evxContext.next()) {
                    forLoopBody(0);
                }
            } else {
                let forLoopBody = function(j) {
                    evxContext.next();
                    logo.env.async(function() {
                        evxToken(evxContext, precedence, false, true);
                    }, function() {
                        if (sys.isUndefined(evxContext.retVal)) {
                            throw logo.type.LogoException.create("NOT_ENOUGH_INPUTS", [primitiveName], evxContext.getSrcmap(), Error().stack);
                        }

                        let retVal = evxContext.retVal;
                        nextActualParam.push(retVal);
                    }, function() {
                        if (++j < paramListLength) {
                            forLoopBody(j);
                        }
                    });
                };

                if (paramListLength > 0) {
                    forLoopBody(0);
                }
            }
        }, function() {
            try {
                evxContext.retVal = logo.lrt.util.getPrimitiveCallTarget(primitiveName).apply(undefined, nextActualParam);
            } catch (e) {
                if (!logo.type.LogoException.is(e)) {
                    throw e;
                }

                throw e.withSrcmap(srcmap);
            }
        }, function() {
            if (logo.type.isLogoAsyncReturn(evxContext.retVal)) {
                evxContext.retVal = logo.type.getLogoAsyncReturnValue(evxContext.retVal);
            }
        });
    }

    function evxToken(evxContext, precedence, isInParen, stopAtLineEnd) {
        logo.env.async(function() {
            evxContext.retVal = undefined;
            if (sys.isUndefined(precedence)) {
                precedence = 0;
            }

            if (sys.isUndefined(isInParen)) {
                isInParen = false;
            }

            if (sys.isUndefined(stopAtLineEnd)) {
                stopAtLineEnd = false;
            }

            let curToken = evxContext.getToken();

            while ((!stopAtLineEnd && curToken == "\\n") && !sys.isUndefined(curToken) && evxContext.next()) {
                curToken = evxContext.getToken();
            }

            if (evxContext.isTokenEndOfStatement(curToken)) {
                return;
            }

            let curSrcmap = evxContext.getSrcmap();
            if (sys.equalToken(curToken, "stop")) {
                throw logo.type.LogoException.create("STOP");
            }

            if (sys.equalToken(curToken, "output") || sys.equalToken(curToken, "op")) {
                evxContext.next();
                logo.env.async(function() {
                    evxToken(evxContext, 0);
                }, function() {
                    throw logo.type.LogoException.create("OUTPUT", evxContext.retVal);
                });

                return;
            }

            logo.env.async(function() {
                let tmp;
                if (typeof curToken !== "object" && !isNaN(tmp = Number(curToken))) {
                    evxContext.retVal = tmp;
                } else if (curToken == "(") {
                    evxParen(evxContext);
                } else if (typeof curToken === "object") {
                    if (logo.type.isLogoProc(curToken)) {
                        // procedure should have been registered to workspace by parser
                    } else if (logo.type.isLogoArray(curToken) || logo.type.isLogoList(curToken)) {
                        evxContext.retVal = curToken.map(sys.toNumberIfApplicable);
                    } else {
                        evxContext.retVal = curToken;
                    }
                } else if (logo.type.isQuotedLogoWord(curToken)) {
                    evxContext.retVal = logo.type.unquoteLogoWord(curToken);
                } else if (logo.type.isLogoVarRef(curToken)) {
                    evxContext.retVal = logo.type.getVarValue(logo.env.extractVarName(curToken), curSrcmap);
                } else {
                    evxCtrlCallProc(evxContext, curToken, curSrcmap, precedence, isInParen);
                }
            }, function() {
                let whileLoopBody = function() {
                    let nextOp = evxContext.getNextOperator();
                    let nextPrec = logo.lrt.util.getBinaryOperatorPrecedence(nextOp);

                    if (precedence >= nextPrec) {
                        return;
                    }

                    logo.env.async(function() {
                        evxCtrlInfixOperator(evxContext, nextOp, nextPrec);
                    }, function() {
                        if (evxContext.isNextTokenBinaryOperator()) {
                            whileLoopBody();
                        }
                    });
                };

                if (evxContext.isNextTokenBinaryOperator()) {
                    whileLoopBody();
                }
            });
        });
    }

    function evxCtrlCallProc(evxContext, curToken, curSrcmap, precedence, isInParen) {
        logo.env.async(function() {
            if (sys.isUndefined(precedence)) {
                precedence = 0;
            }

            let nextActualParam = [];
            curToken = curToken.toLowerCase();
            if (curToken in ctrl) {
                evxCtrlParam(evxContext, curToken, nextActualParam, 0, isInParen);
            } else if (curToken in logo.lrt.primitive) {
                evxPrimitiveCallParam(evxContext, curToken, nextActualParam,
                        logo.lrt.util.getPrimitivePrecedence(curToken), isInParen);
            } else if (curToken in logo.env._user) {
                let callTarget = logo.env._user[curToken];
                logo.env.async(function() {
                    evxProcCallParam(evxContext, callTarget.length, nextActualParam);
                }, function() {
                    evxContext.retVal = callTarget.apply(undefined, nextActualParam);
                });
            } else if (curToken in logo.env._ws) {
                let callTarget = logo.env._ws[curToken];
                logo.env.async(function() {
                    evxProcCallParam(evxContext, callTarget.formal.length, nextActualParam);
                }, function() {
                    evxProc(callTarget, nextActualParam, curToken, curSrcmap);  // proc, parentScope, [actualParam]
                }, function() {
                    evxContext.retVal = _retVal;
                });
            } else {
                throw logo.type.LogoException.create("UNKNOWN_PROC", [curToken], curSrcmap);
            }
        });
    }

    function evxCtrlInfixOperator(evxContext, nextOp, nextPrec) {
        let nextActualParam = [];
        evxContext.next();

        let callTarget = logo.lrt.util.getBinaryOperatorRuntimeFunc(nextOp);
        nextActualParam = [evxContext.retVal];
        logo.env.async(function() {
            evxProcCallParam(evxContext, callTarget.length - 1, nextActualParam, nextPrec);
        }, function() {
            evxContext.retVal = callTarget.apply(undefined, nextActualParam);
        });
    }

    function evxBody(body, srcmap) {
        let evxContext = makeEvalContext(body, srcmap);

        function doWhileBody() {
            logo.env.async(function() {
                evxToken(evxContext);
            }, function() {
                if (!sys.isUndefined(evxContext.retVal) && sys.Config.get("unactionableDatum")) {
                    throw logo.type.LogoException.create("UNACTIONABLE_DATUM", [evxContext.retVal], evxContext.getSrcmap(), Error().stack);
                }
            }, function() {
                if (evxContext.next()) {
                    doWhileBody();
                    return;
                }

                _retVal = evxContext.retVal;
            });
        }
        doWhileBody();
    }
    interpreter.evxBody = evxBody;

    function evxParen(evxContext) {
        logo.env.async(function() {
            evxContext.next();
            logo.env.async(function() { evxToken(evxContext, 0, true); },
                function() {
                    evxContext.next();
                    if (evxContext.getToken() != ")") {
                        throw logo.type.LogoException.create("TOO_MUCH_INSIDE_PAREN", undefined, evxContext.getSrcmap());
                    }
                });
        });
    }

    function evxProc(proc, actualParam, procName, srcmap) {
        const formalParam = proc.formal;
        let retVal = undefined;
        let curScope = {};

        logo.env._scopeStack.push(curScope);
        sys.assert(formalParam.length <= actualParam.length, "formalParam.length > actualParam.length at evxProc");

        for (let i = 0; i < formalParam.length; i++) {
            let formalParamName = formalParam[i];
            curScope[formalParamName] = actualParam[i];
        }

        sys.trace("evxProc "+procName+" token:"+JSON.stringify(proc.body), "evx");
        sys.trace("evxProc "+procName+" srcmap:"+JSON.stringify(proc.srcmap), "evx");
        logo.env._callstack.push([logo.env._curProc, srcmap]);
        logo.env._curProc = procName;

        logo.env.async(
            logo.env.asyncTry(function() {
                evxBody(proc.body, proc.bodySrcmap);
            }), logo.env.asyncCatch(function(e) { // catch block
                if (!logo.type.LogoException.is(e) || e.isError() || e.isCustom()) {
                    return e; // rethrow
                }

                sys.assert(!e.codeEquals("READX"), "READX not expected");
                if (e.codeEquals("OUTPUT")) {
                    retVal = e.getValue();
                }
            }), function() {
                logo.env._curProc = logo.env._callstack.pop()[0];
                logo.env._scopeStack.pop();
                _retVal = retVal;
            });
    }

    function evxCtrlRepeat(count, bodyComp) {
        let body = bodyComp[1];
        let bodySrcmap = bodyComp[2];

        if (logo.type.isLogoList(body)) {
            bodyComp = logo.parse.parseBlock([body, bodySrcmap]);
            body = bodyComp[0];
            bodySrcmap = bodyComp[1];
        }

        sys.assert(logo.type.isLogoBlock(body), "Expecting logo block, got " + body);

        function forLoopBody(i) {
            logo.env.async(function() {
                evxBody(body, bodySrcmap);
            }, function() {
                if (++i < count) {
                    forLoopBody(i);
                }
            });
        }

        if (0 < count) {
            forLoopBody(0);
        }
    }

    function evxCtrlFor(forCtrlComp, bodyComp) {
        sys.assert(logo.type.isCompound(forCtrlComp));
        let forCtrl = forCtrlComp[1];
        let forCtrlSrcmap = forCtrlComp[2];

        if (logo.type.isLogoList(forCtrl)) {
            forCtrlComp = logo.parse.parseBlock([forCtrl, forCtrlSrcmap]);
            forCtrl = forCtrlComp[0];
            forCtrlSrcmap = forCtrlComp[1];
        }

        sys.assert(logo.type.isCompound(bodyComp));
        let body = bodyComp[1];
        let bodySrcmap = bodyComp[2];

        if (logo.type.isLogoList(body)) {
            bodyComp = logo.parse.parseBlock([body, bodySrcmap]);
            body = bodyComp[0];
            bodySrcmap = bodyComp[1];
        }

        sys.assert(logo.type.isLogoBlock(forCtrl), "primitiveFor "+forCtrl[0]);
        let evxContext = makeEvalContext(forCtrl, forCtrlSrcmap);
        let forVarName = evxContext.getToken();
        evxContext.next();

        let forBegin, forEnd, forStep;
        logo.env.async(function() {
            evxToken(evxContext);
        }, function() {
            forBegin = evxContext.retVal;
            evxContext.next();
            evxToken(evxContext);
        }, function() {
            forEnd = evxContext.retVal;
            evxContext.retVal = undefined;
            if (evxContext.next()) {
                evxToken(evxContext);
            }
        }, function() {
            forStep = evxContext.retVal;
            let curScope = logo.env._scopeStack[logo.env._scopeStack.length - 1];
            let isDecrease = forEnd < forBegin;

            if (sys.isUndefined(forStep)) {
                forStep = isDecrease ? -1 : 1;
            }

            curScope[forVarName] = forBegin;
            if ((!isDecrease && curScope[forVarName] <= forEnd) || (isDecrease && curScope[forVarName] >= forEnd)) {
                forLoopBody();
            }

            function forLoopBody() {
                logo.env.async(function() {
                    evxBody(body, bodySrcmap);
                }, function() {
                    curScope[forVarName] += forStep;
                    if ((!isDecrease && curScope[forVarName] <= forEnd) || (isDecrease && curScope[forVarName] >= forEnd)) {
                        forLoopBody();
                    }
                });
            }
        });
    }

    function evxCtrlIf(predicate, bodyComp) {
        sys.assert(logo.type.isCompound(bodyComp));
        if (logo.type.isNotLogoFalse(predicate)) {
            let comp =  logo.parse.parseBlock([bodyComp[1], bodyComp[2]]);
            let body = comp[0];
            let bodySrcmap = comp[1];

            if (!logo.type.isLogoBlock(body)) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["if", body], bodySrcmap, Error().stack);
            }

            evxBody(body, bodySrcmap);
        }
    }

    function evxCtrlCatch(label, bodyComp) {
        sys.assert(logo.type.isCompound(bodyComp));

        let comp =  logo.parse.parseBlock([bodyComp[1], bodyComp[2]]);
        let body = comp[0];
        let bodySrcmap = comp[1];

        if (!logo.type.isLogoBlock(body)) {
            throw logo.type.LogoException.create("INVALID_INPUT", ["catch", body], bodySrcmap, Error().stack);
        }

        logo.env.async(
            logo.env.asyncTry(function() {
                logo.env.async(function() {
                    evxBody(body, bodySrcmap);
                });
            }),
            logo.env.asyncCatch(function(e) {
                if (logo.type.LogoException.is(e) && e.isCustom()) {
                    if (sys.equalToken(label, e.getValue()[0])) {
                        logo.asyncRetVal = e.getValue()[1];
                        return;
                    }

                    return e; // rethrow if tag doesn't match label
                }

                if (!logo.type.LogoException.is(e) || e.codeEquals("STOP") || e.codeEquals("OUTPUT") ||
                        (e.isError() && !sys.equalToken(label, "error"))) {
                    return e; // rethrow
                }

                // caught and continue execution past catch statement
            }));
    }

    function evxCtrlIfElse(predicate, trueBodyComp, falseBodyComp) {
        sys.assert(logo.type.isCompound(trueBodyComp));
        sys.assert(logo.type.isCompound(falseBodyComp));

        let trueBody = trueBodyComp[1];
        let trueBodySrcmap = trueBodyComp[2];
        let falseBody = falseBodyComp[1];
        let falseBodySrcmap = falseBodyComp[2];

        if (logo.type.isNotLogoFalse(predicate)) {
            let comp = logo.parse.parseBlock([trueBody, trueBodySrcmap]);
            let body = comp[0];
            let bodySrcmap = comp[1];
            if (!logo.type.isLogoBlock(body)) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["if", body], bodySrcmap, Error().stack);
            }

            evxBody(body, bodySrcmap);
        } else {
            let comp = logo.parse.parseBlock([falseBody, falseBodySrcmap]);
            let body = comp[0];
            let bodySrcmap = comp[1];
            if (!logo.type.isLogoBlock(body)) {
                throw logo.type.LogoException.create("INVALID_INPUT", ["if", body], bodySrcmap, Error().stack);
            }

            evxBody(body, bodySrcmap);
        }
    }

    return interpreter;
};

if (typeof exports != "undefined") {
    exports.classObj = classObj;
}
