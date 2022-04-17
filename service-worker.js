/**
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

// DO NOT EDIT THIS GENERATED OUTPUT DIRECTLY!
// This file should be overwritten as part of your build process.
// If you need to extend the behavior of the generated service worker, the best approach is to write
// additional code and include it using the importScripts option:
//   https://github.com/GoogleChrome/sw-precache#importscripts-arraystring
//
// Alternatively, it's possible to make changes to the underlying template file and then use that as the
// new base for generating output, via the templateFilePath option:
//   https://github.com/GoogleChrome/sw-precache#templatefilepath-string
//
// If you go that route, make sure that whenever you update your sw-precache dependency, you reconcile any
// changes made to this original template file with your modified copy.

// This generated service worker JavaScript will precache your site's resources.
// The code needs to be saved in a .js file at the top-level of your site, and registered
// from your pages in order to be used. See
// https://github.com/googlechrome/sw-precache/blob/master/demo/app/js/service-worker-registration.js
// for an example of how you can register this script and handle various service worker events.

/* eslint-env worker, serviceworker */
/* eslint-disable indent, no-unused-vars, no-multiple-empty-lines, max-nested-callbacks, space-before-function-paren, quotes, comma-spacing */
'use strict';

var precacheConfig = [
  ["ace-editor/src/ace.js","9731d6575f071f4fc653a5e7424194e0"],
  ["ace-editor/src/ext-searchbox.js","d725c85a80c8886b1006c35c5512711c"],
  ["ace-editor/src/mode-logo.js","48224ee0ee91fd155befa3054710d2e4"],
  ["ace-editor/src/theme-monokai.js","bd0d72d75804e492bf96bbe5fd1e337e"],
  ["bootstrap-3.3.7-dist/css/bootstrap.min.css","ec3bb52a00e176a7181d454dffaea219"],
  ["bootstrap-3.3.7-dist/fonts/glyphicons-halflings-regular.eot","f4769f9bdb7466be65088239c12046d1"],
  ["bootstrap-3.3.7-dist/fonts/glyphicons-halflings-regular.svg","89889688147bd7575d6327160d64e760"],
  ["bootstrap-3.3.7-dist/fonts/glyphicons-halflings-regular.ttf","e18bbf611f2a2e43afc071aa2f4e1512"],
  ["bootstrap-3.3.7-dist/fonts/glyphicons-halflings-regular.woff","fa2772327f55d8198301fdb8bcfc8158"],
  ["bootstrap-3.3.7-dist/fonts/glyphicons-halflings-regular.woff2","448c34a56d699c29117adc64c43affeb"],
  ["bootstrap-3.3.7-dist/js/bootstrap.min.js","5869c96cc8f19086aee625d670d741f9"],
  ["bootstrap-3.3.7-dist/js/npm.js","ccb7f3909e30b1eb8f65a24393c6e12b"],
  ["css/main.css","751dc2cc116be71925a2eb5fe1926fbb"],
  ["floodfill/floodfill.js","1023576c8049d9e4604e8fdb74ca4aaf"],
  ["generated/UCBLogo.js","54515577a24e5f49fb68c3a95c17adfa"],
  ["generated/clitests.js","1eab95a7ec274d85b6a6e040fb4bd282"],
  ["generated/demo.js","566ad17ebf5082d4fa183f749ca0c570"],
  ["generated/mod.js","bd6f550f3ef9ce42353b19192d33a980"],
  ["generated/unittests.js","e9ea3f64e787a87c36f4a2c6f61b8d1f"],
  ["icon/clougo-icon-144.png","08fcf7866fd06ae18957a17575a11abd"],
  ["index.html","90ef970a2c71a8e8d2cc0f7633af2623"],
  ["logo/canvas.js","8d57e792ea33dbbab756c6edbb6e7c1d"],
  ["logo/canvasCommon.js","3f45430b407b08bdac1535c9d3e896fb"],
  ["logo/codegen.js","027035ff918a1a60e94f475e7e5d062b"],
  ["logo/config.js","44fe5b0492956ab6c60b342a24638f4d"],
  ["logo/constants.js","352a87ce7864cf30b7c3e5252502ff57"],
  ["logo/env.js","5e5f5e8ddc060bd0445ad281b2decd07"],
  ["logo/interpreter.js","7bd545e0c8b1c5dd5c93db25d89a6e60"],
  ["logo/lib/al.js","37f7f68516f36034923504daaddac795"],
  ["logo/lib/clougo.js","86ba4ec4061c0653ac14d4c9024b9439"],
  ["logo/lib/comm.js","97067b72d175d9057d8828661e13600b"],
  ["logo/lib/ctrl.js","f4a8a6c1c4da26dc3927aa21e9ea7a4f"],
  ["logo/lib/ds.js","05a2db2e60022950b7bf4b1741e5d9de"],
  ["logo/lib/graphics.js","e9b66fef95e80d70607f60da99c567d7"],
  ["logo/lib/misc.js","7607985c621ff812f78c6728a1c5f980"],
  ["logo/lib/os.js","a0df1fc56484de1ccd28e9341cc69102"],
  ["logo/lib/ws.js","0ee70ffd0be874ea011ae44f3384efe3"],
  ["logo/logo.js","f8112871b302486b3905e3c5942ffcea"],
  ["logo/logofs.js","c2cfcc773886dd719846157d916d83f0"],
  ["logo/lrt.js","5ec1c59ddda6169548f39ef5ad5f61db"],
  ["logo/parse.js","1417b4f58ab391cfe64e144efa016b70"],
  ["logo/sys.js","507eb575a3dfece2848466e470a03704"],
  ["logo/testrunner.js","fa34b50c0d9cd3a22705e2b817499ffa"],
  ["logo/trace.js","defc658f5b7e800a09b12a8c1fc8292b"],
  ["logo/type.js","3190a0878c6b19de47ef8395440f3c94"],
  ["logo/ux.js","91f0313fe6a1a2211af802c9c61172df"],
  ["manifest.json","622ae0a7d6ffbc6279f04681d9daa32d"],
  ["package.json","e40c89906b9af4b13f0ba911a16b93a6"],
  ["jquery/jquery-1.11.0.min.js","8fc25e27d42774aeae6edbc0a18b72aa"],
  ["vanilla-terminal/VanillaTerminal.js","f432043ebe7b11ec9d640242ac120002"],
  ["vanilla-terminal/VanillaTerminal.css","4eed9247f7444b0f9d83dff06d46a536"]
];

