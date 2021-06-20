//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements Logo's turtle primitives
// Runs in Logo worker thread

"use strict";

var $obj = {};
$obj.create = function(logo, sys) {
    const turtle = {};

    const originX = 0;
    const originY = 0;
    const originalHeading = 0; // deg
    const originalPenSize = logo.type.makeLogoList([1, 1]);

    const MAX_UNDO_DEPTH = logo.constants.MAX_UNDO_DEPTH;

    const procs = {
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

        "mousepos": primitiveMousepos,

        "clickpos": primitiveClickpos,

        "buttonp": primitiveButtonp,
    };

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
        // setlabelfont [[Arial] -24 0 0 400 0 0 0 0 3 2 1 18]
    }
    turtle.draw = primitiveDraw;

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
            logo.ext.canvas.sendCmd("drawtext", [text]);
            return;
        }

        logo.ext.canvas.sendCmdAsString("drawtext", [logo.type.toString(text)]);
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

    function getMsgType(msg) {
        return msg[0];
    }

    function getMsgPosX(msg) {
        return msg[1];
    }

    function getMsgPosY(msg) {
        return msg[2];
    }

    function onMouseEvent(msg) {
        const mouseEventHandler = {
            "move": () => {
                _mouseX = getMsgPosX(msg);
                _mouseY = getMsgPosY(msg);
            },
            "click": () => {
                _mouseClickX = getMsgPosX(msg);
                _mouseClickY = getMsgPosY(msg);
            },
            "down": () => {
                _mouseDown = true;
            },
            "up": () => {
                _mouseDown = false;
            }
        };

        sys.assert(getMsgType(msg) in mouseEventHandler);
        mouseEventHandler[getMsgType(msg)](msg);
    }
    turtle.onMouseEvent = onMouseEvent;

    function moduloDeg(deg) {
        return deg >= 0 ? deg % 360 : (deg % 360) +360;
    }

    function undo() {
        if (_undoStack.length > 0) {
            restoreTurtle(_undoStack.pop());
            logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
        }
    }
    turtle.undo = undo;

    function snapshot() {
        _undoStack.push(backupTurtle());
        if (_undoStack.length > MAX_UNDO_DEPTH) {
            _undoStack.shift();
        }
    }
    turtle.snapshot = snapshot;

    function reset() {
        _turtleX = originX;
        _turtleY = originY;
        _turtleHeading = originalHeading;

        _penDown = true;
        _floodColor = 0;
        _penColor = 0;
        _bgColor = 15;
        _penSize = originalPenSize;
    }
    turtle.reset = reset;

    function containsFormalString(entry) {
        return Array.isArray(entry) && entry.length >=2;
    }

    function getPrimitive(entry) {
        return entry[0];
    }

    function getFormal(entry) {
        return entry[1];
    }

    function bindProcs(env, formal) {
        for(let name in procs) {
            let entry = procs[name];
            if (containsFormalString(entry)) {
                env[name] = getPrimitive(entry);
                formal[name] = getFormal(entry);
            } else {
                env[name] = entry;
            }
        }
    }
    turtle.bindProcs = bindProcs;

    return turtle;
};

if (typeof exports != "undefined") {
    exports.$obj = $obj;
}
