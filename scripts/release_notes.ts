/**
 * リリースノートを作る（ADR 0001）。
 *
 *   deno task notes --tag <tag> --repo <owner/repo> --commits <file> --dict <UTF-8 版の辞書> [--prev-tag <tag>]
 *
 * --commits のファイルは 1 行 1 コミットで `<SHA>\t<件名>`（git log --no-merges --format='%H%x09%s'）。
 */
import { parseArgs } from "@std/cli/parse-args";

export type Commit = { sha: string; subject: string };
export type Section = "Added" | "Changed" | "Removed" | "Fixed";
type Ctx = { repo: string; tag: string; adrFiles: string[] };

const SECTIONS: Section[] = ["Added", "Changed", "Removed", "Fixed"];
const FIRST_WORD: Record<string, Section> = {
  add: "Added",
  introduce: "Added",
  create: "Added",
  support: "Added",
  remove: "Removed",
  delete: "Removed",
  drop: "Removed",
  fix: "Fixed",
  correct: "Fixed",
};

export const classify = (subject: string): Section =>
  FIRST_WORD[subject.trim().split(/\s+/)[0]?.toLowerCase() ?? ""] ?? "Changed";

/** 件名が版番号だけか（v0.1.0、v0.1.0-rc1 など） */
export const isVersionBump = (subject: string) => /^v\d+(\.\d+)*(-[0-9A-Za-z.]+)?$/.test(subject.trim());

export const parseCommits = (text: string): Commit[] =>
  text.split("\n").filter(Boolean).map((line) => {
    const tab = line.indexOf("\t");
    return { sha: line.slice(0, tab), subject: line.slice(tab + 1) };
  });

/** 件名の (#123) と ADR NNNN を絶対リンクにする */
export const linkSubject = (subject: string, { repo, tag, adrFiles }: Ctx) =>
  subject
    .replace(/\(#(\d+)\)/g, (_, n) => `([#${n}](https://github.com/${repo}/pull/${n}))`)
    .replace(/ADR (\d{4})/g, (m, n) => {
      const file = adrFiles.find((f) => f.split("/").at(-1)!.startsWith(`${n}-`));
      return file ? `[${m}](https://github.com/${repo}/blob/${tag}/${file})` : m;
    });

export const commitLine = (c: Commit, ctx: Ctx) =>
  `- ${linkSubject(c.subject, ctx)} ([${c.sha.slice(0, 7)}](https://github.com/${ctx.repo}/commit/${c.sha}))`;

export function notes(args: Ctx & { prevTag?: string; commits: Commit[]; readings: number; kaomoji: number }): string {
  const { repo, tag, prevTag, commits } = args;
  const bySection = Map.groupBy(commits.filter((c) => !isVersionBump(c.subject)), (c) => classify(c.subject));
  return [
    `## ${tag}`,
    "",
    prevTag ? `Changes since [${prevTag}](https://github.com/${repo}/releases/tag/${prevTag}).` : "First release.",
    "",
    ...SECTIONS.flatMap((s) => {
      const cs = bySection.get(s) ?? [];
      return cs.length ? [`### ${s}`, "", ...cs.map((c) => commitLine(c, args)), ""] : [];
    }),
    "### Dictionary",
    "",
    `- ${args.kaomoji} kaomoji, ${args.readings} readings`,
    "",
    "### Files",
    "",
    "| File | Description |",
    "|---|---|",
    '| `SKK-JISYO.kaomoji` | EUC-JP. Kaomoji outside JIS X 0208 are Emacs Lisp `(concat "\\uXXXX")` forms (DDSKK only) |',
    "| `SKK-JISYO.kaomoji.utf8` | UTF-8 (AquaSKK, macSKK, libskk, skkeleton, ...). Use the EUC-JP version with DDSKK |",
    "| `LICENSE` | License of this dictionary (MIT License) |",
    "| `LICENSE-Mozc.txt` | License of the kaomoji and readings taken from Mozc (BSD 3-Clause License) |",
    "| `LICENSE-kaomoji-data.txt` | License of the kaomoji and readings taken from kaomojikan/kaomoji-data (MIT License) |",
    "| `LICENSE-emoticon.txt` | License of the kaomoji and readings taken from tiwanari/emoticon (MIT License) |",
    "| `SHA256SUMS` | SHA-256 checksums |",
    "",
  ].join("\n");
}

/** UTF-8 版の辞書の見出し語の数と、ヘッダーに書いた顔文字の数 */
export function countDict(text: string) {
  const kaomoji = Number(text.match(/^;; (\d+) kaomoji,/m)?.[1] ?? 0);
  const readings = text.split("\n").filter((l) => l && !l.startsWith(";")).length;
  return { kaomoji, readings };
}

if (import.meta.main) {
  const a = parseArgs(Deno.args, { string: ["tag", "repo", "commits", "dict", "prev-tag"] });
  if (!a.tag || !a.repo || !a.commits || !a.dict) throw new Error("--tag, --repo, --commits and --dict are required");
  const adrFiles = [...Deno.readDirSync("docs/adr")].map((e) => `docs/adr/${e.name}`).sort();
  console.log(notes({
    repo: a.repo,
    tag: a.tag,
    prevTag: a["prev-tag"] || undefined,
    adrFiles,
    commits: parseCommits(Deno.readTextFileSync(a.commits)),
    ...countDict(Deno.readTextFileSync(a.dict)),
  }));
}
