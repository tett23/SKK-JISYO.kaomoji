/**
 * Deno の EUC-JP の対応表を .cache/check/euc-jp-table.tsv に書く（ADR 0002）。
 * 列はタブ区切りの「EUC-JP のバイト列（16 進数）」「Deno が当てる文字の符号位置（16 進数）」
 * 「Emacs と対応表が違う 7 文字なら differs、そうでなければ空」。
 * scripts/check_ddskk.el が、この表を Emacs の対応表と比べる。
 */
import { compareBytes, EMACS_MISMATCH, eucJpTable } from "./lib.ts";

export const EUC_TABLE = ".cache/check/euc-jp-table.tsv";

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

export const eucTableTsv = () =>
  eucJpTable()
    .sort(([a], [b]) => compareBytes(a, b))
    .map(([bytes, c]) =>
      `${hex(bytes)}\t${c.codePointAt(0)!.toString(16).padStart(4, "0")}\t${EMACS_MISMATCH.has(c) ? "differs" : ""}\n`
    )
    .join("");

if (import.meta.main) {
  await Deno.mkdir(".cache/check", { recursive: true });
  await Deno.writeTextFile(EUC_TABLE, eucTableTsv());
  console.error(`-> ${EUC_TABLE}`);
}
