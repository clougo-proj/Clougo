// Copyright (C) Clougo Project.
// Copyright 2010 William Malone (www.williammalone.com)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Modified from
//     http://www.williammalone.com/articles/html5-canvas-javascript-paint-bucket-tool/
//     https://github.com/williammalone/HTML5-Paint-Bucket-Tool/blob/master/html5-canvas-paint-bucket.js
//

function floodFill(canvas, startX, startY, fillColor, fillMode, stopColor) {

  function getPixelPos(x, y) {
      return (y * canvas.width + x) * 4;
  }

  function matchColor(data, pos, color) {
      return (data[pos]   === color.r &&
              data[pos+1] === color.g &&
              data[pos+2] === color.b &&
              data[pos+3] === color.a);
  }

  function shouldFillPos(data, pos) {
      return !matchColor(data, pos, fillColor) &&
          (fillMode ? !matchColor(data, pos, stopColor) : matchColor(data, pos, startColor));
  }

  function colorPixel(data, pos, color) {
      data[pos] = color.r || 0;
    data[pos+1] = color.g || 0;
    data[pos+2] = color.b || 0;
    data[pos+3] = color.hasOwnProperty("a") ? color.a : 255;
  }

  var ctx = canvas.getContext("2d");
  var dstImg = ctx.getImageData(0,0,canvas.width,canvas.height);
  var dstData = dstImg.data;

  fillColor = color_to_rgba(fillColor);
  stopColor = color_to_rgba(stopColor);

  var startPos = getPixelPos(startX, startY);
  var startColor = {
      r: dstData[startPos],
    g: dstData[startPos+1],
    b: dstData[startPos+2],
    a: dstData[startPos+3]
  };

  if (!fillMode && (fillColor.r == startColor.r && fillColor.g == startColor.g && fillColor.b == startColor.b && fillColor.a == startColor.a)) {
    return;
  }

  var todo = [[startX,startY]];

  while (todo.length) {
    var pos = todo.pop();
    var x = pos[0];
    var y = pos[1];
    var currentPos = getPixelPos(x, y);

    while((--y >= 0) && shouldFillPos(dstData, currentPos)) {
      currentPos -= canvas.width * 4;
    }

    currentPos += canvas.width * 4;
    ++y;
    var reachLeft = false;
    var reachRight = false;

    while((y++ < canvas.height-1) && shouldFillPos(dstData, currentPos)) {

      colorPixel(dstData, currentPos, fillColor);

      if (x > 0) {
        if (shouldFillPos(dstData, currentPos-4)) {
          if (!reachLeft) {
            todo.push([x-1, y]);
            reachLeft = true;
          }
        }
        else if (reachLeft) {
          reachLeft = false;
        }
      }

      if (x < canvas.width-1) {
        if (shouldFillPos(dstData, currentPos+4)) {
          if (!reachRight) {
            todo.push([x+1, y]);
            reachRight = true;
          }
        }
        else if (reachRight) {
          reachRight = false;
        }
      }

      currentPos += canvas.width * 4;
    }
  }

  ctx.putImageData(dstImg,0,0);
}

// Adapted from
//     https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function color_to_rgba( color ) {
  if( color[0]=="#" ) { // hex notation
      color = color.replace( "#", "" ) ;
      var bigint = parseInt(color, 16);
      var r = (bigint >> 16) & 255;
      var g = (bigint >> 8) & 255;
      var b = bigint & 255;
      return {r:r,
              g:g,
              b:b,
              a:255} ;
  } else if( color.indexOf("rgb(")==0 ) { // already in rgba notation
      color = color.replace( "rgb(", "" ).replace( " ", "" ).replace( ")", "" ).split( "," ) ;
      return {r:parseInt(color[0]),
              g:parseInt(color[1]),
              b:parseInt(color[2]),
              a:255};
  } else {
      console.error( "warning: can't convert color to rgba: " + color ) ;
      return {r:0,
              g:0,
              b:0,
              a:0} ;
  }
}