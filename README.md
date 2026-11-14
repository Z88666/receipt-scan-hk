# Offline Receipt Scanner 離線單據掃描記賬

**Photograph a receipt → merchant, date, total and line items are read on your phone → your spending is saved locally, exportable as CSV. No upload, no account.**

**影張單據相,自動認出商戶、日期、總數同逐項貨品,記低開支,資料唔離開你部電話。**

## Try it 試用

Open `index.html` (single file — works on its own, no build step, no server).
Pick a receipt photo, press **開始辨識 (OCR)**, check the result, press **儲存呢筆**.
Export everything as CSV with **匯出 CSV**.

開啟 `index.html` 就用得 (單一檔案,唔使安裝、唔使伺服器)。
揀張單據相,㩒**開始辨識 (OCR)**,核對結果,㩒**儲存呢筆**。
㩒**匯出 CSV** 就可以將全部記錄匯出。

## What it does 功能

- **On-device OCR 機內辨識**: Tesseract.js (`chi_tra+eng`, 繁中 + 英文) reads the receipt in the browser. First run downloads the language data from the CDN; recognition itself runs on your phone.
- **Merchant / date / total 商戶、日期、總數**: parsed from real HK receipt formats — PARKnSHOP, Wellcome, 7-Eleven, cha chaan teng, McDonald's, YATA, Japan Home Centre, Pricerite, Fortress, Broadway, Pizza Hut, Yoshinoya, Café de Coral, Fairwood, TamJai, Saizeriya — DD/MM/YYYY (incl. 2-digit year), ISO, "9 Nov 2026" and Chinese `2026年11月9日` dates (year-less `11月9日` also works, assumed current year, and never beats a full date), `合共 / 應付 / 實付 / TOTAL` lines, comma and integer amounts. Known chains are recognised by name (百佳 → PARKnSHOP 百佳, etc.), and subtotal, payment method (Octopus / Visa / cash / FPS…) and change (找續) are read too.
- **Category + monthly summary 類別 + 每月統計**: every receipt is auto-categorised (超市日用品 / 飲食 / 藥妝健康 / 交通 / … — editable in the form), and the page shows a last-6-months bar chart, a category breakdown with percentages, and this month's total with a per-day average. CSV export now includes category and payment columns.
- **Line items 逐項貨品**: item lines like `維他奶 250ml $8.50` are extracted as name + amount, shown under the form, editable, deletable, addable, saved with the record, and included in the CSV export (`items` column). Total / subtotal / payment lines are never treated as items. If the items do not add up to the total, the form warns you live (a common OCR slip) — check the items or the total before saving.
- **Manual entry 人手輸入**: if the OCR engine cannot load (no network / CDN blocked), the page says so plainly and opens an empty form — enter the receipt by hand. The **人手輸入 (唔用 OCR)** button does the same without OCR.
- **Records you can fix 記錄可改可刪**: every saved record has its own 刪除 button (no more all-or-nothing clear); saving an empty form is refused, and a bad date (wrong format or impossible, e.g. 2026-02-30) is rejected with a plain message instead of being saved. CSV export starts with a UTF-8 BOM so Excel on Windows opens the Chinese text correctly, and exporting with no records says so instead of downloading an empty file.
- **Undo delete 復原刪除**: deleting one record or clearing all records can be undone with the **復原刪除** button (snapshots are kept in memory, so undo works until the page is closed). The undo stack is capped at 20 snapshots.
- **Duplicate warning 防重複儲存**: saving a record with the same merchant, date and total as one already saved asks first ("可能係重複儲存") — a double-tap on Save no longer creates a duplicate. A missing date or total never counts as a match.
- **Offline after first use 首次之後離線可用**: the first scan downloads the language packs once (~15 MB; Tesseract.js then keeps them in IndexedDB). When the page is opened over https (e.g. GitHub Pages), `sw.js` (Service Worker) also caches the Tesseract.js library and the language packs on the device, so later scans work offline. On `file://` the Service Worker cannot run, so offline caching needs hosting — the page still works online and manual entry always works. To remove the CDN entirely, put the two `.traineddata.gz` files in `vendor/` (see `vendor/README.md`) and flip the one-line `TESS_LANG_PATH` switch in `index.html`.
- **Try without a photo 唔使影相都試到**: **試用範例單據** loads a real PARKnSHOP receipt, and **解析貼上的文字** parses receipt text pasted from any OCR app — useful when the camera/OCR fails.
- **Progress 進度顯示**: the Scan button shows loading model → recognising text (with %) → done, and a clear error message if recognition fails.
- **Private 私隱**: no upload, no account, no server. Photos and records stay in the phone's localStorage only.
- **Single file 單一檔案**: `parser.js` is inlined into `index.html`, so the page works on its own. `parser.js` remains the node-testable source of truth — keep both in sync.

## Status 狀態

**Finished 已完成.** Parser, OCR wiring, line-item extraction, manual entry and CSV export are all done and tested. See [`SPEC.md`](SPEC.md).

## Tests 測試

`node tests/test_parser.js` — **105 checks, all pass**: the original 22, plus 24 new — Chinese dates, 2-digit years, ISO-date regression (was misread as 2009-11-26), integer totals, `$` integer and `HKD`-suffix amounts, dates never read as money, quantity lines (`x2` / `2x`), split name/amount lines (and the guard that a following amount-only line does not steal the item), known-chain names, subtotal / payment / change, category guessing from merchant and items, and a full McDonald's receipt. Plus 15 more in this pass — 10 more HK chains (一田 / 日本城 / 實惠 / 豐澤 / 百老匯 / 必勝客 / 吉野家 / 大家樂 / 大快活 / 譚仔), year-less Chinese dates (assumed current year, never beating a full date), and `sumItems` (items add up, empty, null amounts ignored). Plus 44 more in the third pass — duplicate detection (exact match, case/space-insensitive, within-a-cent counts, different total/date/merchant rejected, missing date or total never a match), undo snapshots (deep copy, push/pop, empty-stack, 20-snapshot cap), the Service Worker (`sw.js` exists, caches the Tesseract.js CDN and the language-pack host, cache-first, drops old caches), the `vendor/` self-host docs (both pack names, the one-line `TESS_LANG_PATH` switch), page wiring (undo button, duplicate confirm, service-worker registration), a test that `parser.js` and the copy inlined in `index.html` are identical, and an automated ES5 guard over the shipped JS (`?.`, `??`, `=>`, template literals, `const`/`let`, class declarations, spread, `Object.assign`, `Array.from`, `includes`, …).

## Tech 技術

Pure HTML/CSS/ES5, white background, iOS 16 Safari safe. OCR: Tesseract.js v5 via jsDelivr CDN. Storage: localStorage only. No dependencies in the repo, no login, free.

## Future work (optional) 之後可做

- The language packs themselves are deliberately **not** vendored in
  this repo (~15 MB of `.traineddata.gz` would bloat every clone).
  The CDN + Service Worker route above is the recommended default;
  `vendor/README.md` documents the self-host steps for anyone who
  wants zero CDN dependence.
- Real-world accuracy still needs an end-to-end test with 5 real HK
  receipt photos through Tesseract.js, and a re-check on iOS 16 Safari
  (camera input + localStorage + Blob download) — the page cannot be
  verified on the real device from here.

## Licence

MIT.
