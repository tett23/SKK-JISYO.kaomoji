import { assertEquals } from "@std/assert";
import {
  buildEntries,
  candidateEucJp,
  candidateUtf8,
  encodeEucJp,
  isEucJpEncodable,
  mergeKaomoji,
  normalizeReading,
  parseCategorized,
  parseEmoticon,
  parseExtra,
  parseSourcesLock,
  renderEucJp,
  renderUtf8,
} from "../scripts/lib.ts";

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).toUpperCase().padStart(2, "0")).join("");

Deno.test("parseEmoticon: skips the header and keeps the row order", () => {
  const tsv = "\tkeys (space separated)\tcategories (space separated)\n" +
    "(^^)\tにこにこ にこ\tSMILE\n" +
    "(=^･^=)\tにこ にこにこ\t\n" +
    "(T_T)\tなく\n";
  assertEquals(parseEmoticon(tsv), [
    { kaomoji: "(^^)", readings: ["にこにこ", "にこ"] },
    { kaomoji: "(=^･^=)", readings: ["にこ", "にこにこ"] },
    { kaomoji: "(T_T)", readings: ["なく"] },
  ]);
});

Deno.test("parseCategorized: skips the comment header; readings are the third column", () => {
  const tsv = "# value\tcategory\tdescription\n(__)\tSADNESS\tぺこり ごめん\n\n";
  assertEquals(parseCategorized(tsv), [{ kaomoji: "(__)", readings: ["ぺこり", "ごめん"] }]);
});

Deno.test("parseExtra: skips comments and blank lines", () => {
  const tsv = "# kaomoji\treadings\n\n(^^ゞ\tてれ あせ\n";
  assertEquals(parseExtra(tsv), [{ kaomoji: "(^^ゞ", readings: ["てれ", "あせ"] }]);
});

Deno.test("normalizeReading", () => {
  assertEquals(normalizeReading("ハート"), "はーと");
  assertEquals(normalizeReading("やだね～"), "やだねー");
  assertEquals(normalizeReading("やだね〜"), "やだねー");
  assertEquals(normalizeReading("どうしましょう・・"), "どうしましょう");
  assertEquals(normalizeReading("ｱｾ"), "あせ");
  assertEquals(normalizeReading("abc"), undefined);
  assertEquals(normalizeReading("11:30"), undefined);
  assertEquals(normalizeReading(""), undefined);
});

Deno.test("mergeKaomoji: first position wins, readings are unioned in order", () => {
  assertEquals(
    mergeKaomoji([
      { kaomoji: "A", readings: ["あ", "い"] },
      { kaomoji: "B", readings: ["う"] },
      { kaomoji: "A", readings: ["い", "え"] },
    ]),
    [{ kaomoji: "A", readings: ["あ", "い", "え"] }, { kaomoji: "B", readings: ["う"] }],
  );
});

Deno.test("buildEntries: extra, then emoticon order, then categorized-only; invalid readings warn", () => {
  const { entries, warnings, kaomojiCount } = buildEntries({
    extra: [{ kaomoji: "X", readings: ["にこ"] }],
    emoticon: [{ kaomoji: "A", readings: ["にこ", "abc"] }, { kaomoji: "B", readings: ["にこ"] }],
    categorized: [{ kaomoji: "C", readings: ["にこ"] }, { kaomoji: "A", readings: ["わーい"] }],
  });
  assertEquals(entries.get("にこ"), ["X", "A", "B", "C"]);
  assertEquals(entries.get("わーい"), ["A"]);
  assertEquals(entries.has("abc"), false);
  assertEquals(kaomojiCount, 4);
  assertEquals(warnings, ['invalid reading "abc": A']);
});

Deno.test("candidateUtf8", () => {
  assertEquals(candidateUtf8("(^^)/"), '(concat "(^^)\\057")');
  assertEquals(candidateUtf8("^^;"), '(concat "^^\\073")');
  assertEquals(candidateUtf8("¯\\_(ツ)_/¯"), '(concat "¯\\\\_(ツ)_\\057¯")');
  assertEquals(candidateUtf8('(^"^)/'), '(concat "(^\\"^)\\057")');
  assertEquals(candidateUtf8("(^^)"), '(concat "(^^)")');
  assertEquals(candidateUtf8("(-)"), '(concat "(-)")');
  assertEquals(candidateUtf8("(´・ω・`)"), "(´・ω・`)");
  assertEquals(candidateUtf8("^_^"), "^_^");
  assertEquals(candidateUtf8("・ω・ ・ω・"), "・ω・ ・ω・");
});