var cacheName = 'sw-precache-v3-sw-precache-' + (self.registration ? self.registration.scope : '');

var ignoreUrlParametersMatching = [/^utm_/];

var addDirectoryIndex = function(originalUrl, index) {
    var url = new URL(originalUrl);
    if (url.pathname.slice(-1) === '/') {
      url.pathname += index;
    }
    return url.toString();
  };

var cleanResponse = function(originalResponse) {
    // If this is not a redirected response, then we don't have to do anything.
    if (!originalResponse.redirected) {
      return Promise.resolve(originalResponse);
    }

    // Firefox 50 and below doesn't support the Response.body stream, so we may
    // need to read the entire body to memory as a Blob.
    var bodyPromise = 'body' in originalResponse ?
      Promise.resolve(originalResponse.body) :
      originalResponse.blob();

    return bodyPromise.then(function(body) {
      // new Response() is happy when passed either a stream or a Blob.
      return new Response(body, {
        headers: originalResponse.headers,
        status: originalResponse.status,
        statusText: originalResponse.statusText
      });
    });
  };

var createCacheKey = function(originalUrl, paramName, paramValue,
                           dontCacheBustUrlsMatching) {
    // Create a new URL object to avoid modifying originalUrl.
    var url = new URL(originalUrl);

    // If dontCacheBustUrlsMatching is not set, or if we don't have a match,
    // then add in the extra cache-busting URL parameter.
    if (!dontCacheBustUrlsMatching ||
        !(url.pathname.match(dontCacheBustUrlsMatching))) {
      url.search += (url.search ? '&' : '') +
        encodeURIComponent(paramName) + '=' + encodeURIComponent(paramValue);
    }

    return url.toString();
  };

var isPathWhitelisted = function(whitelist, absoluteUrlString) {
    // If the whitelist is empty, then consider all URLs to be whitelisted.
    if (whitelist.length === 0) {
      return true;
    }

    // Otherwise compare each path regex to the path of the URL passed in.
    var path = (new URL(absoluteUrlString)).pathname;
    return whitelist.some(function(whitelistedPathRegex) {
      return path.match(whitelistedPathRegex);
    });
  };

var stripIgnoredUrlParameters = function(originalUrl,
    ignoreUrlParametersMatching) {
    var url = new URL(originalUrl);
    // Remove the hash; see https://github.com/GoogleChrome/sw-precache/issues/290
    url.hash = '';

    url.search = url.search.slice(1) // Exclude initial '?'
      .split('&') // Split into an array of 'key=value' strings
      .map(function(kv) {
        return kv.split('='); // Split each 'key=value' string into a [key, value] array
      })
      .filter(function(kv) {
        return ignoreUrlParametersMatching.every(function(ignoredRegex) {
          return !ignoredRegex.test(kv[0]); // Return true iff the key doesn't match any of the regexes.
        });
      })
      .map(function(kv) {
        return kv.join('='); // Join each [key, value] array into a 'key=value' string
      })
      .join('&'); // Join the array of 'key=value' strings into a string with '&' in between each

    return url.toString();
  };


