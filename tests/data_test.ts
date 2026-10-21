import { assert, assertEquals } from "@std/assert";
import {
  buildEntries,
  normalizeReading,
  parseCategorized,
  parseEmoticon,
  parseExtra,
  parseSourcesLock,
} from "../scripts/lib.ts";
import { cachePath } from "../scripts/fetch_sources.ts";
import { CHECKLIST_KAOMOJI, CHECKLIST_READINGS } from "./checklist.ts";

Deno.test("data/extra.tsv readings are valid", async () => {
  const extra = parseExtra(await Deno.readTextFile("data/extra.tsv"));
  for (const { kaomoji, readings } of extra) {
    assert(readings.length > 0, `no readings: ${kaomoji}`);
    for (const r of readings) assertEquals(normalizeReading(r), r, `invalid reading ${r}: ${kaomoji}`);
  }
});

Deno.test("sources.lock pins the Mozc commit and file hashes", async () => {
  const lock = parseSourcesLock(await Deno.readTextFile("sources.lock"));
  assert(/^[0-9a-f]{40}$/.test(lock.mozcCommit));
  assertEquals(lock.files.size, 2);
  assert(/^[0-9a-f]{40}$/.test(lock.ddskkCommit), "ddskk_commit");
  for (const h of lock.files.values()) assert(/^[0-9a-f]{64}$/.test(h));
});

Deno.test("the real dictionary contains every kaomoji and reading in the ADR 0002 checklist", async () => {
  const lock = parseSourcesLock(await Deno.readTextFile("sources.lock"));
  const { entries } = buildEntries({
    extra: parseExtra(await Deno.readTextFile("data/extra.tsv")),
    emoticon: parseEmoticon(await Deno.readTextFile(cachePath(lock.mozcCommit, "src/data/emoticon/emoticon.tsv"))),
    categorized: parseCategorized(
      await Deno.readTextFile(cachePath(lock.mozcCommit, "src/data/emoticon/categorized.tsv")),
    ),
  });
  const kaomoji = new Set([...entries.values()].flat());
  for (const k of CHECKLIST_KAOMOJI) assert(kaomoji.has(k), `missing kaomoji ${k}`);
  for (const r of CHECKLIST_READINGS) assert(entries.has(r), `missing reading ${r}`);
});
