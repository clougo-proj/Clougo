//-------------------------------------------------------------------------------------------------------
// Copyright (C) Clougo Project. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

// Adapted from
//     http://www.williammalone.com/articles/html5-canvas-javascript-paint-bucket-tool/
function floodFill(canvas, startX, startY, fillColor) {

  function getPixelPos(x, y) {
      return (y * canvas.width + x) * 4;
  }

  function matchStartColor(data, pos, startColor) {
      return (data[pos]   === startColor.r &&
              data[pos+1] === startColor.g &&
              data[pos+2] === startColor.b &&
              data[pos+3] === startColor.a);
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

  var startPos = getPixelPos(startX, startY);
  var startColor = {
      r: dstData[startPos],
    g: dstData[startPos+1],
    b: dstData[startPos+2],
    a: dstData[startPos+3]
  };

  if (fillColor.r == startColor.r && fillColor.g == startColor.g && fillColor.b == startColor.b && fillColor.a == startColor.a) {
    return;
  }

  var todo = [[startX,startY]];

  while (todo.length) {
    var pos = todo.pop();
    var x = pos[0];
    var y = pos[1];
    var currentPos = getPixelPos(x, y);

    while((--y >= 0) && matchStartColor(dstData, currentPos, startColor)) {
      currentPos -= canvas.width * 4;
    }

    currentPos += canvas.width * 4;
    ++y;
    var reachLeft = false;
    var reachRight = false;

    while((y++ < canvas.height-1) && matchStartColor(dstData, currentPos, startColor)) {

      colorPixel(dstData, currentPos, fillColor);

      if (x > 0) {
        if (matchStartColor(dstData, currentPos-4, startColor)) {
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
        if (matchStartColor(dstData, currentPos+4, startColor)) {
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