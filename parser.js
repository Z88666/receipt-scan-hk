/* HK receipt parser — pure functions, no dependencies, ES5.
 * Used by index.html (browser) and tests/test_parser.js (node).
 * Input: raw OCR text from Tesseract.js (chi_tra+eng).
 * Output: { merchant, date, total, subtotal, currency, payment, change,
 *           category, lines, confidence }
 * parseLineItems(lines) -> [{ name, amount }] for item lines.
 * guessCategory(merchant, items) -> one of the spending categories.
 * Never throws on messy OCR text — returns nulls and lets the user correct.
 */
(function (root) {
  "use strict";

  var TOTAL_WORDS = ["total", "合共", "總數", "總計", "應付", "應收",
    "amount due", "balance due", "grand total", "net total",
    "實付", "總額", "合計", "收費", "應付金額", "總金額", "金額",
    "payable", "amount payable", "total amount"];
  var IGNORE_LINES = /^(thank|多謝|歡迎|welcome|tel|電話|地址|address|單號|receipt|收據|invoice|發票|編號|no\.|編)/i;

  /* Well-known Hong Kong chains: OCR often mangles the name, so match a
     substring and return the canonical name. Checked before the generic
     first-plausible-line rule, over the first few lines only. */
  var KNOWN_MERCHANTS = [
    ["PARKNSHOP", "PARKnSHOP 百佳"], ["百佳", "PARKnSHOP 百佳"],
    ["WELLCOME", "Wellcome 惠康"], ["惠康", "Wellcome 惠康"],
    ["7-ELEVEN", "7-Eleven"], ["7-11", "7-Eleven"],
    ["CIRCLE K", "Circle K"], ["OK便利店", "Circle K"],
    ["MCDONALD", "McDonald's"], ["麥當勞", "McDonald's"],
    ["KFC", "KFC"], ["肯德基", "KFC"],
    ["MANNINGS", "Mannings 萬寧"], ["萬寧", "Mannings 萬寧"],
    ["WATSONS", "Watsons 屈臣氏"], ["屈臣氏", "Watsons 屈臣氏"],
    ["AEON", "AEON"], ["永旺", "AEON"],
    ["DON DON DONKI", "Don Don Donki"], ["DONKI", "Don Don Donki"],
    ["SASA", "Sasa 莎莎"], ["莎莎", "Sasa 莎莎"],
    ["HKTV", "HKTVmall"], ["DECATHLON", "Decathlon"], ["迪卡儂", "Decathlon"],
    ["IKEA", "IKEA"], ["宜家", "IKEA"],
    ["DAISO", "Daiso"], ["大創", "Daiso"],
    ["759", "759 阿信屋"], ["阿信屋", "759 阿信屋"],
    ["STARBUCKS", "Starbucks"], ["星巴克", "Starbucks"],
    ["SUSHIRO", "Sushiro 壽司郎"], ["壽司郎", "Sushiro 壽司郎"],
    ["GENKI", "Genki Sushi 元気寿司"], ["元気寿司", "Genki Sushi 元気寿司"],
    ["UNIQLO", "Uniqlo"], ["優衣庫", "Uniqlo"],
    ["MUJI", "Muji 無印良品"], ["無印良品", "Muji 無印良品"],
    ["YATA", "YATA 一田"], ["一田", "YATA 一田"],
    ["JAPAN HOME", "Japan Home Centre 日本城"], ["日本城", "Japan Home Centre 日本城"],
    ["PRICERITE", "Pricerite 實惠"], ["實惠", "Pricerite 實惠"],
    ["FORTRESS", "Fortress 豐澤"], ["豐澤", "Fortress 豐澤"],
    ["BROADWAY", "Broadway 百老匯"], ["百老匯", "Broadway 百老匯"],
    ["PIZZA HUT", "Pizza Hut 必勝客"], ["必勝客", "Pizza Hut 必勝客"],
    ["YOSHINOYA", "Yoshinoya 吉野家"], ["吉野家", "Yoshinoya 吉野家"],
    ["CAFE DE CORAL", "Café de Coral 大家樂"], ["大家樂", "Café de Coral 大家樂"],
    ["FAIRWOOD", "Fairwood 大快活"], ["大快活", "Fairwood 大快活"],
    ["TAMJAI", "TamJai 譚仔"], ["TAM JAI", "TamJai 譚仔"], ["譚仔", "TamJai 譚仔"],
    ["SAIZERIYA", "Saizeriya 薩莉亞"], ["薩莉亞", "Saizeriya 薩莉亞"]
  ];

  var PAYMENT_WORDS = [
    ["octopus", "Octopus 八達通"], ["八達通", "Octopus 八達通"],
    ["visa", "Visa"], ["mastercard", "Mastercard"], ["master", "Mastercard"],
    ["cash", "Cash 現金"], ["現金", "Cash 現金"],
    ["fps", "FPS 轉數快"], ["轉數快", "FPS 轉數快"],
    ["alipay", "Alipay 支付寶"], ["支付寶", "Alipay 支付寶"],
    ["wechat", "WeChat Pay 微信支付"], ["微信", "WeChat Pay 微信支付"],
    ["payme", "PayMe"], ["apple pay", "Apple Pay"],
    ["credit card", "Credit card 信用卡"], ["信用卡", "Credit card 信用卡"],
    ["eps", "EPS 易辦事"]
  ];

  /* Category keywords: checked against merchant name first, then item names. */
  var CATEGORY_RULES = [
    ["超市日用品", ["百佳", "惠康", "parknshop", "wellcome", "759", "阿信屋", "aeon", "donki", "超市", "market", "supermarket"]],
    ["飲食", ["茶餐廳", "餐廳", "麥當勞", "mcdonald", "kfc", "starbucks", "星巴克", "壽司", "sushi", "飯", "麵", "咖啡", "coffee", "茶", "pizza", "cafe", "餐", "食"]],
    ["藥妝健康", ["萬寧", "mannings", "屈臣氏", "watsons", "莎莎", "sasa", "藥房", "pharmacy", "drug"]],
    ["交通", ["mtr", "港鐵", "巴士", "bus", "的士", "taxi", "八達通", "octopus", "加油", "petrol"]],
    ["服裝", ["uniqlo", "優衣庫", "muji", "無印", "衣服", "clothing", "鞋", "shoe"]],
    ["家居", ["ikea", "宜家", "decathlon", "迪卡儂", "家居", "家品"]],
    ["文具書籍", ["書", "book", "文具", "stationery"]],
    ["娛樂", ["電影", "cinema", "movie", "遊戲", "game", "唱k", "karaoke"]]
  ];

  function cleanLines(text) {
    return String(text || "").split(/\r?\n/)
      .map(function (l) { return l.replace(/\s+/g, " ").trim(); })
      .filter(function (l) { return l.length > 0; });
  }

  function pad(s) { s = String(s); return s.length === 1 ? "0" + s : s; }

  function validDate(y, m, d) {
    y = parseInt(y, 10); m = parseInt(m, 10); d = parseInt(d, 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) { return null; }
    if (y < 100) { y += 2000; }
    if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) { return null; }
    return y + "-" + pad(m) + "-" + pad(d);
  }

  function findDate(lines) {
    // Order matters: ISO first — otherwise the DD/MM pattern would match
    // a substring of an ISO date ("26-11-09" inside "2026-11-09").
    var patterns = [
      // 2026年11月9日 / 2026年11月9號
      /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})[日號]/,
      // 2026-11-09, 2026/11/09
      /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
      // 09/11/2026, 9-11-2026, 09.11.2026, 09/11/26 (HK order: DD/MM/YYYY)
      /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/,
      // 9 Nov 2026, 09 NOV 2026
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i
    ];
    for (var i = 0; i < lines.length; i++) {
      for (var p = 0; p < patterns.length; p++) {
        var m = lines[i].match(patterns[p]);
        if (!m) continue;
        if (p === 0) {
          var c = validDate(m[1], m[2], m[3]);
          if (c) { return c; }
        } else if (p === 1) {
          var iso = validDate(m[1], m[2], m[3]);
          if (iso) { return iso; }
        } else if (p === 3) {
          var months = { jan: "01", feb: "02", mar: "03", apr: "04",
            may: "05", jun: "06", jul: "07", aug: "08", sep: "09",
            oct: "10", nov: "11", dec: "12" };
          var mon = months[m[2].toLowerCase().slice(0, 3)];
          if (mon) {
            var named = validDate(m[3], mon, m[1]);
            if (named) { return named; }
          }
        } else {
          // DD/MM/YYYY or DD/MM/YY — only accept plausible HK dates
          var dd = validDate(m[3], m[2], m[1]);
          if (dd) { return dd; }
        }
      }
    }
    // Second pass: year-less "11月9日" (some small-shop receipts omit the
    // year) — only if no full date was found anywhere above; assume the
    // current year. Kept last so a full date on any line always wins.
    for (var j = 0; j < lines.length; j++) {
      var ym = lines[j].match(/(\d{1,2})月\s*(\d{1,2})[日號]/);
      if (ym) {
        var yd = validDate(new Date().getFullYear(), ym[1], ym[2]);
        if (yd) { return yd; }
      }
    }
    return null;
  }

  /* Amounts in a line: decimals ($8.50, 8.50, $1,234.56), $-prefixed
     integers ($38), or integers with an HKD suffix (38 HKD). Bare integers
     are NOT amounts — otherwise dates like 09/11/2026 would read as money. */
  function amountsIn(line) {
    var out = [];
    var re = /(?:HK\$|\$)\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?|(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})\b|(\d{1,3}(?:,\d{3})*|\d+)\s*(?:HKD|HKS|HK\$)/g;
    var m;
    while ((m = re.exec(line)) !== null) {
      var whole, frac;
      if (m[1] !== undefined) { whole = m[1]; frac = m[2]; }
      else if (m[3] !== undefined) { whole = m[3]; frac = m[4]; }
      else { whole = m[5]; frac = undefined; }
      out.push(parseFloat(whole.replace(/,/g, "") + "." + (frac || "00")));
    }
    return out;
  }

  function findTotal(lines) {
    var best = null;
    for (var i = 0; i < lines.length; i++) {
      var low = lines[i].toLowerCase();
      var isTotalLine = false;
      for (var w = 0; w < TOTAL_WORDS.length; w++) {
        if (low.indexOf(TOTAL_WORDS[w].toLowerCase()) !== -1) { isTotalLine = true; break; }
      }
      var amounts = amountsIn(lines[i]);
      if (isTotalLine && amounts.length) {
        // Total is usually the last amount on a total line.
        best = amounts[amounts.length - 1];
      }
    }
    if (best !== null) return best;
    // Fallback: largest amount anywhere (often the total on short receipts),
    // skipping date-like lines so 2026 is never read as a price.
    var max = null;
    for (var j = 0; j < lines.length; j++) {
      if (DATE_LIKE.test(lines[j])) continue;
      var a = amountsIn(lines[j]);
      for (var k = 0; k < a.length; k++) {
        if (max === null || a[k] > max) max = a[k];
      }
    }
    return max;
  }

  function findSubtotal(lines) {
    for (var i = 0; i < lines.length; i++) {
      var low = lines[i].toLowerCase();
      if (low.indexOf("小計") !== -1 || low.indexOf("subtotal") !== -1) {
        var a = amountsIn(lines[i]);
        if (a.length) { return a[a.length - 1]; }
      }
    }
    return null;
  }

  function findPayment(lines) {
    for (var i = 0; i < lines.length; i++) {
      var low = lines[i].toLowerCase();
      for (var w = 0; w < PAYMENT_WORDS.length; w++) {
        if (low.indexOf(PAYMENT_WORDS[w][0].toLowerCase()) !== -1) {
          return PAYMENT_WORDS[w][1];
        }
      }
    }
    return null;
  }

  function findChange(lines) {
    for (var i = 0; i < lines.length; i++) {
      var low = lines[i].toLowerCase();
      if (low.indexOf("找續") !== -1 || low.indexOf("找零") !== -1 ||
          low.indexOf("change") !== -1) {
        var a = amountsIn(lines[i]);
        if (a.length) { return a[a.length - 1]; }
      }
    }
    return null;
  }

  var DATE_LIKE = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})|(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})|(\d{4}年\s*\d{1,2}月\s*\d{1,2}[日號])/i;

  function findMerchant(lines) {
    var i, k;
    // Known chains first (first 6 lines only — the header).
    var head = Math.min(6, lines.length);
    for (i = 0; i < head; i++) {
      var up = lines[i].toUpperCase();
      var low = lines[i].toLowerCase();
      for (k = 0; k < KNOWN_MERCHANTS.length; k++) {
        var key = KNOWN_MERCHANTS[k][0];
        var hay = /[A-Z]/.test(key.charAt(0)) ? up : low;
        var needle = /[A-Z]/.test(key.charAt(0)) ? key : key.toLowerCase();
        if (hay.indexOf(needle) !== -1) { return KNOWN_MERCHANTS[k][1]; }
      }
    }
    for (i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (IGNORE_LINES.test(l)) continue;
      if (DATE_LIKE.test(l)) continue;
      if (/\d/.test(l) && amountsIn(l).length) continue; // price line
      if (l.length < 2 || l.length > 40) continue;
      return l;
    }
    return null;
  }

  // Lines that are never items: totals, subtotals, payment, change, thanks.
  var NON_ITEM_WORDS = ["total", "合共", "總數", "總計", "應付", "應收",
    "amount due", "balance due", "grand total", "net total",
    "實付", "總額", "合計", "收費",
    "小計", "subtotal", "折扣", "discount", "稅", "tax",
    "找續", "找零", "change", "現金", "cash", "八達通", "octopus",
    "visa", "mastercard", "master", "fps", "轉數快", "信用卡",
    "付款", "payment", "餘額", "balance", "多謝", "thank", "歡迎",
    "welcome", "小費", "tip", "服務費", "service charge"];
  var AMOUNT_ONLY = /^(?:HK\$|\$)?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:HKD|HKS|HK\$)?\s*$/i;

  function isNonItem(line) {
    var low = line.toLowerCase();
    for (var w = 0; w < NON_ITEM_WORDS.length; w++) {
      if (low.indexOf(NON_ITEM_WORDS[w].toLowerCase()) !== -1) { return true; }
    }
    if (IGNORE_LINES.test(line)) { return true; }
    if (DATE_LIKE.test(line)) { return true; }
    return false;
  }

  // Extract item lines: name + amount at the end of the line, HK style,
  // e.g. "維他奶 250ml $8.50", "白米 5kg $72.80", "Fresh Milk 1L $32.50".
  // Also handles "維他奶 x2 $8.50" (quantity x unit price) and split lines
  // where the amount sits on the next line. Accepts an array of lines
  // (from parseReceipt) or a raw text string. Lines without a trailing
  // amount are ignored; total / subtotal / payment lines are never items.
  function parseLineItems(lines) {
    var ls = lines;
    if (typeof ls === "string") ls = cleanLines(ls);
    if (!ls || !ls.length) return [];
    var out = [];
    for (var i = 0; i < ls.length; i++) {
      var line = String(ls[i]).replace(/\s+/g, " ").trim();
      if (!line || isNonItem(line)) continue;
      // Does this line already end in an amount? Only pair with the next
      // line when it does not — otherwise a following amount-only line
      // (e.g. a subtotal printed on its own line) would steal the item.
      var hasTrailing = /(?:HK\$|\$)?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:HKD|HKS|HK\$)?\s*$/.test(line) &&
        /[\d$]/.test(line.slice(-8));
      // Split-line format: name on this line, amount alone on the next.
      if (!hasTrailing && i + 1 < ls.length) {
        var next = String(ls[i + 1]).replace(/\s+/g, " ").trim();
        if (AMOUNT_ONLY.test(next) && !/^\d{4}$/.test(next.replace(/[^0-9]/g, ""))) {
          var na = amountsIn(next);
          if (na.length && line.length >= 2 && !/^\d+$/.test(line)) {
            out.push({ name: line, amount: na[na.length - 1] });
            i++;
            continue;
          }
        }
      }
      // Quantity form: "維他奶 x2 $8.50" or "維他奶 2x $8.50"
      var qm = line.match(/^(.*?)\s*(?:[xX×]\s*(\d+)|(\d+)\s*[xX×])\s*(?:HK\$|\$)?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?\s*(?:HKD|HKS|HK\$)?\s*$/);
      if (qm) {
        var qty = parseInt(qm[2] || qm[3], 10);
        var unit = parseFloat(qm[4].replace(/,/g, "") + "." + (qm[5] || "00"));
        var qname = qm[1].replace(/[\s\-–—:：]+$/, "").trim();
        if (qname.length >= 2 && qty > 0) {
          out.push({ name: qname + " x" + qty, amount: Math.round(unit * qty * 100) / 100 });
          continue;
        }
      }
      // Amount must sit at the end of the line: "$8.50", "8.50",
      // "$1,234.56", or an integer "$38" / "38 HKD".
      var m = line.match(/(?:HK\$|\$)?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?\s*(?:HKD|HKS|HK\$)?\s*$/);
      if (!m) continue;
      var amount = parseFloat(m[1].replace(/,/g, "") + "." + (m[2] || "00"));
      var name = line.slice(0, m.index).replace(/\$+$/, "").replace(/[\s\-–—:：]+$/, "").trim();
      if (name.length < 2) continue;
      if (/^\d+$/.test(name)) continue;
      // A bare trailing integer with no $ and no HKD is only an amount if
      // the line had a $ earlier or the amount looks like a price; guard
      // against "單號 12345"-style lines that slipped past IGNORE_LINES.
      if (!m[2] && line.indexOf("$") === -1 && !/HKD|HKS|HK\$/i.test(line)) {
        continue;
      }
      out.push({ name: name, amount: amount });
    }
    return out;
  }

  function guessCategory(merchant, items) {
    var hay = ((merchant || "") + " " + ((items || []).map(function (it) { return it.name; }).join(" "))).toLowerCase();
    for (var i = 0; i < CATEGORY_RULES.length; i++) {
      var keys = CATEGORY_RULES[i][1];
      for (var k = 0; k < keys.length; k++) {
        if (hay.indexOf(keys[k].toLowerCase()) !== -1) { return CATEGORY_RULES[i][0]; }
      }
    }
    return "其他";
  }

  /* Sum of item amounts (null amounts ignored), rounded to cents. Used
     by the page to warn when the items do not add up to the total. */
  function sumItems(items) {
    var s = 0;
    (items || []).forEach(function (it) {
      if (it && typeof it.amount === "number" && !isNaN(it.amount)) { s += it.amount; }
    });
    return Math.round(s * 100) / 100;
  }

  function parseReceipt(text) {
    var lines = cleanLines(text);
    if (!lines.length) {
      return { merchant: null, date: null, total: null, subtotal: null,
               currency: "HKD", payment: null, change: null,
               category: "其他", lines: [], confidence: 0 };
    }
    var date = findDate(lines);
    var total = findTotal(lines);
    var merchant = findMerchant(lines);
    var items = parseLineItems(lines);
    var hits = (merchant ? 1 : 0) + (date ? 1 : 0) + (total !== null ? 1 : 0);
    return { merchant: merchant, date: date, total: total,
             subtotal: findSubtotal(lines),
             currency: "HKD", payment: findPayment(lines),
             change: findChange(lines),
             category: guessCategory(merchant, items),
             lines: lines, confidence: hits / 3 };
  }

  /* ---- records: duplicate check + undo (pure, no DOM) ----
   * The page keeps records in localStorage. These helpers are pure so
   * they can be tested under node; the page uses them for the
   * "did I already save this?" warning and the undo-delete button.
   *
   * A record is a duplicate of an existing one only when merchant, date
   * AND total all match. A missing date or total never counts as a match
   * — two hand-entered records with no date are not the same receipt.
   * Amounts compare within one cent (OCR / rounding noise). */
  function sameText(a, b) {
    return String(a || "").trim().toLowerCase() ===
      String(b || "").trim().toLowerCase();
  }
  function isDuplicateRecord(records, rec) {
    if (!rec || !records || !records.length) { return false; }
    if (!rec.date || rec.total === null || rec.total === undefined ||
        isNaN(rec.total)) { return false; }
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (!r || !r.date || r.total === null || r.total === undefined ||
          isNaN(r.total)) { continue; }
      if (sameText(r.merchant, rec.merchant) && r.date === rec.date &&
          Math.abs(r.total - rec.total) < 0.01) { return true; }
    }
    return false;
  }

  /* Deep copy of a records array (records + their item lines), so an
   * undo snapshot is not affected by later edits. */
  function snapshotRecords(records) {
    return (records || []).map(function (r) {
      var copy = {};
      var k;
      for (k in r) {
        if (k === "items" && r.items) {
          copy.items = r.items.map(function (it) {
            return { name: it.name, amount: it.amount };
          });
        } else {
          copy[k] = r[k];
        }
      }
      return copy;
    });
  }

  /* Undo stack: an array of snapshots, newest last, capped at 20 so it
   * cannot grow without bound. Push BEFORE a destructive change
   * (delete one record, clear all); pop to restore. The stack lives in
   * memory only — closing the page loses it, which the page says. */
  var UNDO_MAX = 20;
  function pushUndo(stack, records) {
    var s = (stack || []).slice();
    s.push(snapshotRecords(records));
    while (s.length > UNDO_MAX) { s.shift(); }
    return s;
  }
  function popUndo(stack) {
    if (!stack || !stack.length) { return null; }
    var s = stack.slice();
    var records = s.pop();
    return { stack: s, records: records };
  }

  var api = { parseReceipt: parseReceipt, parseLineItems: parseLineItems,
              sumItems: sumItems,
              guessCategory: guessCategory,
              findDate: findDate,
              findTotal: findTotal, findSubtotal: findSubtotal,
              findMerchant: findMerchant, findPayment: findPayment,
              findChange: findChange,
              amountsIn: amountsIn,
              isDuplicateRecord: isDuplicateRecord,
              snapshotRecords: snapshotRecords,
              pushUndo: pushUndo, popUndo: popUndo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.HKReceiptParser = api;
})(typeof window !== "undefined" ? window : this);
