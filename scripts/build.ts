/**
 * dist/ に辞書とライセンスファイルを作る（ADR 0001、ADR 0004）。
 *
 *   deno task build [--strict]
 *
 * 捨てた読みは警告として標準エラーに出す。--strict を付けると、data/extra.tsv（このリポジトリで書くデータ）の
 * 警告があれば失敗する。外部のデータの警告では失敗しない。
 */
import { buildEntries, type Credit, EUC_JP_FILE, MOZC_NOTICE, renderEucJp, renderUtf8, UTF8_FILE } from "./lib.ts";
import { loadSources } from "./sources.ts";

const OUT = "dist";

const preamble = (credit: Credit, license: string) =>
  `The kaomoji and readings in ${EUC_JP_FILE} and ${UTF8_FILE} include data taken from
https://github.com/${credit.repo}, ${credit.files}
at commit ${credit.commit},
which is distributed under the following license (${license}).

`;

if (import.meta.main) {
  const strict = Deno.args.includes("--strict");
  const { sources, credits } = await loadSources();
  const meta = { version: (await Deno.readTextFile("VERSION")).trim(), credits };
  const { entries, warnings, strictFailures, kaomojiCount } = buildEntries(sources);
  for (const w of warnings) console.error(`warning: ${w}`);

  const [mozc, kaomojiData, emoticon] = credits as [Credit, Credit, Credit];
  await Deno.mkdir(OUT, { recursive: true });
  await Deno.writeFile(`${OUT}/${EUC_JP_FILE}`, renderEucJp(meta, entries, kaomojiCount));
  await Deno.writeFile(`${OUT}/${UTF8_FILE}`, renderUtf8(meta, entries, kaomojiCount));
  await Deno.copyFile("LICENSE", `${OUT}/LICENSE`);
  await Deno.writeTextFile(`${OUT}/LICENSE-Mozc.txt`, preamble(mozc, "BSD 3-Clause License") + MOZC_NOTICE + "\n");
  await Deno.writeTextFile(
    `${OUT}/LICENSE-kaomoji-data.txt`,
    preamble(kaomojiData, "MIT License") + kaomojiData.license,
  );
  await Deno.writeTextFile(`${OUT}/LICENSE-emoticon.txt`, preamble(emoticon, "MIT License") + emoticon.license);
  console.error(`${kaomojiCount} kaomoji, ${entries.size} readings -> ${OUT}/{${EUC_JP_FILE},${UTF8_FILE}}`);
  if (strict && strictFailures.length > 0) {
    console.error(`${strictFailures.length} warning(s) in data/extra.tsv in strict mode`);
    Deno.exit(1);
  }
}
