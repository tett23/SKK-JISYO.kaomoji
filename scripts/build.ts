/**
 * dist/ に辞書とライセンスファイルを作る（ADR 0001）。
 *
 *   deno task build [--strict]
 *
 * --strict を付けると、警告（捨てた読み）があれば失敗する。
 */
import {
  buildEntries,
  EUC_JP_FILE,
  MOZC_NOTICE,
  parseCategorized,
  parseEmoticon,
  parseExtra,
  parseSourcesLock,
  renderEucJp,
  renderUtf8,
  UTF8_FILE,
} from "./lib.ts";
import { cachePath } from "./fetch_sources.ts";

const OUT = "dist";
const EMOTICON = "src/data/emoticon/emoticon.tsv";
const CATEGORIZED = "src/data/emoticon/categorized.tsv";

if (import.meta.main) {
  const strict = Deno.args.includes("--strict");
  const lock = parseSourcesLock(await Deno.readTextFile("sources.lock"));
  const meta = { version: (await Deno.readTextFile("VERSION")).trim(), mozcCommit: lock.mozcCommit };
  const { entries, warnings, kaomojiCount } = buildEntries({
    extra: parseExtra(await Deno.readTextFile("data/extra.tsv")),
    emoticon: parseEmoticon(await Deno.readTextFile(cachePath(lock.mozcCommit, EMOTICON))),
    categorized: parseCategorized(await Deno.readTextFile(cachePath(lock.mozcCommit, CATEGORIZED))),
  });
  for (const w of warnings) console.error(`warning: ${w}`);

  await Deno.mkdir(OUT, { recursive: true });
  await Deno.writeFile(`${OUT}/${EUC_JP_FILE}`, renderEucJp(meta, entries, kaomojiCount));
  await Deno.writeFile(`${OUT}/${UTF8_FILE}`, renderUtf8(meta, entries, kaomojiCount));
  await Deno.copyFile("LICENSE", `${OUT}/LICENSE`);
  await Deno.writeTextFile(
    `${OUT}/LICENSE-Mozc.txt`,
    `The kaomoji and readings in ${EUC_JP_FILE} and ${UTF8_FILE} are taken from
Mozc (https://github.com/google/mozc), src/data/emoticon/emoticon.tsv and categorized.tsv
at commit ${lock.mozcCommit},
which is distributed under the following license (BSD 3-Clause License).

${MOZC_NOTICE}
`,
  );
  console.error(`${kaomojiCount} kaomoji, ${entries.size} readings -> ${OUT}/{${EUC_JP_FILE},${UTF8_FILE}}`);
  if (strict && warnings.length > 0) {
    console.error(`${warnings.length} warning(s) in strict mode`);
    Deno.exit(1);
  }
}