Deno.test("EUC-JP encoder", () => {
  assertEquals(hex(encodeEucJp("あ")), "A4A2");
  assertEquals(hex(encodeEucJp("ー")), "A1BC");
  assertEquals(hex(encodeEucJp("ﾟ")), "8EDF");
  assertEquals(hex(encodeEucJp("Д")), "A7A5");
  assertEquals(hex(encodeEucJp("ω")), "A6D8");
  assertEquals(hex(encodeEucJp("a(")), "6128");
  assertEquals(isEucJpEncodable("•"), false);
  assertEquals(isEucJpEncodable("①"), false);
  assertEquals(isEucJpEncodable("(´・ω・`)"), true);
});

Deno.test("candidateEucJp", () => {
  assertEquals(candidateEucJp("•ω•♡"), '(concat "\\u2022ω\\u2022\\u2661")');
  assertEquals(candidateEucJp("(´・ω・`)"), "(´・ω・`)");
  assertEquals(candidateEucJp("(^^)/"), '(concat "(^^)\\057")');
  assertEquals(candidateEucJp("(•ω•)"), '(concat "(\\u2022ω\\u2022)")');
});

const meta = { version: "0.1.0", mozcCommit: "0123456789abcdef0123456789abcdef01234567" };
const entries = new Map([["にこ", ["(^^)", "^_^"]], ["ぴーす", ["(^^)v"]], ["てれ", ["•ω•"]]]);

Deno.test("renderUtf8", () => {
  const text = new TextDecoder().decode(renderUtf8(meta, entries, 3));
  assertEquals(text.startsWith(";; -*- mode: fundamental; coding: utf-8 -*-\n"), true);
  assertEquals(text.includes(";; Version: 0.1.0\n"), true);
  assertEquals(text.includes(meta.mozcCommit), true);
  assertEquals(text.includes(";; Copyright 2010-2018, Google Inc.\n"), true);
  // UTF-8 byte order: ぴ(E381B4) < て(E381A6)? no: て < に < ぴ
  assertEquals(
    text.split(";; okuri-ari entries.\n;; okuri-nasi entries.\n")[1],
    'てれ /•ω•/\nにこ /(concat "(^^)")/^_^/\nぴーす /(^^)v/\n',
  );
});

Deno.test("renderEucJp: sorted by EUC-JP bytes (ー sorts before hiragana)", () => {
  const e = new Map([["あー", ["A"]], ["ああ", ["B"]], ["てれ", ["•ω•"]]]);
  const bytes = renderEucJp(meta, e, 3);
  const text = new TextDecoder("euc-jp").decode(bytes);
  assertEquals(text.startsWith(";; -*- mode: fundamental; coding: euc-jp -*-\n"), true);
  assertEquals(
    text.split(";; okuri-ari entries.\n;; okuri-nasi entries.\n")[1],
    'あー /A/\nああ /B/\nてれ /(concat "\\u2022ω\\u2022")/\n',
  );
  const u = new TextDecoder().decode(renderUtf8(meta, e, 3));
  assertEquals(u.split(";; okuri-nasi entries.\n")[1], "ああ /B/\nあー /A/\nてれ /•ω•/\n");
});

Deno.test("parseSourcesLock", () => {
  const lock = `# comment
mozc_commit = 0123456789abcdef0123456789abcdef01234567
src/data/emoticon/emoticon.tsv = ${"a".repeat(64)}
src/data/emoticon/categorized.tsv = ${"b".repeat(64)}
`;
  assertEquals(parseSourcesLock(lock), {
    mozcCommit: "0123456789abcdef0123456789abcdef01234567",
    files: new Map([
      ["src/data/emoticon/emoticon.tsv", "a".repeat(64)],
      ["src/data/emoticon/categorized.tsv", "b".repeat(64)],
    ]),
  });
});
