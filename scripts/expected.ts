/**
 * DDSKK による検査の正解のデータを .cache/check/expected.tsv に書く（ADR 0002）。
 * 列はタブ区切りの「見出し語」「候補 1」「候補 2」…。候補は (concat "...") にする前の顔文字そのもの。
 */
import { buildEntries, compareBytes, type Entries } from "./lib.ts";
import { loadSources } from "./sources.ts";

export const EXPECTED = ".cache/check/expected.tsv";

export function expectedTsv(entries: Entries): string {
  const enc = new TextEncoder();
  const bad = [...entries].flatMap(([r, cs]) => [r, ...cs]).find((s) => /[\t\n]/.test(s));
  if (bad !== undefined) throw new Error(`a tab or a newline in ${JSON.stringify(bad)}`);
  return [...entries.keys()]
    .sort((a, b) => compareBytes(enc.encode(a), enc.encode(b)))
    .map((r) => [r, ...entries.get(r)!].join("\t") + "\n")
    .join("");
}

if (import.meta.main) {
  const { entries } = buildEntries((await loadSources()).sources);
  await Deno.mkdir(".cache/check", { recursive: true });
  await Deno.writeTextFile(EXPECTED, expectedTsv(entries));
  console.error(`${entries.size} readings -> ${EXPECTED}`);
}
