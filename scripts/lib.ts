/**
 * 顔文字の SKK 辞書を作るための純粋な関数（ADR 0001、ADR 0004、ADR 0005）。
 * ファイルやネットワークの入出力は scripts/*.ts の import.meta.main の中だけで行う。
 */

export type Kaomoji = { kaomoji: string; readings: string[] };
/** 取り込むデータの名前とリポジトリ（ADR 0004）。 */
export const SOURCES = {
  mozc: "google/mozc",
  kaomoji_data: "kaomojikan/kaomoji-data",
  emoticon: "tiwanari/emoticon",
} as const;
export type SourceName = keyof typeof SOURCES;
const isSourceName = (s: string): s is SourceName => Object.hasOwn(SOURCES, s);

/** 辞書のヘッダーに書く、取り込んだデータの出典とライセンス。 */
export type Credit = { repo: string; files: string; commit: string; license: string };
export type Meta = { version: string; credits: Credit[] };

export type LockedFile = { source: SourceName; path: string; sha256: string };
/** commits は `<名前>_commit` の値（取り込むデータと ddskk）。files は `<名前>:<パス> = SHA-256`。 */
export type SourcesLock = { commits: Record<string, string>; files: LockedFile[] };

/** 候補の並びの順に並べた、取り込むデータ。own はこのリポジトリで書くデータ（--strict の対象）。 */
export type Source = { name: string; own: boolean; kaomoji: Kaomoji[] };

// ---------------------------------------------------------------- 入力の解析

const rows = (tsv: string) =>
  tsv.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "" && !l.startsWith("#"));

const splitReadings = (s: string | undefined) => (s ?? "").split(/\s+/).filter(Boolean);

/** Mozc の emoticon.tsv。列は 顔文字、読み、分類。1 行目は見出し（先頭がタブ）。 */
export const parseEmoticon = (tsv: string): Kaomoji[] =>
  rows(tsv).slice(1).map((l) => l.split("\t")).filter(([k]) => k)
    .map(([kaomoji, readings]) => ({ kaomoji: kaomoji!, readings: splitReadings(readings) }));

/** Mozc の categorized.tsv。列は 顔文字、分類、読み。見出しは `#` で始まる。 */
export const parseCategorized = (tsv: string): Kaomoji[] =>
  rows(tsv).map((l) => l.split("\t")).filter(([k]) => k)
    .map(([kaomoji, , readings]) => ({ kaomoji: kaomoji!, readings: splitReadings(readings) }));

/** data/extra.tsv。列は 顔文字、読み。 */
export const parseExtra = (tsv: string): Kaomoji[] =>
  rows(tsv).map((l) => l.split("\t")).filter(([k]) => k)
    .map(([kaomoji, readings]) => ({ kaomoji: kaomoji!, readings: splitReadings(readings) }));

/** kaomoji-data の kaomoji.json。text と reading を使い、改行かタブを含む text（複数行の AA）は捨てる。 */
export const parseKaomojiData = (json: string): Kaomoji[] =>
  (JSON.parse(json) as { text: string; reading?: string[] }[])
    .filter(({ text }) => !/[\n\t]/.test(text))
    .map(({ text, reading }) => ({ kaomoji: text, readings: reading ?? [] }));

/** tiwanari/emoticon の source.txt。列は `@読み`、顔文字、品詞。 */
export const parseEmoticonSource = (tsv: string): Kaomoji[] =>
  rows(tsv).map((l) => l.split("\t")).filter(([, k]) => k)
    .map(([reading, kaomoji]) => ({ kaomoji: kaomoji!, readings: [reading!.replace(/^@/, "")] }));

/** `key = value` の行。`<名前>_commit` はコミット、`<名前>:<パス>` はファイルの SHA-256。 */
export function parseSourcesLock(text: string): SourcesLock {
  const pairs = rows(text).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as const;
  });
  const commits = Object.fromEntries(
    pairs.filter(([k]) => k.endsWith("_commit")).map(([k, v]) => {
      const name = k.slice(0, -"_commit".length);
      if (!isSourceName(name) && name !== "ddskk") throw new Error(`unknown source in sources.lock: ${k}`);
      return [name, v];
    }),
  );
  const files = pairs.filter(([k]) => !k.endsWith("_commit")).map(([k, sha256]) => {
    const i = k.indexOf(":");
    const source = k.slice(0, i);
    if (i < 0 || !isSourceName(source)) throw new Error(`unknown source in sources.lock: ${k}`);
    return { source, path: k.slice(i + 1), sha256 };
  });
  return { commits, files };
}

