# Self-hosting the OCR language packs 自托管語言包

By default the page downloads the Tesseract.js language data
(`chi_tra` + `eng` traineddata, about 15 MB, once) from the CDN, and
the Service Worker (`../sw.js`) then caches it on the device — that is
already enough for offline use after the first visit over https.

Self-hosting is only needed if you want zero CDN dependence (e.g. the
CDN is blocked, or you want the page to work offline from the very
first load). The language files are **not** in this repo: they are
~15 MB and would bloat every clone. Download them yourself:

## Steps 步驟

1. Download the two files (tessdata_fast = smaller, faster, slightly
   less accurate; tessdata_best = larger, more accurate — pick one set,
   do not mix):
   - `chi_tra.traineddata.gz` —
     https://github.com/tesseract-ocr/tessdata_fast/raw/main/chi_tra.traineddata.gz
   - `eng.traineddata.gz` —
     https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata.gz
2. Put both files in this folder (`vendor/`), next to this README.
   Keep the `.gz` extension: Tesseract.js downloads the `.gz` files
   and gunzips them in the browser.
3. In `../index.html`, set `TESS_LANG_PATH` (near the top of the page
   script) from `null` to `"./vendor/"`:
   ```js
   var TESS_LANG_PATH = "./vendor/";
   ```
4. Open the page over https (e.g. GitHub Pages) or a local server and
   scan once: the worker fetches the packs from `vendor/` instead of
   the CDN. `sw.js` caches them too, so later scans work offline.

## Notes 注意

- The traineddata files are from the Tesseract project
  (Apache 2.0, https://github.com/tesseract-ocr/tessdata_fast).
- `chi_tra` is Traditional Chinese; `eng` is English. The page asks
  Tesseract.js for `chi_tra+eng`, so both files are needed.
- If a pack is missing or the path is wrong, recognition fails with a
  plain error and the page still offers manual entry — nothing is lost.
- Do not commit large `.traineddata.gz` files to a repo you sync over a
  slow connection; the CDN + Service Worker route above is the
  recommended default.
