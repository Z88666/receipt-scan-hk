/* Receipt Scanner HK — Service Worker (ES5 syntax; iOS 16 Safari safe).
 *
 * What it does: after the first successful load over https (e.g. GitHub
 * Pages), the Tesseract.js library files and the OCR language packs
 * (chi_tra + eng traineddata) are cached on the device, so later scans
 * work offline. The page itself, the records (localStorage) and manual
 * entry never needed the network in the first place.
 *
 * What it does NOT do: it never touches the receipt photos or the saved
 * records — those stay in the page / localStorage, not in this cache.
 * It only caches the two hosts below, and only their Tesseract files.
 *
 * Limits: a Service Worker needs http(s), so it does nothing when the
 * page is opened as a local file (file://) — double-clicking index.html
 * still works, just without the offline caching. Registration failure
 * is silent in the page: OCR still works online, manual entry always
 * works. Bump CACHE below when the Tesseract.js version changes, so old
 * cached files are dropped on the next visit.
 */
var CACHE = "receipt-scan-hk-v1";
var CORE = [
  "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(CORE);
    }).catch(function () { /* offline on first visit: try again later */ })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) { return caches.delete(k); }
      }));
    })
  );
  self.clients.claim();
});

function isTesseractFile(url) {
  return url.indexOf("cdn.jsdelivr.net/npm/tesseract.js") !== -1 ||
    url.indexOf("cdn.jsdelivr.net/npm/tesseract.js-core") !== -1 ||
    url.indexOf("tessdata.projectnaptha.com") !== -1;
}

self.addEventListener("fetch", function (e) {
  if (!isTesseractFile(e.request.url)) { return; }
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(e.request).then(function (hit) {
        if (hit) { return hit; }
        return fetch(e.request).then(function (res) {
          if (res && res.ok) { cache.put(e.request, res.clone()); }
          return res;
        });
      });
    })
  );
});