// ---------------------------------------------------------------- 読み

const katakanaToHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** Mozc の読みを SKK の見出し語にする。ひらがなと「ー」だけにならなければ undefined。 */
export function normalizeReading(reading: string): string | undefined {
  const r = katakanaToHiragana(reading.normalize("NFKC")).replace(/[～〜~]/g, "ー").replace(/・/g, "");
  return /^[ぁ-ゖー]+$/.test(r) ? r : undefined;
}

// ---------------------------------------------------------------- 候補の集め方

/** 同じ顔文字を最初の位置にまとめ、読みは現れた順の和集合にする。 */
export function mergeKaomoji(list: Kaomoji[]): Kaomoji[] {
  const merged = list.reduce((m, { kaomoji, readings }) => {
    m.set(kaomoji, [...new Set([...(m.get(kaomoji) ?? []), ...readings])]);
    return m;
  }, new Map<string, string[]>());
  return [...merged].map(([kaomoji, readings]) => ({ kaomoji, readings }));
}

export type Entries = Map<string, string[]>;

/** 辞書の見出し語の規則。読み（ひらがなと「ー」）か、その先頭に半角の `!` を 1 つ付けたもの（ADR 0005）。 */
export const isHeadword = (s: string) => /^!?[ぁ-ゖー]+$/.test(s);

/**
 * すべての見出し語について、先頭に `!` を付けた見出し語を同じ候補で足す（ADR 0005）。
 * `!` を付けて変換すると、ほかの辞書の候補が混ざらず顔文字だけが並ぶ。元の Map は変えない。
 */
export const withBangHeadwords = (entries: Entries): Entries =>
  new Map([...entries, ...[...entries].map(([r, cands]) => [`!${r}`, cands] as const)]);

/**
 * 見出し語 → 候補（並び順どおり）。候補はデータの並びの順（ADR 0004）。
 * 顔文字の前後の空白を取り除いてから併合する。規則に合わない読みは警告にして捨て、
 * own のデータのものだけを strictFailures にも入れる。kaomojiCount は辞書に入った顔文字の数。
 */
export function buildEntries(sources: Source[]) {
  const warnings: string[] = [];
  const strictFailures: string[] = [];
  const normalized = sources.flatMap(({ name, own, kaomoji: list }) =>
    list.map(({ kaomoji, readings }) => {
      const k = kaomoji.replace(/^\s+|\s+$/g, "");
      const valid = readings.flatMap((raw) => {
        const r = normalizeReading(raw);
        if (r) return [r];
        const w = `invalid reading ${JSON.stringify(raw)} (${name}): ${k}`;
        warnings.push(w);
        if (own) strictFailures.push(w);
        return [];
      });
      return { kaomoji: k, readings: valid };
    })
  );
  const entries: Entries = new Map();
  for (const { kaomoji, readings } of mergeKaomoji(normalized.filter(({ kaomoji }) => kaomoji !== ""))) {
    for (const r of readings) {
      const cands = entries.get(r) ?? [];
      if (!cands.includes(kaomoji)) entries.set(r, [...cands, kaomoji]);
    }
  }
  return { entries, warnings, strictFailures, kaomojiCount: new Set([...entries.values()].flat()).size };
}

// ---------------------------------------------------------------- EUC-JP

let table: Map<string, Uint8Array> | undefined;

// JIS X 0208 の 1〜8 区と 16〜84 区。NEC 特殊文字（13 区）や IBM 拡張（89 区以降）は除く。
const isStandardJis0208Lead = (b: number) => (b >= 0xa1 && b <= 0xa8) || (b >= 0xb0 && b <= 0xf4);

function buildTable(): Map<string, Uint8Array> {
  const decoder = new TextDecoder("euc-jp", { fatal: true });
  const t = new Map<string, Uint8Array>();
  const add = (bytes: number[]) => {
    try {
      const s = decoder.decode(new Uint8Array(bytes));
      if ([...s].length === 1 && !t.has(s)) t.set(s, new Uint8Array(bytes));
    } catch {
      // 未定義の符号位置
    }
  };
  for (let a = 0xa1; a <= 0xfe; a++) {
    if (isStandardJis0208Lead(a)) { for (let b = 0xa1; b <= 0xfe; b++) add([a, b]); }
  }
  for (let b = 0xa1; b <= 0xdf; b++) add([0x8e, b]); // JIS X 0201 のカナ
  return t;
}

