//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements Logo's turtle primitives
// Runs in Logo worker thread

"use strict";

var $classObj = {};
$classObj.create = function(logo, sys) {
    const turtle = {};

    const originX = 0;
    const originY = 0;
    const originalHeading = 0; // deg
    const originalPenSize = logo.type.makeLogoList([1, 1]);

    let _showTurtle = true;

    let _turtleX = originX;
    let _turtleY = originY;
    let _turtleHeading = originalHeading;

    let _penDown = true;
    let _penMode = "paint";
    let _floodColor = logo.type.getPaletteRGB(0);
    let _penColor = logo.type.getPaletteRGB(0);
    let _bgColor = logo.type.getPaletteRGB(15);
    let _penSize = originalPenSize;

    function d2r(deg) {
        return deg * Math.PI / 180;
    }

    function r2d(rad) {
        return rad / Math.PI * 180;
    }

    function primitiveReset() {
        _turtleX = originX;
        _turtleY = originY;
        _turtleHeading = originalHeading;

        _penDown = true;
        _floodColor = logo.type.getPaletteRGB(0);
        _penColor = logo.type.getPaletteRGB(0);
        _bgColor = logo.type.getPaletteRGB(15);
        _penSize = originalPenSize;
    }
    turtle.reset = primitiveReset;

    function primitivePendown() {
        _penDown = true;
    }
    turtle.pendown = primitivePendown;

    function primitivePendownp() {
        return _penDown;
    }
    turtle.pendownp = primitivePendownp;

    function primitivePenup() {
        _penDown = false;
    }
    turtle.penup = primitivePenup;

    function primitivepenPaint() {
        _penDown = true;
        _penMode = "paint";
        logo.ext.canvas.sendCmd("penpaint");
    }
    turtle.penpaint = primitivepenPaint;

    function primitivePenerase() {
        _penDown = true;
        _penMode = "erase";
        logo.ext.canvas.sendCmd("penerase");
    }
    turtle.penerase = primitivePenerase;

    function primitivePenreverse() {
        _penDown = true;
        _penMode = "reverse";
        logo.ext.canvas.sendCmd("penreverse");
    }
    turtle.penreverse = primitivePenreverse;

    function primitivePenmode() {
        return _penMode;
    }
    turtle.penmode = primitivePenmode;

    function primitiveShowturtle() {
        _showTurtle = true;
        logo.ext.canvas.sendCmd("showturtle");
    }
    turtle.showturtle = primitiveShowturtle;

    function primitiveHideturtle() {
        _showTurtle = false;
        logo.ext.canvas.sendCmd("hideturtle");
    }
    turtle.hideturtle = primitiveHideturtle;

    function primitiveShownp() {
        return _showTurtle;
    }
    turtle.shownp = primitiveShownp;

    function primitiveForward(length) {
        _turtleX += Math.sin(d2r(_turtleHeading)) * length;
        _turtleY += Math.cos(d2r(_turtleHeading)) * length;
        logo.ext.canvas.sendCmd(
            _penDown ? "drawto" : "moveto",
            [_turtleX, _turtleY, _turtleHeading]
        );
    }
    turtle.forward = primitiveForward;

    function primitiveBack(length) {
        _turtleX -= Math.sin(d2r(_turtleHeading)) * length;
        _turtleY -= Math.cos(d2r(_turtleHeading)) * length;
        logo.ext.canvas.sendCmd(
            _penDown ? "drawto" : "moveto",
            [_turtleX, _turtleY, _turtleHeading]
        );
    }
    turtle.back = primitiveBack;

    function primitiveClearscreen() {
        _turtleX = originX;
        _turtleY = originY;
        _turtleHeading = originalHeading;
        logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
        logo.ext.canvas.sendCmd("clean");
    }
    turtle.clearscreen = primitiveClearscreen;

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
    turtle.clean = primitiveClean;

    function primitiveSetxy(newX, newY) {
        logo.env.setPrimitiveName("setxy");
        logo.type.checkInputNumber(newX);
        logo.type.checkInputNumber(newY);
        _turtleX = newX;
        _turtleY = newY;
        logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.setxy = primitiveSetxy;

    function primitivePos() {
        return logo.type.makeLogoList([_turtleX, _turtleY]);
    }
    turtle.pos = primitivePos;

    function primitiveSetpos(pos) {
        logo.env.setPrimitiveName("setpos");
        logo.type.checkInput2DCartesianCoordinate(pos);
        _turtleX = logo.type.listItem(1, pos);
        _turtleY = logo.type.listItem(2, pos);
        logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.setpos = primitiveSetpos;

    function primitiveXcor() {
        return _turtleX;
    }
    turtle.xcor = primitiveXcor;

    function primitiveSetx(newX) {
        logo.env.setPrimitiveName("setx");
        logo.type.checkInputNumber(newX);
        _turtleX = newX;
        logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.setx = primitiveSetx;

    function primitiveYcor() {
        return _turtleY;
    }
    turtle.ycor = primitiveYcor;

    function primitiveSety(newY) {
        logo.env.setPrimitiveName("sety");
        logo.type.checkInputNumber(newY);
        _turtleY = newY;
        logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.sety = primitiveSety;

    function primitiveHeading() {
        return _turtleHeading;
    }
    turtle.heading = primitiveHeading;

    function primitiveSetheading(deg) {
        logo.env.setPrimitiveName("setheading");
        logo.type.checkInputNumber(deg);
        _turtleHeading = moduloDeg(deg);
        logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.setheading = primitiveSetheading;

    function primitiveTowards(pos) {
        logo.env.setPrimitiveName("towards");
        logo.type.checkInput2DCartesianCoordinate(pos);
        let dX = logo.type.listItem(1, pos) - _turtleX;
        let dY = logo.type.listItem(2, pos) - _turtleY;

        if (dX == 0) {
            return (dY < 0) ? 180 : 0;
        }

        if (dY == 0) {
            return (dX < 0) ? 270 : 90;
        }

        let deg = r2d(Math.atan2(dX, dY));
        return (deg < 0) ? deg + 360 : deg;
    }
    turtle.towards = primitiveTowards;

    function primitiveSetbackground(color) {
        logo.env.setPrimitiveName("setbackground");
        logo.type.checkInputColor(color);
        _bgColor = logo.type.getRGB(color);
        logo.ext.canvas.sendCmd("bgcolor", _bgColor);
    }
    turtle.setbackground = primitiveSetbackground;

    function primitiveSetfloodcolor(color) {
        logo.env.setPrimitiveName("setfloodcolor");
        logo.type.checkInputColor(color);
        _floodColor = logo.type.isPaletteIndex(color) ? color : logo.type.makeLogoList(logo.type.getRGB(color));
        logo.ext.canvas.sendCmd("fillcolor",  logo.type.getRGB(_floodColor));
    }
    turtle.setfloodcolor = primitiveSetfloodcolor;

    function primitiveFloodcolor() {
        return _floodColor;
    }
    turtle.floodcolor = primitiveFloodcolor;

    function primitiveSetpencolor(color) {
        logo.env.setPrimitiveName("setpencolor");
        logo.type.checkInputColor(color);
        _penColor = logo.type.isPaletteIndex(color) ? color : logo.type.makeLogoList(logo.type.getRGB(color));
        logo.ext.canvas.sendCmd("pencolor", logo.type.getRGB(_penColor));
    }
    turtle.setpencolor = primitiveSetpencolor;

    function primitivePencolor() {
        return _penColor;
    }
    turtle.pencolor = primitivePencolor;

    function primitiveSetpensize(size) {
        logo.env.setPrimitiveName("setpensize");
        logo.type.checkInputPensize(size);
        let actualSize = sys.isInteger(size) ? size : Math.floor(size[2]);
        _penSize = logo.type.makeLogoList([actualSize, actualSize]);
        logo.ext.canvas.sendCmd("pensize", [actualSize]);
    }
    turtle.setpensize = primitiveSetpensize;

    function primitivePensize() {
        return _penSize;
    }
    turtle.pensize = primitivePensize;

    function primitiveCircle(radius) {
        if (_penDown) {
            logo.ext.canvas.sendCmd("arc", [_turtleX, _turtleY, radius, 0, 360, false]);
        }
    }
    turtle.circle = primitiveCircle;

    function primitiveCircle2(radius) {
        if (_penDown) {
            logo.ext.canvas.sendCmd("arc", [
                _turtleX + Math.cos(d2r(_turtleHeading)) * radius,
                _turtleY - Math.sin(d2r(_turtleHeading)) * radius,
                radius,
                0,
                360,
                false]);
        }
    }
    turtle.circle2 = primitiveCircle2;

    function primitiveArc(deg, radius) {
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
                deg < 0]);
        }
    }
    turtle.arc = primitiveArc;

    function primitiveArc2(deg, radius) {
        let sAngle = (_turtleHeading + 180) % 360;

        if (radius < 0) {
            radius = -radius;
            sAngle = (sAngle + 180) % 360;
        }

        if (_penDown) {
            logo.ext.canvas.sendCmd("arc", [
                _turtleX + Math.cos(d2r(_turtleHeading)) * radius,
                _turtleY - Math.sin(d2r(_turtleHeading)) * radius,
                radius,
                sAngle,
                sAngle + deg,
                deg < 0]);
        }

        _turtleX += (Math.cos(d2r(_turtleHeading))  - Math.cos(d2r(_turtleHeading + deg))) * radius;  // BEACH: moveto
        _turtleY -= (Math.sin(d2r(_turtleHeading))  - Math.sin(d2r(_turtleHeading + deg))) * radius;
        _turtleHeading += deg;
        logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.arc2 = primitiveArc2;

    function primitiveEllipse(radiusX, radiusY) {
        if (_penDown) {
            logo.ext.canvas.sendCmd("ellipse", [
                _turtleX,
                _turtleY,
                radiusX,
                radiusY,
                _turtleHeading,
                0,
                360,
                false]);
        }
    }
    turtle.ellipse = primitiveEllipse;

    function primitiveEllipse2(radiusX, radiusY) {
        if (_penDown) {
            logo.ext.canvas.sendCmd("ellipse", [
                _turtleX + Math.cos(d2r(_turtleHeading)) * radiusY,
                _turtleY - Math.sin(d2r(_turtleHeading)) * radiusY,
                radiusY,
                radiusX,
                _turtleHeading,
                0,
                360,
                false]);
        }
    }
    turtle.ellipse2 = primitiveEllipse2;

    function primitiveEllipsearc(deg, radiusX, radiusY, startDeg) {
        logo.env.setPrimitiveName("ellipsearc");
        logo.type.checkInputNumber(deg);
        logo.type.checkInputNonNegNumber(radiusX);
        logo.type.checkInputNonNegNumber(radiusY);
        logo.type.checkInputNonNegNumber(startDeg);

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
                deg < 0]);
        }
    }
    turtle.ellipsearc = primitiveEllipsearc;

    function primitiveEllipsearc2(deg, radiusX, radiusY, startDeg) {
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

        let endDeg = startDeg + deg;
        if (radiusX < 0) {
            radiusX = -radiusX;
            startDeg = -startDeg;
            endDeg = -endDeg;
        }

        if (radiusY < 0) {
            radiusY = -radiusY;
            startDeg = 180 - startDeg;
            endDeg = 180 - endDeg;
        }

        let osOriginHeading = Math.PI * 0.5; // os = "Old School", original heading pi/2
        let osTurtleHeading = Math.PI * 0.5 - d2r(_turtleHeading);
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
                r2d(osOriginHeading - osTurtleHeading - tangentStartAngle),
                r2d(sAngle),
                r2d(eAngle),
                deg < 0]);
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
        _turtleHeading = r2d(Math.PI * 0.5 - osTurtleHeading) % 360;
        logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.ellipsearc2 = primitiveEllipsearc2;

    function primitiveLabel(text) {
        if (typeof text === "number") {
            logo.ext.canvas.sendCmd("drawtext", [text]);
            return;
        }

        logo.ext.canvas.sendCmdAsString("drawtext", [logo.type.toString(text)]);
    }
    turtle.label = primitiveLabel;

    function primitiveFill() {
        logo.ext.canvas.sendCmd("fill");
    }
    turtle.fill = primitiveFill;

    function primitiveHome() {
        _turtleX = originX;
        _turtleY = originY;
        _turtleHeading = originalHeading;
        logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.home = primitiveHome;

    function primitiveLeft(deg) {
        logo.env.setPrimitiveName("left");
        logo.type.checkInputNumber(deg);
        _turtleHeading = moduloDeg(_turtleHeading - deg);
        logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.left = primitiveLeft;

    function primitiveRight(deg) {
        logo.env.setPrimitiveName("right");
        logo.type.checkInputNumber(deg);
        _turtleHeading = moduloDeg(_turtleHeading + deg);
        logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.right = primitiveRight;

    function moduloDeg(deg) {
        return deg >= 0 ? deg % 360 : (deg % 360) +360;
    }

    return turtle;
};

if (typeof exports != "undefined") {
    exports.$classObj = $classObj;
}
