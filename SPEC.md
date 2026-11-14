# Offline Receipt Scanner 離線單據掃描記賬 — SPEC (finished)

## What it is

Photograph a Hong Kong receipt → on-device OCR reads merchant, date,
total and line items → the expense is saved locally, exportable as CSV.
No upload, no account, no server. The photo and the data never leave
the phone.

## Status

**Finished.** All of the following are done and tested:

1. **OCR engine wired in.** `<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js">`
   is in `<head>` of `index.html`; the Scan button calls
   `Tesseract.recognize(image, "chi_tra+eng")` with a `logger` that
   shows progress — loading model → recognising text (with %) → done.
   If the CDN cannot load, the page says so plainly (check network),
   opens an empty form, and the receipt can still be entered manually
   (there is also a 人手輸入 button that skips OCR entirely).
2. **Line-item extraction.** `parser.js` has `parseLineItems(lines)`
   (see Parser rules below); extracted items show under the receipt
   form, are editable / deletable / addable, are saved with the record,
   and are included in the CSV export (`items` column).
3. **Single file.** `parser.js` is inlined into `index.html`, so the
   page works on its own. `parser.js` remains the node-testable source
   of truth — keep both in sync (verified by diff in finishing pass).

Still open (optional, not blocking publish):

- **Offline, third pass (done 2026-11-11).** `sw.js` caches the
  Tesseract.js library and the language packs after the first visit
  over https, so later scans work offline; `vendor/README.md`
  documents self-hosting the two `.traineddata.gz` packs with the
  one-line `TESS_LANG_PATH` switch in `index.html`. The packs
  themselves are deliberately not vendored (~15 MB). The Service
  Worker does nothing on `file://` (it needs http(s)).
- **Undo + duplicate warning (done 2026-11-11).** Deleting a record
  or clearing all records can be undone (in-memory snapshots, capped
  at 20); saving a record with the same merchant, date and total as
  an existing one asks first.

## Parser rules (parser.js, tested)

- Merchant: first plausible non-price line (skips thank-you / address /
  phone lines).
- Date: DD/MM/YYYY (HK order), YYYY-MM-DD, or "9 Nov 2026" → ISO.
- Total: last amount on a line containing 合共/總數/應付/TOTAL/etc.;
  fallback = largest amount on the receipt.
- Confidence = how many of the three fields were found (0–1). The UI
  always asks the user to verify before saving — OCR is never trusted
  blindly, and a wrong total in your accounts is worse than no total.

## Line-item rules (parseLineItems, tested)

- Input: the `lines` array from `parseReceipt`, or a raw text string.
- An item line is a name plus an amount at the **end** of the line:
  `維他奶 250ml $8.50`, `白米 5kg $72.80`, `Fresh Milk 1L $32.50`.
  Comma amounts (`$1,234.56`) are handled; an optional trailing
  `HKD` is allowed.
- Lines without a trailing amount are ignored.
- Total / subtotal / payment / change / thank-you lines are never
  items: 合共/總數/應付/TOTAL, 小計/Subtotal, 八達通/Octopus,
  VISA/Mastercard, 現金/Cash, 找續/Change, and date lines.
- Returns `[{ name, amount }]` in receipt order. Never throws on
  messy OCR text — empty input returns `[]`.

## Why this beats a notes-app photo

- Receipts pile up and never become numbers. This turns them into a
  ledger in one tap, with a CSV you can open in a spreadsheet.
- Bank apps categorise card spending but not cash, Octopus, or FPS
  receipts. This covers the cash economy — which is most of daily HK
  spending for many people.
- Privacy is the feature: on-device OCR means no receipt photos on
  anyone's server. Existing receipt apps all upload.

## Tests

- `node tests/test_parser.js` — 105 checks, all pass (run 2026-11-11):
  the original 13 plus 9 for `parseLineItems` (trailing amount, item
  without amount ignored, comma amounts, TOTAL / subtotal / payment
  lines excluded, empty array and empty string, raw-text input,
  full-receipt lines), plus 24 v2, 15 v3, and 44 v4 checks (duplicate
  detection, undo snapshots, Service Worker, vendor docs, page wiring,
  parser/inline sync test, ES5 guard).
- The inlined parser in `index.html` was verified byte-identical to
  `parser.js`, and both inline `<script>` blocks pass `node --check`.
- Still to do before claiming real-world accuracy: end-to-end test
  with 5 real HK receipt photos (supermarket, cha chaan teng,
  convenience store, pharmacy, restaurant) through Tesseract.js;
  measure field accuracy; test on iOS 16 Safari (camera input +
  localStorage + Blob download).

## Publish

Repo `Z88666/receipt-scan-hk`, GitHub Pages from root. No build step.
