//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Implements Logo's turtle primitives
// Runs in Logo worker thread

"use strict";

var classObj = {};
classObj.create = function(logo, sys) {
    const turtle = {};

    const PALETTE = {
        0: [0, 0, 0],
        1: [0, 0, 255],
        2: [0, 255, 0],
        3: [0, 255, 255],
        4: [255, 0, 0],
        5: [255, 0, 255],
        6: [255, 255, 0],
        15: [255, 255, 255],
        7: [155, 96, 59],
        8: [197, 136, 18],
        9: [100, 162, 64],
        10: [120, 187, 187],
        11: [255, 149, 119],
        12: [144, 113, 208],
        13: [255, 163, 0],
        14: [183, 183, 183],
    };

    const RGB_BY_COLOR_NAME = {
        "aliceblue": [240, 248, 255],
        "antiquewhite": [250, 235, 215],
        "aqua": [0, 255, 255],
        "aquamarine": [127, 255, 212],
        "azure": [240, 255, 255],
        "beige": [245, 245, 220],
        "bisque": [255, 228, 196],
        "black": [0, 0, 0],
        "blanchedalmond": [255, 235, 205],
        "blue": [0, 0, 255],
        "blueviolet": [138, 43, 226],
        "brown": [165, 42, 42],
        "burlywood": [222, 184, 135],
        "cadetblue": [95, 158, 160],
        "chartreuse": [127, 255, 0],
        "chocolate": [210, 105, 30],
        "coral": [255, 127, 80],
        "cornflowerblue": [100, 149, 237],
        "cornsilk": [255, 248, 220],
        "crimson": [220, 20, 60],
        "cyan": [0, 255, 255],
        "darkblue": [0, 0, 139],
        "darkcyan": [0, 139, 139],
        "darkgoldenrod": [184, 134, 11],
        "darkgray": [169, 169, 169],
        "darkgreen": [0, 100, 0],
        "darkgrey": [169, 169, 169],
        "darkkhaki": [189, 183, 107],
        "darkmagenta": [139, 0, 139],
        "darkolivegreen": [85, 107, 47],
        "darkorange": [255, 140, 0],
        "darkorchid": [153, 50, 204],
        "darkred": [139, 0, 0],
        "darksalmon": [233, 150, 122],
        "darkseagreen": [143, 188, 143],
        "darkslateblue": [72, 61, 139],
        "darkslategray": [47, 79, 79],
        "darkslategrey": [47, 79, 79],
        "darkturquoise": [0, 206, 209],
        "darkviolet": [148, 0, 211],
        "deeppink": [255, 20, 147],
        "deepskyblue": [0, 191, 255],
        "dimgray": [105, 105, 105],
        "dimgrey": [105, 105, 105],
        "dodgerblue": [30, 144, 255],
        "firebrick": [178, 34, 34],
        "floralwhite": [255, 250, 240],
        "forestgreen": [34, 139, 34],
        "fuchsia": [255, 0, 255],
        "gainsboro": [220, 220, 220],
        "ghostwhite": [248, 248, 255],
        "gold": [255, 215, 0],
        "goldenrod": [218, 165, 32],
        "gray": [128, 128, 128],
        "green": [0, 128, 0],
        "greenyellow": [173, 255, 47],
        "grey": [128, 128, 128],
        "honeydew": [240, 255, 240],
        "hotpink": [255, 105, 180],
        "indianred": [205, 92, 92],
        "indigo": [75, 0, 130],
        "ivory": [255, 255, 240],
        "khaki": [240, 230, 140],
        "lavender": [230, 230, 250],
        "lavenderblush": [255, 240, 245],
        "lawngreen": [124, 252, 0],
        "lemonchiffon": [255, 250, 205],
        "lightblue": [173, 216, 230],
        "lightcoral": [240, 128, 128],
        "lightcyan": [224, 255, 255],
        "lightgoldenrodyellow": [250, 250, 210],
        "lightgray": [211, 211, 211],
        "lightgreen": [144, 238, 144],
        "lightgrey": [211, 211, 211],
        "lightpink": [255, 182, 193],
        "lightsalmon": [255, 160, 122],
        "lightseagreen": [32, 178, 170],
        "lightskyblue": [135, 206, 250],
        "lightslategray": [119, 136, 153],
        "lightslategrey": [119, 136, 153],
        "lightsteelblue": [176, 196, 222],
        "lightyellow": [255, 255, 224],
        "lime": [0, 255, 0],
        "limegreen": [50, 205, 50],
        "linen": [250, 240, 230],
        "magenta": [255, 0, 255],
        "maroon": [128, 0, 0],
        "mediumaquamarine": [102, 205, 170],
        "mediumblue": [0, 0, 205],
        "mediumorchid": [186, 85, 211],
        "mediumpurple": [147, 112, 216],
        "mediumseagreen": [60, 179, 113],
        "mediumslateblue": [123, 104, 238],
        "mediumspringgreen": [0, 250, 154],
        "mediumturquoise": [72, 209, 204],
        "mediumvioletred": [199, 21, 133],
        "midnightblue": [25, 25, 112],
        "mintcream": [245, 255, 250],
        "mistyrose": [255, 228, 225],
        "moccasin": [255, 228, 181],
        "navajowhite": [255, 222, 173],
        "navy": [0, 0, 128],
        "oldlace": [253, 245, 230],
        "olive": [128, 128, 0],
        "olivedrab": [107, 142, 35],
        "orange": [255, 165, 0],
        "orangered": [255, 69, 0],
        "orchid": [218, 112, 214],
        "palegoldenrod": [238, 232, 170],
        "palegreen": [152, 251, 152],
        "paleturquoise": [175, 238, 238],
        "palevioletred": [216, 112, 147],
        "papayawhip": [255, 239, 213],
        "peachpuff": [255, 218, 185],
        "peru": [205, 133, 63],
        "pink": [255, 192, 203],
        "plum": [221, 160, 221],
        "powderblue": [176, 224, 230],
        "purple": [128, 0, 128],
        "red": [255, 0, 0],
        "rosybrown": [188, 143, 143],
        "royalblue": [65, 105, 225],
        "saddlebrown": [139, 69, 19],
        "salmon": [250, 128, 114],
        "sandybrown": [244, 164, 96],
        "seagreen": [46, 139, 87],
        "seashell": [255, 245, 238],
        "sienna": [160, 82, 45],
        "silver": [192, 192, 192],
        "skyblue": [135, 206, 235],
        "slateblue": [106, 90, 205],
        "slategray": [112, 128, 144],
        "slategrey": [112, 128, 144],
        "snow": [255, 250, 250],
        "springgreen": [0, 255, 127],
        "steelblue": [70, 130, 180],
        "tan": [210, 180, 140],
        "teal": [0, 128, 128],
        "thistle": [216, 191, 216],
        "tomato": [255, 99, 71],
        "turquoise": [64, 224, 208],
        "violet": [238, 130, 238],
        "wheat": [245, 222, 179],
        "white": [255, 255, 255],
        "whitesmoke": [245, 245, 245],
        "yellow": [255, 255, 0],
        "yellowgreen": [154, 205, 50],
    };

    const originX = 0;
    const originY = 0;
    const originalHeading = 0; // deg

    let _turtleX = originX;
    let _turtleY = originY;
    let _turtleHeading = originalHeading;

    let _showTurtle = true;
    let _penDown = true;
    let _penMode = "paint";
    let _floodColor = PALETTE[0];
    let _penColor = PALETTE[0];
    let _bgColor = PALETTE[15];
    let _penSize = 1;

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
        _floodColor = PALETTE[0];
        _penColor = PALETTE[0];
        _bgColor = PALETTE[15];
        _penSize = 1;
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
        logo.type.verifyOrThrow(logo.type.isLogoNumber(newX), "INVALID_INPUT",
            function() { return ["setxy", logo.type.logoToString(newX, true)]; } );

        logo.type.verifyOrThrow(logo.type.isLogoNumber(newY), "INVALID_INPUT",
            function() { return ["setxy", logo.type.logoToString(newY, true)]; } );

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
        logo.type.verifyOrThrow(
            logo.type.isLogoList(pos) &&
                    pos.length == 3 &&
                    logo.type.isLogoNumber(pos[1]) &&
                    logo.type.isLogoNumber(pos[2]),
            "INVALID_INPUT",
            function() { return ["setpos", logo.type.logoToString(pos, true)]; } );

        _turtleX = pos[1];
        _turtleY = pos[2];
        logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.setpos = primitiveSetpos;

    function primitiveXcor() {
        return _turtleX;
    }
    turtle.xcor = primitiveXcor;

    function primitiveSetx(newX) {
        logo.type.verifyOrThrow(logo.type.isLogoNumber(newX), "INVALID_INPUT",
            function() { return ["setx", logo.type.logoToString(newX, true)]; } );

        _turtleX = newX;
        logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.setx = primitiveSetx;

    function primitiveYcor() {
        return _turtleY;
    }
    turtle.ycor = primitiveYcor;

    function primitiveSety(newY) {
        logo.type.verifyOrThrow(logo.type.isLogoNumber(newY), "INVALID_INPUT",
            function() { return ["sety", logo.type.logoToString(newY, true)]; } );

        _turtleY = newY;
        logo.ext.canvas.sendCmd(_penDown ? "drawto" : "moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.sety = primitiveSety;

    function primitiveHeading() {
        return _turtleHeading;
    }
    turtle.heading = primitiveHeading;

    function primitiveSetheading(deg) {
        logo.type.verifyOrThrow(logo.type.isLogoNumber(deg), "INVALID_INPUT",
            function() { return ["setheading", logo.type.logoToString(deg, true)]; } );

        _turtleHeading = deg;
    }
    turtle.setheading = primitiveSetheading;

    function primitiveTowards(pos) {
        logo.type.verifyOrThrow(
            logo.type.isLogoList(pos) &&
                    pos.length == 3 &&
                    logo.type.isLogoNumber(pos[1]) &&
                    logo.type.isLogoNumber(pos[2]),
            "INVALID_INPUT",
            function() { return ["towards", logo.type.logoToString(pos, true)]; } );

        let dX = pos[1] - _turtleX;
        let dY = pos[2] - _turtleY;

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
        if (typeof color === "number" && color in PALETTE) {
            _bgColor = PALETTE[color];
            logo.ext.canvas.sendCmd("bgcolor", _bgColor);
        }
    }
    turtle.setbackground = primitiveSetbackground;

    function isPaletteIndex(color) {
        return /*sys.isInteger(color) &&*/ color in PALETTE;
    }

    function isRGB(rgb) {
        return Array.isArray(rgb) && rgb.length == 3 &&
                sys.isInteger(rgb[0]) && rgb[0] >= 0 && rgb[0] <= 255 &&
                sys.isInteger(rgb[1]) && rgb[1] >= 0 && rgb[1] <= 255 &&
                sys.isInteger(rgb[2]) && rgb[2] >= 0 && rgb[2] <= 255;
    }

    function isColorName(color) {
        return typeof color === "string" && color.toLowerCase() in RGB_BY_COLOR_NAME;
    }

    function isRGBinLogoList(color) {
        return logo.type.isLogoList(color) && isRGB(logo.type.unbox(color));
    }

    function isValidColorValue(color) {
        return isPaletteIndex(color) || isRGBinLogoList(color) || isColorName(color);
    }

    function getRGB(color) {
        if (isPaletteIndex(color)) {
            return PALETTE[color];
        }

        if (isColorName(color)) {
            return RGB_BY_COLOR_NAME[color];
        }

        sys.assert(isRGB(color));
        return color;
    }

    function primitiveSetfloodcolor(color) {
        logo.type.verifyOrThrow(isValidColorValue(color), "INVALID_INPUT",
            function() { return ["setfloodcolor", logo.type.logoToString(color, true)]; });

        _floodColor = isColorName(color) ? RGB_BY_COLOR_NAME[color.toLowerCase()] : logo.type.unbox(color);
        logo.ext.canvas.sendCmd("fillcolor", getRGB(_floodColor));
    }
    turtle.setfloodcolor = primitiveSetfloodcolor;

    function primitiveFloodcolor() {
        return isPaletteIndex(_floodColor) ? _floodColor : logo.type.makeLogoList(_floodColor);
    }
    turtle.floodcolor = primitiveFloodcolor;

    function primitiveSetpencolor(color) {
        logo.type.verifyOrThrow(isValidColorValue(color), "INVALID_INPUT",
            function() { return ["setpencolor", logo.type.logoToString(color, true)]; });

        _penColor = isColorName(color) ? RGB_BY_COLOR_NAME[color.toLowerCase()] : logo.type.unbox(color);
        logo.ext.canvas.sendCmd("pencolor", getRGB(_penColor));
    }
    turtle.setpencolor = primitiveSetpencolor;

    function primitivePencolor() {
        return isPaletteIndex(_penColor) ? _penColor : logo.type.makeLogoList(_penColor);
    }
    turtle.pencolor = primitivePencolor;

    function primitiveSetpensize(size) {
        logo.type.verifyOrThrow(sys.isInteger(size) && size > 0, "INVALID_INPUT",
            function() { return ["setpensize", logo.type.logoToString(size, true)]; });

        _penSize = size;
        logo.ext.canvas.sendCmd("pensize", [_penSize]);
    }
    turtle.setpensize = primitiveSetpensize;

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

        if (_penDown) {
            let sAngle = (startDeg + 90) % 360;
            let eAngle = (endDeg + 90)  % 360;

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

        logo.ext.canvas.sendCmdAsString("drawtext", [logo.type.logoToString(text)]);
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
        _turtleHeading = (_turtleHeading - deg) % 360;
        logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.left = primitiveLeft;

    function primitiveRight(deg) {
        _turtleHeading = (_turtleHeading + deg) % 360;
        logo.ext.canvas.sendCmd("moveto", [_turtleX, _turtleY, _turtleHeading]);
    }
    turtle.right = primitiveRight;

    return turtle;
};

if (typeof exports != "undefined") {
    exports.classObj = classObj;
}
