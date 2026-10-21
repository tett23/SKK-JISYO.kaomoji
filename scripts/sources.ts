/**
 * sources.lock で固定した、取り込むデータを読み込む（ADR 0004）。
 * 事前に deno task fetch で .cache/ に取得しておく。
 */
import {
  type Credit,
  MOZC_NOTICE,
  parseCategorized,
  parseEmoticon,
  parseEmoticonSource,
  parseExtra,
  parseKaomojiData,
  parseSourcesLock,
  type Source,
  type SourceName,
  SOURCES,
  type SourcesLock,
} from "./lib.ts";
import { cachePath } from "./fetch_sources.ts";

const MOZC_EMOTICON = "src/data/emoticon/emoticon.tsv";
const MOZC_CATEGORIZED = "src/data/emoticon/categorized.tsv";

export async function loadSources(
  lockText?: string,
): Promise<{ lock: SourcesLock; sources: Source[]; credits: Credit[] }> {
  const lock = parseSourcesLock(lockText ?? await Deno.readTextFile("sources.lock"));
  const commit = (name: SourceName) => {
    const c = lock.commits[name];
    if (!c) throw new Error(`${name}_commit is not in sources.lock`);
    return c;
  };
  const read = (name: SourceName, path: string) => Deno.readTextFile(cachePath(name, commit(name), path));
  const sources: Source[] = [
    { name: "extra", own: true, kaomoji: parseExtra(await Deno.readTextFile("data/extra.tsv")) },
    { name: "mozc", own: false, kaomoji: parseEmoticon(await read("mozc", MOZC_EMOTICON)) },
    { name: "mozc", own: false, kaomoji: parseCategorized(await read("mozc", MOZC_CATEGORIZED)) },
    { name: "kaomoji_data", own: false, kaomoji: parseKaomojiData(await read("kaomoji_data", "kaomoji.json")) },
    { name: "emoticon", own: false, kaomoji: parseEmoticonSource(await read("emoticon", "source.txt")) },
  ];
  const credits: Credit[] = [
    {
      repo: SOURCES.mozc,
      files: "src/data/emoticon/emoticon.tsv and categorized.tsv",
      commit: commit("mozc"),
      license: MOZC_NOTICE,
    },
    {
      repo: SOURCES.kaomoji_data,
      files: "kaomoji.json",
      commit: commit("kaomoji_data"),
      license: await read("kaomoji_data", "LICENSE"),
    },
    {
      repo: SOURCES.emoticon,
      files: "source.txt",
      commit: commit("emoticon"),
      license: await read("emoticon", "LICENSE.md"),
    },
  ];
  return { lock, sources, credits };
}
