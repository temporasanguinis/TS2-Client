//import { AppInfo } from './appInfo'

export {};

var worker = self;
var CACHE_VERSION = 1;//AppInfo.Version;
var CURRENT_CACHES = {
  "maps": 'maps-cache-v' + CACHE_VERSION
};

worker.addEventListener('install', function(event:any) {
  console.log("Installing cache service worker");
});

worker.addEventListener('activate', function(event:any) {
  // Delete all caches that aren't named in CURRENT_CACHES.
  // While there is only one cache in this example, the same logic will handle the case where
  // there are multiple versioned caches.
  var expectedCacheNamesSet = new Set(Object.keys(CURRENT_CACHES).map(k => <string>(<any>CURRENT_CACHES)[k]));
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (!expectedCacheNamesSet.has(cacheName)) {
            // If this cache name isn't present in the set of "expected" cache names, then delete it.
            console.log('Deleting out of date cache:', cacheName);
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
});

worker.addEventListener('fetch', function(event:any) {
  console.log('Handling fetch event for', event.request.url);

  if (event.request.url.match("mapperData.json"))
  {
    event.respondWith(
      caches.open(CURRENT_CACHES.maps).then(function(cache) {
        return cache.match(event.request).then(function(response) {
          if (response) {
            // If there is an entry in the cache for event.request, then response will be defined
            // and we can just return it. Note that in this example, only font resources are cached.
            console.log(' Found response in cache:', response);
            var headersCopy = new Headers(response.headers);
            headersCopy.set('X-Service-Worker', 'true');
            headersCopy.set('X-Cached', 'true');
            return response.arrayBuffer().then(function(buffer) {
              return new Response(buffer, {
                status: response.status,
                statusText: response.statusText,
                headers: headersCopy
              });
            });
          }

          // Otherwise, if there is no entry in the cache for event.request, response will be
          // undefined, and we need to fetch() the resource.
          console.log(' No response for %s found in cache. About to fetch ' +
            'from network...', event.request.url);

          // We call .clone() on the request since we might use it in a call to cache.put() later on.
          // Both fetch() and cache.put() "consume" the request, so we need to make a copy.
          // (see https://fetch.spec.whatwg.org/#dom-request-clone)
          return fetch(event.request.clone()).then(function(response) {
            console.log('  Response for %s from network is: %O',
              event.request.url, response);

            if (response.status < 400 &&
                response.headers.has('content-type')) {
              // This avoids caching responses that we know are errors (i.e. HTTP status code of 4xx or 5xx).
              // We also only want to cache responses that correspond to fonts,
              // i.e. have a Content-Type response header that starts with "font/".
              // Note that for opaque filtered responses (https://fetch.spec.whatwg.org/#concept-filtered-response-opaque)
              // we can't access to the response headers, so this check will always fail and the font won't be cached.
              // All of the Google Web Fonts are served off of a domain that supports CORS, so that isn't an issue here.
              // It is something to keep in mind if you're attempting to cache other resources from a cross-origin
              // domain that doesn't support CORS, though!
              // We call .clone() on the response to save a copy of it to the cache. By doing so, we get to keep
              // the original response object which we will return back to the controlled page.
              // (see https://fetch.spec.whatwg.org/#dom-response-clone)
              console.log('  Caching the response to', event.request.url);
              cache.put(event.request, response.clone());
            } else {
              console.log('  Not caching the response to', event.request.url);
            }

            // Return the original response object, which will be used to fulfill the resource request.
            return response;
          });
        }).catch(function(error) {
          // This catch() will handle exceptions that arise from the match() or fetch() operations.
          // Note that a HTTP error response (e.g. 404) will NOT trigger an exception.
          // It will return a normal response object that has the appropriate error code set.
          console.error('  Error in fetch handler:', error);

          throw error;
        });
      })
    )
  }
  else {
    event.respondWith(fetch(event.request));
  }
});
