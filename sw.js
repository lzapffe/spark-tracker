/* SPARK-tracker service worker: caches the page files so the app opens fast
   and can be installed. Your data is never cached (it comes by POST from
   Apps Script). Bump CACHE on every release so devices get the new files. */
var CACHE = 'spark-v1';
var FILES = ['./', 'index.html', 'styles.css?v=1', 'app.js?v=1', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

// Install: store the page files.
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

// Activate: remove old versions.
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Fetch: page files from the network first (so updates show), cache as fallback.
// Anything that isn't a GET on this site (the data calls) is left alone.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
    return res;
  }).catch(function () { return caches.match(req); }));
});