/** EUC-JP の対応表の全符号位置（バイト列と文字）。JIS X 0208 の標準の区と JIS X 0201 のカナ。 */
export function eucJpTable(): [Uint8Array, string][] {
  table ??= buildTable();
  return [...table].map(([c, bytes]) => [bytes, c]);
}

/**
 * Deno（WHATWG）と Emacs とで、同じ EUC-JP のバイト列に違う文字を当てる 7 文字（ADR 0002）。
 * EUC-JP 版では、これらを EUC-JP で表せない文字と同じに扱い、\uXXXX で書く。
 */
export const EMACS_MISMATCH: ReadonlySet<string> = new Set([
  "\u2015", // ― 水平線（Emacs は — U+2014）
  "\uFF5E", // ～ 全角チルダ（Emacs は 〜 U+301C）
  "\u2225", // ∥ 平行記号（Emacs は ‖ U+2016）
  "\uFF0D", // － 全角ハイフンマイナス（Emacs は − U+2212）
  "\uFFE0", // ￠ 全角セント記号（Emacs は ¢ U+00A2）
  "\uFFE1", // ￡ 全角ポンド記号（Emacs は £ U+00A3）
  "\uFFE2", // ￢ 全角否定記号（Emacs は ¬ U+00AC）
]);

function charBytes(c: string): Uint8Array | undefined {
  const cp = c.codePointAt(0)!;
  if (cp < 0x80) return new Uint8Array([cp]);
  table ??= buildTable();
  return table.get(c);
}

export const isEucJpEncodable = (s: string) => [...s].every((c) => charBytes(c) !== undefined);

/** EUC-JP に符号化する。表せない文字は "?" にする（呼び出し側で先に isEucJpEncodable を確かめる）。 */
export function encodeEucJp(s: string): Uint8Array {
  const chunks = [...s].map((c) => charBytes(c) ?? new Uint8Array([0x3f]));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  chunks.reduce((offset, c) => (out.set(c, offset), offset + c.length), 0);
  return out;
}

export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}

// ---------------------------------------------------------------- 候補の書き方

/** DDSKK の skk-lisp-prog-p が Lisp の式とみなしうる形（`(` + ASCII の文字で始まり `)` で終わる）。 */
const looksLikeLisp = (s: string) => s.length > 2 && s[0] === "(" && s.charCodeAt(1) < 0x80 && s.endsWith(")");

/** SKK の辞書の区切り（`/` と `;`）を含むか。含めば、どの版でも `(concat "...")` の形にする。 */
const hasSeparator = (s: string) => /[/;]/.test(s);

/** EUC-JP 版（DDSKK 用）で `(concat "...")` の形にするか。区切りを含むか、DDSKK が式とみなしうる形（ADR 0001）。 */
const needsConcatForDdskk = (s: string) => hasSeparator(s) || looksLikeLisp(s);

/** libskk が `(` で始まる候補として評価する関数（`libskk/expr.vala`）。この名前で始まる顔文字は別の文字列に化ける。 */
const LIBSKK_FUNCTION = /^\((concat|current-time-string|pwd|skk-version)[\s)]/;

/** Emacs Lisp の文字列リテラルの中身。escapeChar が文字を返せばそれを使う。 */
const lispString = (s: string, escapeChar: (c: string) => string | undefined = () => undefined) =>
  [...s].map((c) => {
    switch (c) {
      case "/":
        return "\\057";
      case ";":
        return "\\073";
      case '"':
        return '\\"';
      case "\\":
        return "\\\\";
      default:
        return escapeChar(c) ?? c;
    }
  }).join("");

const concat = (s: string) => `(concat "${lispString(s)}")`;

/**
 * UTF-8 版の候補（ADR 0006）。区切りを含むときだけ `(concat "...")` の形にし、DDSKK のためだけには包まない。
 * libskk が評価する関数の名前で始まる顔文字は、別の文字列に化けるので受け付けない。
 */
export function candidateUtf8(s: string): string {
  if (LIBSKK_FUNCTION.test(s)) throw new Error(`libskk would evaluate this kaomoji: ${s}`);
  return hasSeparator(s) ? concat(s) : s;
}