var hashParamName = '_sw-precache';
var urlsToCacheKeys = new Map(
  precacheConfig.map(function(item) {
    var relativeUrl = item[0];
    var hash = item[1];
    var absoluteUrl = new URL(relativeUrl, self.location);
    var cacheKey = createCacheKey(absoluteUrl, hashParamName, hash, false);
    return [absoluteUrl.toString(), cacheKey];
  })
);

function setOfCachedUrls(cache) {
  return cache.keys().then(function(requests) {
    return requests.map(function(request) {
      return request.url;
    });
  }).then(function(urls) {
    return new Set(urls);
  });
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(cacheName).then(function(cache) {
      return setOfCachedUrls(cache).then(function(cachedUrls) {
        return Promise.all(
          Array.from(urlsToCacheKeys.values()).map(function(cacheKey) {
            // If we don't have a key matching url in the cache already, add it.
            if (!cachedUrls.has(cacheKey)) {
              var request = new Request(cacheKey, {credentials: 'same-origin'});
              return fetch(request).then(function(response) {
                // Bail out of installation unless we get back a 200 OK for
                // every request.
                if (!response.ok) {
                  console.log('Request for ' + cacheKey + ' returned a ' +
                    'response with status ' + response.status);
                  throw new Error('Request for ' + cacheKey + ' returned a ' +
                    'response with status ' + response.status);
                }

                return cleanResponse(response).then(function(responseToCache) {
                  return cache.put(cacheKey, responseToCache);
                });
              });
            }
          })
        );
      });
    }).then(function() {

      // Force the SW to transition from installing -> active state
      return self.skipWaiting();

    })
  );
});

self.addEventListener('activate', function(event) {
  var setOfExpectedUrls = new Set(urlsToCacheKeys.values());

  event.waitUntil(
    caches.open(cacheName).then(function(cache) {
      return cache.keys().then(function(existingRequests) {
        return Promise.all(
          existingRequests.map(function(existingRequest) {
            if (!setOfExpectedUrls.has(existingRequest.url)) {
              return cache.delete(existingRequest);
            }
          })
        );
      });
    }).then(function() {

      return self.clients.claim();

    })
  );
});


self.addEventListener('fetch', function(event) {
  if (event.request.method === 'GET') {
    // Should we call event.respondWith() inside this fetch event handler?
    // This needs to be determined synchronously, which will give other fetch
    // handlers a chance to handle the request if need be.
    var shouldRespond;

    // First, remove all the ignored parameters and hash fragment, and see if we
    // have that URL in our cache. If so, great! shouldRespond will be true.
    var url = stripIgnoredUrlParameters(event.request.url, ignoreUrlParametersMatching);
    shouldRespond = urlsToCacheKeys.has(url);

    // If shouldRespond is false, check again, this time with 'index.html'
    // (or whatever the directoryIndex option is set to) at the end.
    var directoryIndex = 'index.html';
    if (!shouldRespond && directoryIndex) {
      url = addDirectoryIndex(url, directoryIndex);
      shouldRespond = urlsToCacheKeys.has(url);
    }

    // If shouldRespond is still false, check to see if this is a navigation
    // request, and if so, whether the URL matches navigateFallbackWhitelist.
    var navigateFallback = '';
    if (!shouldRespond &&
        navigateFallback &&
        (event.request.mode === 'navigate') &&
        isPathWhitelisted([], event.request.url)) {
      url = new URL(navigateFallback, self.location).toString();
      shouldRespond = urlsToCacheKeys.has(url);
    }

    // If shouldRespond was set to true at any point, then call
    // event.respondWith(), using the appropriate cache key.
    if (shouldRespond) {
      event.respondWith(
        caches.open(cacheName).then(function(cache) {
          return cache.match(urlsToCacheKeys.get(url)).then(function(response) {
            if (response) {
              return response;
            }
            throw Error('The cached response that was expected is missing.');
          });
        }).catch(function(e) {
          // Fall back to just fetch()ing the request if some unexpected error
          // prevented the cached response from being valid.
          console.warn('Couldn\'t serve response for "%s" from cache: %O', event.request.url, e);
          return fetch(event.request);
        })
      );
    }
  }
});
