/* =====================================================================
 * Vortex Tawla — service worker
 * ---------------------------------------------------------------------
 * The whole app is a handful of static files with no backend, so it can
 * be fully offline. Bump CACHE when any precached file changes; the old
 * cache is dropped on activate.
 *
 * PRECACHE must list every file the app loads. tests.html checks it
 * against the actual <script>/<link> tags in index.html, because a file
 * missing from this list only shows up as a broken app on a train.
 * ===================================================================== */

var CACHE = 'vortex-tawla-v7';

var PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/themes.css',
  'assets/css/vortex.css',
  'assets/css/tawla.css',
  'assets/js/engine.js',
  'assets/js/ai.js',
  'assets/js/coach.js',
  'assets/js/review.js',
  'assets/js/store.js',
  'assets/js/board.js',
  'assets/js/content.js',
  'assets/js/app.js',
  'assets/js/pwa.js',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon-180.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      /* Individually, so one bad entry cannot fail the whole install and
         leave the app with no offline copy at all. */
      .then(function (c) {
        return Promise.all(PRECACHE.map(function (url) {
          return c.add(new Request(url, { cache: 'reload' }))['catch'](function (err) {
            console.warn('[sw] could not precache', url, err);
          });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches['delete'](k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   // never touch cross-origin

  /* Navigations go to the network first so a deployed update is picked
     up straight away, and fall back to the cached shell when offline. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        })
        ['catch'](function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('index.html') || caches.match('./');
          });
        })
    );
    return;
  }

  /* Everything else: serve from cache immediately, refresh in the
     background. Fast offline, and at most one load stale. */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })['catch'](function () { return hit; });
      return hit || net;
    })
  );
});
