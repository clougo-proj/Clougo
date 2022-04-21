//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements Logo's graphics primitives
// Runs in Logo worker thread

export default {
    "create": function(logo, sys) {
        const graphics = {};

        const originX = 0;
        const originY = 0;
        const originalHeading = 0; // deg
        const originalPenSize = logo.type.makeLogoList([1, 1]);

        const defaultCanvasFont = "24px arial";
        const defaultLabelFont = logo.type.makeLogoList([logo.type.makeLogoList(["Arial"]), 24, 0, 0, 400, 0, 0, 0, 1, 0, 0, 0, 0]);

        const MAX_UNDO_DEPTH = logo.constants.MAX_UNDO_DEPTH;

        const KEYBOARD_EVENT_CODE_CODE = logo.constants.KEYBOARD_EVENT_CODE_CODE;

        const KEYBOARD_EVENT_KEY_CODE = logo.constants.KEYBOARD_EVENT_KEY_CODE;

        const MOUSE_MAIN_BUTTON = 0;

        const MOUSE_SECONDARY_BUTTON = 2;

        const methods = {
            "forward": primitiveForward,
            "fd": primitiveForward,

            "back": primitiveBack,
            "bk": primitiveBack,

            "left": primitiveLeft,
            "lt": primitiveLeft,

            "right": primitiveRight,
            "rt": primitiveRight,

            "home": primitiveHome,

            "clearscreen": primitiveClearscreen,
            "cs": primitiveClearscreen,

            "draw": primitiveDraw,

            "clean": primitiveClean,

            "hideturtle": primitiveHideturtle,
            "ht": primitiveHideturtle,

            "showturtle": primitiveShowturtle,
            "st": primitiveShowturtle,

            "shownp": primitiveShownp,
            "shown?": primitiveShownp,

            "pendown": primitivePendown,
            "pd": primitivePendown,

            "pendownp": primitivePendownp,
            "pendown?": primitivePendownp,

            "penup": primitivePenup,
            "pu": primitivePenup,

            "penpaint": primitivePenpaint,
            "pp": primitivePenpaint,
            "ppt": primitivePenpaint,

            "penerase": primitivePenerase,
            "pe": primitivePenerase,

            "penreverse": primitivePenreverse,
            "px": primitivePenreverse,

            "penmode": primitivePenmode,

            "setbackground": primitiveSetbackground,
            "setbg": primitiveSetbackground,

            "setscreencolor": primitiveSetbackground,
            "setsc": primitiveSetbackground,

            "setfloodcolor": primitiveSetfloodcolor,
            "setfc": primitiveSetfloodcolor,

            "setpencolor": primitiveSetpencolor,
            "setpc": primitiveSetpencolor,

            "setpensize": primitiveSetpensize,

            "pensize": primitivePensize,

            "circle": [primitiveCircle, "radius [fill \"False]"],

            "circle2": [primitiveCircle2, "radius [fill \"False]"],

            "arc": primitiveArc,

            "arc2": primitiveArc2,

            "ellipse": [primitiveEllipse, "radiusX radiusY [fill \"False]"],

            "ellipse2": [primitiveEllipse2, "radiusX radiusY [fill \"False]"],

            "ellipsearc": primitiveEllipsearc,

            "ellipsearc2": primitiveEllipsearc2,

            "label": primitiveLabel,

            "labelfont": primitiveLabelfont,

            "setlabelfont": primitiveSetlabelfont,

            "fill": [primitiveFill, "[fillmode \"False]"],

            "setxy": primitiveSetxy,

            "setpos": primitiveSetpos,

            "setx": primitiveSetx,

            "sety": primitiveSety,

            "setheading": primitiveSetheading,
            "seth": primitiveSetheading,

            "pos": primitivePos,

            "xcor": primitiveXcor,

            "ycor": primitiveYcor,

            "heading": primitiveHeading,

            "towards": primitiveTowards,

            "pencolor": primitivePencolor,
            "pc": primitivePencolor,

            "floodcolor": primitiveFloodcolor,

            "keyboardon": [primitiveKeyboardon, "keydown [keyup .novalue]"],

            "keyboardoff": primitiveKeyboardoff,

            "keyboardvalue": primitiveKeyboardvalue,

            "mouseon": primitiveMouseon,

            "mouseoff": primitiveMouseoff,

            "mousepos": primitiveMousepos,

            "clickpos": primitiveClickpos,

            "buttonp": primitiveButtonp,
        };
        graphics.methods = methods;

        let _showTurtle = true;

        let _turtleX = originX;
        let _turtleY = originY;
        let _turtleHeading = originalHeading;
        let _undoStack = [];

        let _penDown = true;
        let _penMode = "paint";
        let _floodColor = 0;
        let _penColor = 0;
        let _bgColor = 15;
        let _penSize = originalPenSize;

        let _mouseX = originX;
        let _mouseY = originY;
        let _mouseClickX = originX;
        let _mouseClickY = originY;
        let _mouseDown = false;

        let _labelFont = defaultLabelFont;

        let _onKeyDown, _onKeyUp;
        let _lastKeyboardValue = 0;

        let _onLeftButtonDown, _onLeftButtonUp, _onRightButtonDown, _onRightButtonUp, _onMove;

        function primitivePendown() {
            _penDown = true;
        }

        function primitivePendownp() {
            return _penDown;
        }

        function primitivePenup() {
            _penDown = false;
        }

        function primitivePenpaint() {
            _penDown = true;
            _penMode = "paint";
            logo.ext.canvas.sendCmd("penpaint");
        }

        function primitivePenerase() {
            _penDown = true;
            _penMode = "erase";
            logo.ext.canvas.sendCmd("penerase");
        }

        function primitivePenreverse() {
            _penDown = true;
            _penMode = "reverse";
            logo.ext.canvas.sendCmd("penreverse");
        }

        function primitivePenmode() {
            return _penMode;
        }

        function primitiveShowturtle() {
            _showTurtle = true;
            logo.ext.canvas.sendCmd("showturtle");
        }

        function primitiveHideturtle() {
            _showTurtle = false;
            logo.ext.canvas.sendCmd("hideturtle");
        }

        function primitiveShownp() {
            return _showTurtle;
        }

        function primitiveForward(distance) {
            logo.type.validateInputNumber(distance);
            _turtleX += Math.sin(logo.type.degToRad(_turtleHeading)) * distance;
            _turtleY += Math.cos(logo.type.degToRad(_turtleHeading)) * distance;
            logo.ext.canvas.sendCmd(
                _penDown ? "drawto" : "moveto",
                [_turtleX, _turtleY, _turtleHeading]
            );
        }

        function primitiveBack(distance) {
            logo.type.validateInputNumber(distance);
            _turtleX -= Math.sin(logo.type.degToRad(_turtleHeading)) * distance;
            _turtleY -= Math.cos(logo.type.degToRad(_turtleHeading)) * distance;
            logo.ext.canvas.sendCmd(
                _penDown ? "drawto" : "moveto",
                [_turtleX, _turtleY, _turtleHeading]
            );
        }

        function primitiveClearscreen() {
            _turtleX = originX;
            _turtleY = originY;
            _turtleHeading = originalHeading;
            logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
            logo.ext.canvas.sendCmd("clean");
        }

        function primitiveDraw() {
            primitiveClearscreen();
            primitivePendown();
            primitiveShowturtle();
            primitiveSetpensize(1);
            primitiveSetpencolor(0);
            primitiveSetbackground(15);
            primitiveSetfloodcolor(0);
            primitiveSetlabelfont(defaultLabelFont);
        }
        graphics.draw = primitiveDraw;

        function primitiveClean() {
            logo.ext.canvas.sendCmd("clean");
        }

        function primitiveSetxy(newX, newY) {
            logo.type.validateInputNumber(newX);
            logo.type.validateInputNumber(newY);
            _turtleX = newX;
            _turtleY = newY;
            logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
        }

        function primitivePos() {
            return logo.type.makeLogoList([sys.logoFround6(_turtleX), sys.logoFround6(_turtleY)]);
        }

        function primitiveSetpos(pos) {
            logo.type.validateInputXY(pos);
            _turtleX = logo.type.listItem(1, pos);
            _turtleY = logo.type.listItem(2, pos);
            logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
        }

        function primitiveXcor() {
            return _turtleX;
        }

        function primitiveSetx(newX) {
            logo.type.validateInputNumber(newX);
            _turtleX = newX;
            logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
        }

        function primitiveYcor() {
            return _turtleY;
        }

        function primitiveSety(newY) {
            logo.type.validateInputNumber(newY);
            _turtleY = newY;
            logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
        }

        function primitiveHeading() {
            return _turtleHeading;
        }

        function primitiveSetheading(deg) {
            logo.type.validateInputNumber(deg);
            _turtleHeading = moduloDeg(deg);
            logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
        }

        function primitiveTowards(pos) {
            logo.type.validateInputXY(pos);
            let dX = logo.type.listItem(1, pos) - _turtleX;
            let dY = logo.type.listItem(2, pos) - _turtleY;

            if (dX == 0) {
                return (dY < 0) ? 180 : 0;
            }

            if (dY == 0) {
                return (dX < 0) ? 270 : 90;
            }

            let deg = logo.type.radToDeg(Math.atan2(dX, dY));
            return (deg < 0) ? deg + 360 : deg;
        }

        function primitiveSetbackground(color) {
            logo.type.validateInputRGB(color);
            _bgColor = logo.type.getRGB(color);
            logo.ext.canvas.sendCmd("bgcolor", _bgColor);
        }

        function primitiveSetfloodcolor(color) {
            logo.type.validateInputRGB(color);
            _floodColor = logo.type.isPaletteIndex(color) ? color : logo.type.makeLogoList(logo.type.getRGB(color));
            logo.ext.canvas.sendCmd("fillcolor", logo.type.getRGB(_floodColor));
        }

        function primitiveFloodcolor() {
            return _floodColor;
        }

        function primitiveSetpencolor(color) {
            logo.type.validateInputRGB(color);
            _penColor = logo.type.isPaletteIndex(color) ? color : logo.type.makeLogoList(logo.type.getRGB(color));
            logo.ext.canvas.sendCmd("pencolor", logo.type.getRGB(_penColor));
        }

        function primitivePencolor() {
            return _penColor;
        }

        function primitiveSetpensize(size) {
            logo.type.validateInputPensize(size);
            let actualSize = sys.isInteger(size) ? size : Math.floor(logo.type.listItem(2, size));
            _penSize = logo.type.makeLogoList([actualSize, actualSize]);
            logo.ext.canvas.sendCmd("pensize", [actualSize]);
        }

        function primitivePensize() {
            return _penSize;
        }

        function primitiveCircle(radius, fill = false) {
            logo.type.validateInputNonNegNumber(radius);
            logo.type.validateInputBoolean(fill);
            if (_penDown) {
                logo.ext.canvas.sendCmd("arc", [_turtleX, _turtleY, radius, 0, 360, false, logo.type.logoBoolean(fill)]);
            }
        }

        function primitiveCircle2(radius, fill = false) {
            logo.type.validateInputNonNegNumber(radius);
            logo.type.validateInputBoolean(fill);
            if (_penDown) {
                logo.ext.canvas.sendCmd("arc", [
                    _turtleX + Math.cos(logo.type.degToRad(_turtleHeading)) * radius,
                    _turtleY - Math.sin(logo.type.degToRad(_turtleHeading)) * radius,
                    radius,
                    0,
                    360,
                    false,
                    logo.type.logoBoolean(fill)]);
            }
        }

        function primitiveArc(deg, radius) {
            logo.type.validateInputNonNegNumber(radius);
            logo.type.validateInputNumber(deg);
            if (_penDown) {
                let sAngle = (_turtleHeading + 90) % 360;

                if (radius < 0) {
                    radius = - radius;
                    sAngle = (sAngle + 180) % 360;
                }

                logo.ext.canvas.sendCmd("arc", [
                    _turtleX,
                    _turtleY,
                    radius,
                    sAngle,
                    sAngle + deg,
                    deg < 0,
                    false]);
            }
        }

        function primitiveArc2(deg, radius) {
            logo.type.validateInputNonNegNumber(radius);
            logo.type.validateInputNumber(deg);
            let sAngle = (_turtleHeading + 180) % 360;
            if (radius < 0) {
                radius = -radius;
                sAngle = (sAngle + 180) % 360;
            }

            if (_penDown) {
                logo.ext.canvas.sendCmd("arc", [
                    _turtleX + Math.cos(logo.type.degToRad(_turtleHeading)) * radius,
                    _turtleY - Math.sin(logo.type.degToRad(_turtleHeading)) * radius,
                    radius,
                    sAngle,
                    sAngle + deg,
                    deg < 0,
                    false]);
            }

            _turtleX += (Math.cos(logo.type.degToRad(_turtleHeading))  - Math.cos(logo.type.degToRad(_turtleHeading + deg))) * radius;  // BEACH: moveto
            _turtleY -= (Math.sin(logo.type.degToRad(_turtleHeading))  - Math.sin(logo.type.degToRad(_turtleHeading + deg))) * radius;
            _turtleHeading += deg;
            logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
        }

        function primitiveEllipse(radiusX, radiusY, fill = false) {
            logo.type.validateInputNonNegNumber(radiusX);
            logo.type.validateInputNonNegNumber(radiusY);
            logo.type.validateInputBoolean(fill);
            if (_penDown) {
                logo.ext.canvas.sendCmd("ellipse", [
                    _turtleX,
                    _turtleY,
                    radiusX,
                    radiusY,
                    _turtleHeading,
                    0,
                    360,
                    false,
                    logo.type.logoBoolean(fill)]);
            }
        }

        function primitiveEllipse2(radiusX, radiusY, fill = false) {
            logo.type.validateInputNonNegNumber(radiusX);
            logo.type.validateInputNonNegNumber(radiusY);
            logo.type.validateInputBoolean(fill);
            if (_penDown) {
                logo.ext.canvas.sendCmd("ellipse", [
                    _turtleX + Math.cos(logo.type.degToRad(_turtleHeading)) * radiusY,
                    _turtleY - Math.sin(logo.type.degToRad(_turtleHeading)) * radiusY,
                    radiusY,
                    radiusX,
                    _turtleHeading,
                    0,
                    360,
                    false,
                    logo.type.logoBoolean(fill)]);
            }
        }

        function primitiveEllipsearc(deg, radiusX, radiusY, startDeg) {
            logo.type.validateInputNumber(deg);
            logo.type.validateInputNonNegNumber(radiusX);
            logo.type.validateInputNonNegNumber(radiusY);
            logo.type.validateInputNumber(startDeg);

            if (_penDown) {
                let sAngle = (startDeg + 90) % 360;
                let eAngle = sAngle + deg;

                logo.ext.canvas.sendCmd("ellipse", [
                    _turtleX,
                    _turtleY,
                    radiusX,
                    radiusY,
                    _turtleHeading,
                    sAngle,
                    eAngle,
                    deg < 0,
                    false]);
            }
        }

        function primitiveEllipsearc2(deg, radiusX, radiusY, startDeg) {
            logo.type.validateInputNumber(deg);
            logo.type.validateInputNonNegNumber(radiusX);
            logo.type.validateInputNonNegNumber(radiusY);
            logo.type.validateInputNumber(startDeg);

            let endDeg = startDeg + deg;
            let osOriginHeading = Math.PI * 0.5; // os = "Old School", original heading pi/2
            let osTurtleHeading = Math.PI * 0.5 - logo.type.degToRad(_turtleHeading);
            let rad = osOriginHeading - osTurtleHeading;
            let sAngle = Math.PI * (1 + startDeg / 180);
            let eAngle = Math.PI * (1 + endDeg / 180);

            let actualStartAngle = calcActualAngle(sAngle - Math.PI, radiusX, radiusY);
            let tangentStartAngle = calcTangentAngle(sAngle - Math.PI, radiusX, radiusY); // angle between ellipse orientation and 12 o'clock
            let centerAngle = tangentStartAngle - actualStartAngle;
            let mod = Math.sqrt(Math.pow(radiusY * Math.cos(sAngle), 2) + Math.pow(radiusX * Math.sin(sAngle), 2));

            // coordinates of center relative to turtle
            let dcenterX = mod * Math.cos(centerAngle);
            let dcenterY = -mod * Math.sin(centerAngle);

            // absolute coordinates of center
            let centerX = _turtleX + dcenterX * Math.cos(rad) - dcenterY * Math.sin(rad);
            let centerY = _turtleY - dcenterX * Math.sin(rad) - dcenterY * Math.cos(rad);

            if (_penDown) {
                logo.ext.canvas.sendCmd("ellipse", [
                    centerX,
                    centerY,
                    radiusY,
                    radiusX,
                    logo.type.radToDeg(osOriginHeading - osTurtleHeading - tangentStartAngle),
                    logo.type.radToDeg(sAngle),
                    logo.type.radToDeg(eAngle),
                    deg < 0,
                    false]);
            }

            // turtle's new coordinates relative to center
            let dtxoo = Math.cos(eAngle) * radiusY;
            let dtyoo = Math.sin(eAngle) * radiusX;

            // turtle's new coordinates relative to turtle
            let dtxo = dcenterX + dtxoo * Math.cos(tangentStartAngle) + dtyoo * Math.sin(tangentStartAngle);
            let dtyo = dcenterY - dtxoo * Math.sin(tangentStartAngle) + dtyoo * Math.cos(tangentStartAngle);

            // turtle's new coordinates absolute
            _turtleX += dtxo * Math.cos(rad) - dtyo * Math.sin(rad);
            _turtleY -= dtxo * Math.sin(rad) + dtyo * Math.cos(rad);
            osTurtleHeading += Math.PI - calcTangentAngle(eAngle, radiusX, radiusY) + tangentStartAngle;
            _turtleHeading = logo.type.radToDeg(Math.PI * 0.5 - osTurtleHeading) % 360;
            logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);

            function arcctg(x) {
                return Math.PI / 2 - Math.atan(x);
            }

            function calcActualAngle(angle, radiusX, radiusY) {
                angle %= 2 * Math.PI;
                if (angle == Math.PI * 0.5 || angle == Math.PI || angle == Math.PI * 1.5 || angle == Math.PI * 2) {
                    return angle;
                }

                let period = Math.floor(angle / Math.PI);
                let actualAngle = Math.atan(radiusX * Math.tan(angle) / radiusY);
                if (actualAngle < 0) {
                    actualAngle += Math.PI;
                }

                actualAngle += period * Math.PI;
                return actualAngle;
            }

            function calcTangentAngle(angle, radiusX, radiusY) {
                angle %= 2 * Math.PI;
                if (angle == Math.PI * 0.5 || angle == Math.PI || angle == Math.PI * 1.5 || angle == Math.PI * 2) {
                    return angle;
                }

                let period = Math.floor(angle / Math.PI);
                let tangentAngle = period * Math.PI + arcctg(radiusX / Math.tan(angle) / radiusY);
                return tangentAngle;
            }
        }

        function primitiveLabel(text) {
            if (typeof text === "number") {
                text = sys.logoFround6(text);
            }

            let canvasFont = toCanvasFont(_labelFont);

            logo.ext.canvas.sendCmdAsString("drawtext", [logo.type.toString(text), canvasFont]);
        }

        function primitiveLabelfont() {
            return _labelFont;
        }

        function primitiveSetlabelfont(labelFont) {
            _labelFont = labelFont;
        }

        function toCanvasFont(labelFont) {
            if (typeof labelFont === "string") {
                return labelFont;
            }

            if (!logo.type.isLogoList(labelFont) || logo.type.listLength(labelFont) < 2) {
                return defaultLabelFont;
            }

            let faceName = logo.type.listItem(1, labelFont);
            let height = logo.type.listItem(2, labelFont);
            let weight = logo.type.listItem(5, labelFont);
            let italic = logo.type.listItem(6, labelFont);

            return formatCanvasFont(faceName, height, weight, italic);
        }

        function formatCanvasFont(faceName, height, weight = 400, italic = 0) {
            if (!logo.type.isLogoList(faceName) || !sys.isInteger(height)) {
                return defaultCanvasFont;
            }

            let canvasFont = [Math.abs(height).toString() + "px", logo.type.toString(faceName).toLowerCase()];

            if (isCustomFontWeight(weight)) {
                canvasFont.unshift(weight.toString());
            }

            if (italic !== 0) {
                canvasFont.unshift("italic");
            }

            return canvasFont.join(" ");
        }

        function isCustomFontWeight(weight) {
            return weight > 0 && weight !== 400 && sys.isInteger(weight) && weight <= 900;
        }

        function primitiveFill(fillmode = false) {
            logo.type.validateInputBoolean(fillmode);
            logo.ext.canvas.sendCmd("fill", [logo.type.logoBoolean(fillmode)]);
        }

        function primitiveHome() {
            _turtleX = originX;
            _turtleY = originY;
            _turtleHeading = originalHeading;
            logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
        }

        function primitiveLeft(deg) {
            logo.type.validateInputNumber(deg);
            _turtleHeading = moduloDeg(_turtleHeading - deg);
            logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
        }

        function primitiveRight(deg) {
            logo.type.validateInputNumber(deg);
            _turtleHeading = moduloDeg(_turtleHeading + deg);
            logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
        }

        function primitiveKeyboardon(onKeyDown, onKeyUp = undefined) {
            logo.type.validateInputWordOrList(onKeyDown);
            if (onKeyUp !== undefined) {
                logo.type.validateInputWordOrList(onKeyUp);
            }

            _onKeyDown = onKeyDown;
            _onKeyUp = onKeyUp;
        }

        function primitiveKeyboardoff() {
            _onKeyDown = undefined;
            _onKeyUp = undefined;
        }

        function primitiveKeyboardvalue() {
            return _lastKeyboardValue;
        }

        function primitiveMouseon(onLeftButtonDown, onLeftButtonUp, onRightButtonDown, onRightButtonUp, onMove) {
            logo.type.validateInputWordOrList(onLeftButtonDown);
            logo.type.validateInputWordOrList(onLeftButtonUp);
            logo.type.validateInputWordOrList(onRightButtonDown);
            logo.type.validateInputWordOrList(onRightButtonUp);
            logo.type.validateInputWordOrList(onMove);

            _onLeftButtonDown = onLeftButtonDown;
            _onLeftButtonUp = onLeftButtonUp;
            _onRightButtonDown = onRightButtonDown;
            _onRightButtonUp = onRightButtonUp;
            _onMove = onMove;
        }

        function primitiveMouseoff() {
            _onLeftButtonDown = undefined;
            _onLeftButtonUp = undefined;
            _onRightButtonDown = undefined;
            _onRightButtonUp = undefined;
            _onMove = undefined;
        }

        function primitiveMousepos() {
            return logo.type.makeLogoList([_mouseX, _mouseY]);
        }

        function primitiveClickpos() {
            return logo.type.makeLogoList([_mouseClickX, _mouseClickY]);
        }

        function primitiveButtonp() {
            return _mouseDown;
        }

        function backupTurtle() {
            return {
                "x": _turtleX,
                "y": _turtleY,
                "heading": _turtleHeading
            };
        }

        function restoreTurtle(turtleState) {
            _turtleX = turtleState.x;
            _turtleY = turtleState.y;
            _turtleHeading = turtleState.heading;
        }

        async function callIOCallback(template) {
            if (template === undefined || logo.type.isEmptyList(template)) {
                return;
            }

            await logo.env.resetCallStackAfterExecute(async () => {
                await logo.env.resetScopeStackAfterExecute(async () => {
                    await logo.env.catchLogoException(async () => {
                        template = logo.type.wordToList(template);
                        logo.type.validateInputList(template);
                        await logo.env.callTemplate(template);
                    });
                });
            });
        }

        async function onKeyboardEvent(msg) {
            function getKeyboardMsgType(msg) {
                return msg[0];
            }

            function getKeyboardMsgEvent(msg) {
                return msg[1];
            }

            function isCharacter(event) {
                return event.key.length === 1 || event.code === "Tab";
            }

            function getCharacterCode(event) {
                return event.key.length === 1 ? event.key.charCodeAt(0) :
                    event.code === "Tab" ? KEYBOARD_EVENT_CODE_CODE.Tab : 0;
            }

            function getKeyCode(event) {
                return event.code in KEYBOARD_EVENT_CODE_CODE ? KEYBOARD_EVENT_CODE_CODE[event.code] :
                    event.key in KEYBOARD_EVENT_KEY_CODE ? KEYBOARD_EVENT_KEY_CODE[event.key] : 0;
            }

            function expectCharacterCode() {
                return _onKeyDown !== undefined && _onKeyUp === undefined;
            }

            function expectKeyCode() {
                return _onKeyDown !== undefined && _onKeyUp !== undefined;
            }

            const keyboardEventHandler = {
                "down": async () => {
                    let event = getKeyboardMsgEvent(msg);
                    if (expectCharacterCode() && isCharacter(event)) {
                        _lastKeyboardValue = getCharacterCode(event);
                        await callIOCallback(_onKeyDown);
                    } else if (expectKeyCode()) {
                        _lastKeyboardValue = getKeyCode(event);
                        await callIOCallback(_onKeyDown);
                    }
                },
                "up": async () => {
                    let event = getKeyboardMsgEvent(msg);
                    if (expectKeyCode()) {
                        _lastKeyboardValue = getKeyCode(event);
                        await callIOCallback(_onKeyUp);
                    }
                }
            };

            sys.assert(getKeyboardMsgType(msg) in keyboardEventHandler);
            await keyboardEventHandler[getKeyboardMsgType(msg)]();
        }
        graphics.onKeyboardEvent = onKeyboardEvent;

        async function onMouseEvent(msg) {
            function getMouseMsgType(msg) {
                return msg[0];
            }

            function getMouseMsgPosX(msg) {
                return msg[1];
            }

            function getMouseMsgPosY(msg) {
                return msg[2];
            }

            function getMouseMsgButton(msg) {
                return msg[3];
            }

            const mouseEventHandler = {
                "move": async () => {
                    _mouseX = getMouseMsgPosX(msg);
                    _mouseY = getMouseMsgPosY(msg);
                    await callIOCallback(_onMove);
                },
                "click": async () => {
                    _mouseX = getMouseMsgPosX(msg);
                    _mouseY = getMouseMsgPosY(msg);
                    _mouseClickX = getMouseMsgPosX(msg);
                    _mouseClickY = getMouseMsgPosY(msg);
                },
                "down": async () => {
                    _mouseX = getMouseMsgPosX(msg);
                    _mouseY = getMouseMsgPosY(msg);
                    _mouseDown = true;
                    let button = getMouseMsgButton(msg);
                    if (button === MOUSE_MAIN_BUTTON) {
                        await callIOCallback(_onLeftButtonDown);
                    } else if (button === MOUSE_SECONDARY_BUTTON) {
                        await callIOCallback(_onRightButtonDown);
                    }
                },
                "up": async () => {
                    _mouseX = getMouseMsgPosX(msg);
                    _mouseY = getMouseMsgPosY(msg);
                    _mouseDown = false;
                    let button = getMouseMsgButton(msg);
                    if (button === MOUSE_MAIN_BUTTON) {
                        await callIOCallback(_onLeftButtonUp);
                    } else if (button === MOUSE_SECONDARY_BUTTON) {
                        await callIOCallback(_onRightButtonUp);
                    }
                }
            };

            sys.assert(getMouseMsgType(msg) in mouseEventHandler);
            await mouseEventHandler[getMouseMsgType(msg)]();
        }
        graphics.onMouseEvent = onMouseEvent;

        function moduloDeg(deg) {
            return deg >= 0 ? deg % 360 : (deg % 360) +360;
        }

        function undo() {
            if (_undoStack.length > 0) {
                restoreTurtle(_undoStack.pop());
                logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
            }
        }
        graphics.undo = undo;

        function snapshot() {
            _undoStack.push(backupTurtle());
            if (_undoStack.length > MAX_UNDO_DEPTH) {
                _undoStack.shift();
            }
        }
        graphics.snapshot = snapshot;

        function reset() {
            _turtleX = originX;
            _turtleY = originY;
            _turtleHeading = originalHeading;

            _penDown = true;
            _floodColor = 0;
            _penColor = 0;
            _bgColor = 15;
            _penSize = originalPenSize;

            _labelFont = defaultLabelFont;
        }
        graphics.reset = reset;

        return graphics;
    }
};
