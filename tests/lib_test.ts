import { assertEquals, assertThrows } from "@std/assert";
import {
  buildEntries,
  candidateEucJp,
  candidateUtf8,
  EMACS_MISMATCH,
  encodeEucJp,
  isEucJpEncodable,
  isHeadword,
  mergeKaomoji,
  MOZC_NOTICE,
  normalizeReading,
  parseCategorized,
  parseEmoticon,
  parseEmoticonSource,
  parseExtra,
  parseKaomojiData,
  parseSourcesLock,
  renderEucJp,
  renderUtf8,
  withBangHeadwords,
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

const src = (name: string, own: boolean, kaomoji: { kaomoji: string; readings: string[] }[]) => ({
  name,
  own,
  kaomoji,
});

Deno.test("buildEntries: sources keep their order; same kaomoji merge at the first position", () => {
  const { entries, kaomojiCount } = buildEntries([
    src("extra", true, [{ kaomoji: "X", readings: ["にこ"] }]),
    src("mozc", false, [{ kaomoji: "A", readings: ["にこ"] }, { kaomoji: "B", readings: ["にこ"] }]),
    src("mozc", false, [{ kaomoji: "C", readings: ["にこ"] }, { kaomoji: "A", readings: ["わーい"] }]),
    src("kaomoji_data", false, [{ kaomoji: "D", readings: ["にこ"] }, { kaomoji: "B", readings: ["にこ"] }]),
    src("emoticon", false, [{ kaomoji: "E", readings: ["にこ"] }]),
  ]);
  assertEquals(entries.get("にこ"), ["X", "A", "B", "C", "D", "E"]);
  assertEquals(entries.get("わーい"), ["A"]);
  assertEquals(kaomojiCount, 6);
});

Deno.test("buildEntries: leading and trailing spaces are trimmed before merging (ADR 0004)", () => {
  const { entries } = buildEntries([
    src("emoticon", false, [
      { kaomoji: " (๑•ૅㅁ•๑)ぁ？", readings: ["あ"] },
      { kaomoji: "(๑•ૅㅁ•๑)ぁ？　", readings: ["あれ"] },
      { kaomoji: "m(_ _)m", readings: ["ぺこり"] },
    ]),
  ]);
  assertEquals(entries.get("あ"), ["(๑•ૅㅁ•๑)ぁ？"]);
  assertEquals(entries.get("あれ"), ["(๑•ૅㅁ•๑)ぁ？"]);
  assertEquals(entries.get("ぺこり"), ["m(_ _)m"]);
});

Deno.test("buildEntries: invalid readings warn; only those in our own data fail --strict (ADR 0004)", () => {
  const { entries, warnings, strictFailures, kaomojiCount } = buildEntries([
    src("extra", true, [{ kaomoji: "X", readings: ["にこ", "abc"] }]),
    src("emoticon", false, [{ kaomoji: "Y", readings: ["?"] }, { kaomoji: "Z", readings: ["にこ", "はぁ？"] }]),
  ]);
  assertEquals(entries.get("にこ"), ["X", "Z"]);
  assertEquals(warnings, [
    'invalid reading "abc" (extra): X',
    'invalid reading "?" (emoticon): Y',
    'invalid reading "はぁ？" (emoticon): Z',
  ]);
  assertEquals(strictFailures, ['invalid reading "abc" (extra): X']);
  // Y has no reading left, so it is not in the dictionary and not counted
  assertEquals(kaomojiCount, 2);
});

Deno.test("parseKaomojiData: text and reading; multi-line entries are dropped (ADR 0004)", () => {
  const json = JSON.stringify([
    {
      text: "(◍•ᗜ•◍)",
      slug: "ureshii-0001",
      categories: ["ureshii"],
      tags: ["笑顔"],
      reading: ["うれしい", "にこにこ"],
    },
    { text: " /\\_/\\\n( o.o )", slug: "aa-0001", categories: ["aa"], tags: [], reading: ["ねこ"] },
    { text: "a\tb", slug: "x", categories: [], tags: [], reading: ["たぶ"] },
  ]);
  assertEquals(parseKaomojiData(json), [{ kaomoji: "(◍•ᗜ•◍)", readings: ["うれしい", "にこにこ"] }]);
});

Deno.test("parseEmoticonSource: strips @ from the shortcut (ADR 0004)", () => {
  const tsv = "@ありがとう\t(*ゝω・)ﾉ ｱﾘｶﾞ㌧♪\t顔文字\n\n@?\t（？〜？\t顔文字\n";
  assertEquals(parseEmoticonSource(tsv), [
    { kaomoji: "(*ゝω・)ﾉ ｱﾘｶﾞ㌧♪", readings: ["ありがとう"] },
    { kaomoji: "（？〜？", readings: ["?"] },
  ]);
});

Deno.test("candidateUtf8", () => {
  assertEquals(candidateUtf8("(^^)/"), '(concat "(^^)\\057")');
  assertEquals(candidateUtf8("^^;"), '(concat "^^\\073")');
  assertEquals(candidateUtf8("¯\\_(ツ)_/¯"), '(concat "¯\\\\_(ツ)_\\057¯")');
  assertEquals(candidateUtf8('(^"^)/'), '(concat "(^\\"^)\\057")');
  // ADR 0006: the UTF-8 version does not wrap lisp-like kaomoji only for DDSKK
  assertEquals(candidateUtf8("(^^)"), "(^^)");
  assertEquals(candidateUtf8("(-)"), "(-)");
  assertEquals(candidateUtf8("((+_+))"), "((+_+))");
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
  // the EUC-JP version (for DDSKK) still wraps lisp-like kaomoji (ADR 0001)
  assertEquals(candidateEucJp("(^^)"), '(concat "(^^)")');
  assertEquals(candidateEucJp("(-)"), '(concat "(-)")');
  assertEquals(candidateEucJp("(^^)/"), '(concat "(^^)\\057")');
  assertEquals(candidateEucJp("(•ω•)"), '(concat "(\\u2022ω\\u2022)")');
});

Deno.test("candidateEucJp: characters Deno and Emacs map differently are \\uXXXX (ADR 0002)", () => {
  assertEquals(candidateEucJp("♪～(´ε｀ )"), '(concat "♪\\uFF5E(´ε｀ )")');
  assertEquals(candidateEucJp("(－－〆)"), '(concat "(\\uFF0D\\uFF0D〆)")');
  assertEquals(candidateEucJp("(¯―¯٥)"), '(concat "(\\u00AF\\u2015\\u00AF\\u0665)")');
  assertEquals(candidateEucJp("∥"), '(concat "\\u2225")');
  assertEquals(candidateEucJp("￠"), '(concat "\\uFFE0")');
  assertEquals(candidateEucJp("￡"), '(concat "\\uFFE1")');
  assertEquals(candidateEucJp("￢"), '(concat "\\uFFE2")');
  assertEquals(candidateEucJp("＼(^o^)／"), "＼(^o^)／");
  assertEquals(candidateUtf8("♪～(´ε｀ )"), "♪～(´ε｀ )");
});

Deno.test("EMACS_MISMATCH is exactly the seven characters", () => {
  assertEquals(
    [...EMACS_MISMATCH].map((c) => c.codePointAt(0)!.toString(16).toUpperCase()).sort(),
    ["2015", "2225", "FF0D", "FF5E", "FFE0", "FFE1", "FFE2"],
  );
});

const KD_LICENSE = "MIT License\n\nCopyright (c) 2026 kaomojikan\n\nPermission is hereby granted";
const EM_LICENSE = "The MIT License (MIT)\n=====================\n\nCopyright © `2013` `Tatsuya Iwanari`\n";
const meta = {
  version: "0.1.0",
  credits: [
    {
      repo: "google/mozc",
      files: "src/data/emoticon/emoticon.tsv and categorized.tsv",
      commit: "0123456789abcdef0123456789abcdef01234567",
      license: MOZC_NOTICE,
    },
    { repo: "kaomojikan/kaomoji-data", files: "kaomoji.json", commit: "1".repeat(40), license: KD_LICENSE },
    { repo: "tiwanari/emoticon", files: "source.txt", commit: "2".repeat(40), license: EM_LICENSE },
  ],
};
const entries = new Map([["にこ", ["(^^)", "^_^"]], ["ぴーす", ["(^^)v"]], ["てれ", ["•ω•"]]]);

Deno.test("renderUtf8", () => {
  const text = new TextDecoder().decode(renderUtf8(meta, entries, 3));
  assertEquals(text.startsWith(";; -*- mode: fundamental; coding: utf-8 -*-\n"), true);
  assertEquals(text.includes(";; Version: 0.1.0\n"), true);
  assertEquals(text.includes("0123456789abcdef0123456789abcdef01234567"), true);
  assertEquals(text.includes(";; Copyright 2010-2018, Google Inc.\n"), true);
  // UTF-8 byte order: ぴ(E381B4) < て(E381A6)? no: て < に < ぴ
  assertEquals(
    text.split(";; okuri-ari entries.\n;; okuri-nasi entries.\n")[1],
    "てれ /•ω•/\nにこ /(^^)/^_^/\nぴーす /(^^)v/\n",
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

Deno.test("headers carry every source's commit and license (ADR 0004)", () => {
  const utf8 = new TextDecoder().decode(renderUtf8(meta, entries, 3));
  const euc = new TextDecoder("euc-jp").decode(renderEucJp(meta, entries, 3));
  assertEquals(utf8.includes(";; Copyright © `2013` `Tatsuya Iwanari`\n"), true);
  // © is not in JIS X 0208, so the EUC-JP header writes it as (c)
  assertEquals(euc.includes(";; Copyright (c) `2013` `Tatsuya Iwanari`\n"), true);
  assertEquals(euc.includes("?"), false);
  for (const text of [utf8, euc]) {
    assertEquals(text.includes(";; Copyright (c) 2026 kaomojikan\n"), true);
    assertEquals(text.includes("1".repeat(40)), true);
    assertEquals(text.includes("2".repeat(40)), true);
    assertEquals(text.includes("https://github.com/kaomojikan/kaomoji-data"), true);
    assertEquals(text.includes("https://github.com/tiwanari/emoticon"), true);
  }
});

Deno.test("parseSourcesLock: commits and <name>:<path> hashes (ADR 0004)", () => {
  const lock = `# comment
mozc_commit = ${"0".repeat(40)}
kaomoji_data_commit = ${"1".repeat(40)}
emoticon_commit = ${"2".repeat(40)}
ddskk_commit = ${"3".repeat(40)}
mozc:src/data/emoticon/emoticon.tsv = ${"a".repeat(64)}
kaomoji_data:kaomoji.json = ${"b".repeat(64)}
emoticon:LICENSE.md = ${"c".repeat(64)}
`;
  assertEquals(parseSourcesLock(lock), {
    commits: { mozc: "0".repeat(40), kaomoji_data: "1".repeat(40), emoticon: "2".repeat(40), ddskk: "3".repeat(40) },
    files: [
      { source: "mozc", path: "src/data/emoticon/emoticon.tsv", sha256: "a".repeat(64) },
      { source: "kaomoji_data", path: "kaomoji.json", sha256: "b".repeat(64) },
      { source: "emoticon", path: "LICENSE.md", sha256: "c".repeat(64) },
    ],
  });
  assertThrows(() => parseSourcesLock(`unknown:x = ${"d".repeat(64)}\n`));
  assertThrows(() => parseSourcesLock(`unknown_commit = ${"d".repeat(40)}\n`));
});

Deno.test("withBangHeadwords adds !-prefixed headwords with the same candidates (ADR 0005)", () => {
  const original = new Map([["にこ", ["(^^)", "^_^"]], ["あせ", ["^^;"]]]);
  const withBang = withBangHeadwords(original);
  assertEquals(withBang.get("!にこ"), ["(^^)", "^_^"]);
  assertEquals(withBang.get("!あせ"), ["^^;"]);
  assertEquals(withBang.get("にこ"), ["(^^)", "^_^"]);
  assertEquals(withBang.size, 4);
  // the original map is not modified
  assertEquals([...original.keys()], ["にこ", "あせ"]);
});

Deno.test("!-prefixed headwords sort before hiragana in both versions (ADR 0005)", () => {
  const e = withBangHeadwords(new Map([["にこ", ["A"]], ["あせ", ["B"]]]));
  const body = (text: string) => text.split(";; okuri-nasi entries.\n")[1];
  assertEquals(
    body(new TextDecoder().decode(renderUtf8(meta, e, 2))),
    "!あせ /B/\n!にこ /A/\nあせ /B/\nにこ /A/\n",
  );
  assertEquals(
    body(new TextDecoder("euc-jp").decode(renderEucJp(meta, e, 2))),
    "!あせ /B/\n!にこ /A/\nあせ /B/\nにこ /A/\n",
  );
});

Deno.test("isHeadword accepts !-prefixed headwords; normalizeReading does not (ADR 0005)", () => {
  assertEquals(isHeadword("!にこにこ"), true);
  assertEquals(isHeadword("にこにこ"), true);
  assertEquals(isHeadword("!"), false);
  assertEquals(isHeadword("!!にこ"), false);
  assertEquals(isHeadword("！にこ"), false);
  assertEquals(normalizeReading("!にこにこ"), undefined);
});

Deno.test("the header counts !-prefixed headwords (ADR 0005)", () => {
  const e = withBangHeadwords(new Map([["にこ", ["A"]], ["あせ", ["B"]]]));
  const text = new TextDecoder().decode(renderUtf8(meta, e, 2));
  assertEquals(text.includes(";; 2 kaomoji, 4 readings.\n"), true);
});

Deno.test("candidateUtf8 rejects kaomoji that libskk would evaluate (ADR 0006)", () => {
  for (const k of ["(pwd)", '(concat "x")', "(skk-version)", "(current-time-string)", "(pwd )"]) {
    assertThrows(() => candidateUtf8(k), Error, undefined, k);
  }
  assertEquals(candidateUtf8("(pwdx)"), "(pwdx)");
  assertEquals(candidateUtf8("(concatenate)"), "(concatenate)");
});
