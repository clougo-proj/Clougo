//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// On top of HTML5 canvas, implements low-level primitives for Logo graphics as defined in canvasCommon.js
// Runs in browser's main thread

import CanvasCommon from "./canvasCommon.js";
import floodFill from "../floodfill/floodfill.js";
import Constants from "./constants.js";

const MAX_UNDO_DEPTH = Constants.MAX_UNDO_DEPTH;

if (CanvasRenderingContext2D.prototype.ellipse === undefined) {
    CanvasRenderingContext2D.prototype.ellipse = function(x, y, radiusX, radiusY,
        rotation, startAngle, endAngle, antiClockwise) {
        this.save();
        this.translate(x, y);
        this.rotate(rotation);
        this.scale(radiusX, radiusY);
        this.arc(0, 0, 1, startAngle, endAngle, antiClockwise);
        this.restore();
    };
}

export default {
    "create": function (turtleCanvas, ext) {
        const _self = {};

        const _canvas = document.getElementById(turtleCanvas);
        const _convasContext = _canvas.getContext("2d");
        const _turtleSpeed = 5000;
        const _maxDrawScreenTime = 30;
        const _zoom = _canvas.width / 1000;
        const _turtleSize = 15 * _zoom;

        const _originX = _canvas.width * 0.5;
        const _originY = _canvas.height * 0.5;
        const _originHeading = Math.PI*0.5;

        let _undoStack = [];

        let _tx = _originX;
        let _ty = _originY;
        let _td = _originHeading;

        let _showTurtle = true;
        let _penMode = CanvasCommon.PenMode.paint;
        let _penSize = 1 * _zoom;

        let _turtleCmd = [];

        let _floodColor = "rgb(0, 0, 0)";
        let _penColor = _floodColor;
        let _turtleColor = _floodColor;

        _self.receive = function(tqcache) {
            ext.turtleBusy();
            tqCacheReader.receive(tqcache);
        };

        _convasContext.fillStyle = "#000000";
        _convasContext.lineCap = "round";

        const tqCacheReader = (() => {
            let tqcr = {};
            let tqcachearray = [];
            let tqptr = 1;

            tqcr.receive = function(tqcache) {
                tqcachearray.push(tqcache);
            };

            tqcr.getNext = function() {
                if (tqcachearray.length > 0) {
                    if (tqptr == tqcachearray[0][0]) {
                        tqcachearray.shift();
                        tqptr = 1;
                    }

                    if (tqcachearray[0] !== undefined && tqcachearray[0][0] > 0) {
                        return tqcachearray[0][tqptr++];
                    }
                }

                return undefined;
            };

            return tqcr;
        })();

        function drawTurtle(x, y) {
            if (_showTurtle) {

                let s = Math.sin(_td);
                let c = Math.cos(_td);
                let x1 = x - _turtleSize * s;
                let y1 = y - _turtleSize * c;
                let x2 = x + _turtleSize * c;
                let y2 = y - _turtleSize * s;
                let x3 = x + _turtleSize * s;
                let y3 = y + _turtleSize * c;

                _convasContext.strokeStyle = _turtleColor;
                _convasContext.lineWidth = 1 * _zoom;
                _convasContext.globalCompositeOperation = CanvasCommon.PenMode.reverse;

                _convasContext.beginPath();
                _convasContext.moveTo(x, y);
                _convasContext.lineTo(x1, y1);
                _convasContext.lineTo(x2, y2);
                _convasContext.lineTo(x3, y3);
                _convasContext.lineTo(x, y);
                _convasContext.stroke();
            }
        }

        function backupForUndo() {
            return _convasContext.getImageData(0, 0, _canvas.width, _canvas.height);
        }

        function backupBeforeTurtle() {
            let itx = Math.round(_tx);
            let ity = Math.round(_ty);

            return _convasContext.getImageData(itx - 25 * _zoom, ity - 25 * _zoom, 50 * _zoom, 50 * _zoom);
        }

        function restoreBeforeTurtle(imgAroundTurtle) {
            let itx = Math.round(_tx);
            let ity = Math.round(_ty);

            if (imgAroundTurtle !== undefined) {
                _convasContext.putImageData(imgAroundTurtle, itx - 25 * _zoom, ity - 25 * _zoom);
            }
        }

        const drawScreen = (() => {

            let imgAroundTurtle = undefined;

            function undo() {
                if (_undoStack.length > 0) {
                    _convasContext.putImageData(_undoStack.pop(), 0, 0);
                    imgAroundTurtle = backupBeforeTurtle();
                    drawTurtle(_tx, _ty);
                }
            }
            _self.undo = undo;

            function snapshot() {
                restoreBeforeTurtle(imgAroundTurtle);
                _undoStack.push(backupForUndo());
                if (_undoStack.length > MAX_UNDO_DEPTH) {
                    _undoStack.shift();
                }

                imgAroundTurtle = backupBeforeTurtle();
                drawTurtle(_tx, _ty);
            }
            _self.snapshot = snapshot;

            return function() {
                restoreBeforeTurtle(imgAroundTurtle);

                let nextTqElem;
                let startTime = Date.now();
                for(let i = 0; i < _turtleSpeed; i++){
                    nextTqElem = tqCacheReader.getNext();
                    if (nextTqElem === undefined) {
                        break;
                    }

                    nextTqElem = Math.round(nextTqElem);
                    let func = _turtleCmd[nextTqElem];
                    if (func === undefined) {
                        break;
                    }

                    let paramCount = CanvasCommon.getPrimitiveParamCount(nextTqElem);
                    let param = [];
                    for(let j = 0; j < paramCount; j++) {
                        param.push(tqCacheReader.getNext());
                    }

                    func.apply(null, param);
                    let currentTime = Date.now();
                    if (currentTime - startTime > _maxDrawScreenTime) {
                        break;
                    }
                }

                if (nextTqElem === undefined) {
                    ext.turtleReady();
                }

                imgAroundTurtle = backupBeforeTurtle();
                drawTurtle(_tx, _ty);
                requestAnimationFrame(drawScreen);
            };
        })();

        function t2cX(turtleX) {
            return _originX + turtleX * _zoom;
        }

        function t2cY(turtleY) {
            return _originY - turtleY * _zoom;
        }

        function t2cA(turtleAngle) {
            return (0.5 - turtleAngle / 180) * Math.PI;
        }

        function rad(deg) {
            return deg / 180 * Math.PI;
        }

        function makeColorString(red, green, blue) {
            return "rgb(" + red + ", " + green + ", " + blue + ")";
        }

        function calcLineWidth() {
            return (_penMode == CanvasCommon.PenMode.erase) ? _penSize + 2 * _zoom : _penSize;
        }

        function drawStroke(drawPath) {
            _convasContext.globalCompositeOperation = _penMode;
            _convasContext.strokeStyle = _penColor;
            _convasContext.lineWidth = calcLineWidth();

            _convasContext.beginPath();
            drawPath();
            _convasContext.stroke();
        }

        function drawFill(drawPath) {
            _convasContext.globalCompositeOperation = _penMode;
            _convasContext.fillStyle = _floodColor;
            _convasContext.beginPath();
            drawPath();
            _convasContext.fill();
        }

        let _primitive = {
            "clean" : function clean() {
                _convasContext.clearRect(0, 0, _canvas.width, _canvas.width);  // BEACH:clean
            },
            "drawto" : function drawto(turtleX, turtleY, turtleHeading) {
                let newTx = t2cX(turtleX);
                let newTy = t2cY(turtleY);

                drawStroke(() => {
                    _convasContext.beginPath();
                    _convasContext.moveTo(_tx, _ty);
                    _convasContext.lineTo(newTx, newTy);
                });

                _tx = newTx;
                _ty = newTy;
                _td = t2cA(turtleHeading);
            },
            "moveto" : function moveto(turtleX, turtleY, turtleHeading) {
                _tx = t2cX(turtleX);
                _ty = t2cY(turtleY);
                _td = t2cA(turtleHeading);
            },
            "showturtle" : function showturtle() {
                _showTurtle = true;
            },
            "hideturtle" : function hideturtle() {
                _showTurtle = false;
            },
            "penpaint" : function penpaint() {
                _penMode = CanvasCommon.PenMode.paint;
            },
            "penerase" : function penerase() {
                _penMode = CanvasCommon.PenMode.erase;
            },
            "penreverse" : function penreverse() {
                _penMode = CanvasCommon.PenMode.reverse;
            },
            "pencolor" : function pencolor(red, green, blue) {
                _penColor = makeColorString(red, green, blue);
            },
            "bgcolor" : function bgcolor(red, green, blue) {
                _turtleColor = makeColorString(255 - red, 255 - green, 255 - blue);
                ext.setBackgroundColor(makeColorString(red, green, blue));
            },
            "fillcolor" : function fillcolor(red, green, blue) {
                ext.assert(!(isNaN(red) || isNaN(blue) || isNaN(green)));
                _floodColor = makeColorString(red, green, blue);
            },
            "arc" : function arc(turtleX, turtleY, radius, startAngle, endAngle, counterClockwise, fill) {
                const draw = () => _convasContext.arc(
                    t2cX(turtleX),
                    t2cY(turtleY),
                    radius * _zoom,
                    rad(startAngle),
                    rad(endAngle),
                    counterClockwise);

                if (fill) {
                    drawFill(draw);
                }

                drawStroke(draw);
            },
            "ellipse" : function ellipse(turtleX, turtleY, radiusX, radiusY, orientationAngle, startAngle, endAngle, counterClockwise, fill) {
                const draw = () => _convasContext.ellipse(
                    t2cX(turtleX),
                    t2cY(turtleY),
                    radiusX * _zoom,
                    radiusY * _zoom,
                    rad(orientationAngle),
                    rad(startAngle),
                    rad(endAngle),
                    counterClockwise);

                if (fill) {
                    drawFill(draw);
                }

                drawStroke(draw);
            },
            "drawtext" : function drawtext(text, font) {
                _convasContext.save();
                _convasContext.translate(_tx, _ty);
                _convasContext.rotate(-_td);
                _convasContext.textBaseline="top";
                _convasContext.font = font;
                _convasContext.fillStyle = _penColor;
                _convasContext.fillText(text, 0, 0);  // BEACH:text
                _convasContext.restore();
            },
            "fill" : function fill(fillMode) {
                floodFill(_canvas, Math.round(_tx), Math.round(_ty), _floodColor, fillMode, _penColor);
            },
            "pensize" : function pensize(size) {
                _penSize = size * _zoom;
            }
        };

        Object.keys(CanvasCommon.primitive).forEach(key =>
            _turtleCmd[CanvasCommon.getPrimitiveCode(key)] = _primitive[key]);

        backupBeforeTurtle();
        requestAnimationFrame(drawScreen);
        return _self;
    }
};