const uEscape = (c: string) => `\\u${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
const lispCharEscape = (c: string) => {
  const cp = c.codePointAt(0)!;
  return cp > 0xffff ? `\\U${cp.toString(16).toUpperCase().padStart(8, "0")}` : uEscape(c);
};

/** EUC-JP 版でそのまま書ける文字か。Emacs と対応表が違う 7 文字は書けないものとして扱う（ADR 0002）。 */
const isEucJpSafe = (c: string) => isEucJpEncodable(c) && !EMACS_MISMATCH.has(c);

export const candidateEucJp = (s: string) =>
  [...s].every(isEucJpSafe)
    ? (needsConcatForDdskk(s) ? concat(s) : s)
    : `(concat "${lispString(s, (c) => isEucJpSafe(c) ? undefined : lispCharEscape(c))}")`;

// ---------------------------------------------------------------- 辞書の出力

export const MOZC_NOTICE = `Copyright 2010-2018, Google Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above
    copyright notice, this list of conditions and the following disclaimer
    in the documentation and/or other materials provided with the
    distribution.
  * Neither the name of Google Inc. nor the names of its
    contributors may be used to endorse or promote products derived from
    this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

export const EUC_JP_FILE = "SKK-JISYO.kaomoji";
export const UTF8_FILE = "SKK-JISYO.kaomoji.utf8";

const comment = (text: string) => text.split("\n").map((l) => `;; ${l}`.trimEnd()).join("\n");

const creditComment = ({ repo, files, commit, license }: Credit) =>
  `;; Kaomoji and readings are taken from https://github.com/${repo},
;; ${files} at commit
;; ${commit},
;; distributed under the following license:
;;
${comment(license.trimEnd())}
;;
`;

function header(meta: Meta, file: string, coding: string, kaomojiCount: number, readings: number, note: string) {
  return `;; -*- mode: fundamental; coding: ${coding} -*-
;; ${file} --- Japanese kaomoji (emoticon) dictionary for SKK
;;
;; Version: ${meta.version}
;; ${kaomojiCount} kaomoji, ${readings} readings.
;; ${note}
;;
;; Copyright (c) 2026 はちがつうまれ
;; Released under the MIT License. https://github.com/tett23/SKK-JISYO.kaomoji
;;
${meta.credits.map(creditComment).join("")};; okuri-ari entries.
;; okuri-nasi entries.
`;
}

const line = (reading: string, cands: string[], render: (s: string) => string) =>
  `${reading} /${cands.map(render).join("/")}/`;

const sortedBy = (entries: Entries, encode: (s: string) => Uint8Array) =>
  [...entries.keys()].map((r) => ({ r, key: encode(r) })).sort((a, b) => compareBytes(a.key, b.key)).map(({ r }) => r);

export function renderUtf8(meta: Meta, entries: Entries, kaomojiCount: number): Uint8Array {
  const enc = new TextEncoder();
  const body = sortedBy(entries, (s) => enc.encode(s)).map((r) => line(r, entries.get(r)!, candidateUtf8));
  return enc.encode(
    header(meta, UTF8_FILE, "utf-8", kaomojiCount, entries.size, "UTF-8 version.") + body.map((l) => l + "\n").join(""),
  );
}

/**
 * EUC-JP 版のヘッダー（コメント）で、EUC-JP で表せない文字を書きかえる。
 * 著作権表示の © は慣例どおり (c) にし、そのほかは U+XXXX と書く。
 */
export const eucJpComment = (text: string) =>
  [...text].map((c) =>
    c === "\u00A9"
      ? "(c)"
      : isEucJpEncodable(c)
      ? c
      : `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`
  ).join("");

export function renderEucJp(meta: Meta, entries: Entries, kaomojiCount: number): Uint8Array {
  const body = sortedBy(entries, encodeEucJp).map((r) => line(r, entries.get(r)!, candidateEucJp));
  const note = `EUC-JP version: kaomoji with characters outside JIS X 0208, or with characters that Emacs
;; decodes differently (U+2015 U+2225 U+FF0D U+FF5E U+FFE0 U+FFE1 U+FFE2), are (concat "\\uXXXX") forms for DDSKK.`;
  return encodeEucJp(
    eucJpComment(header(meta, EUC_JP_FILE, "euc-jp", kaomojiCount, entries.size, note)) +
      body.map((l) => l + "\n").join(""),
  );
}
