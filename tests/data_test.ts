import { assert, assertEquals } from "@std/assert";
import { buildEntries, normalizeReading, parseExtra, parseSourcesLock } from "../scripts/lib.ts";
import { loadSources } from "../scripts/sources.ts";
import { CHECKLIST_KAOMOJI, CHECKLIST_READINGS } from "./checklist.ts";

Deno.test("data/extra.tsv readings are valid", async () => {
  const extra = parseExtra(await Deno.readTextFile("data/extra.tsv"));
  for (const { kaomoji, readings } of extra) {
    assert(readings.length > 0, `no readings: ${kaomoji}`);
    for (const r of readings) assertEquals(normalizeReading(r), r, `invalid reading ${r}: ${kaomoji}`);
  }
});

Deno.test("sources.lock pins every source and file (ADR 0004)", async () => {
  const lock = parseSourcesLock(await Deno.readTextFile("sources.lock"));
  for (const name of ["mozc", "kaomoji_data", "emoticon", "ddskk"]) {
    assert(/^[0-9a-f]{40}$/.test(lock.commits[name] ?? ""), `${name}_commit`);
  }
  assertEquals(lock.files.length, 6);
  for (const f of lock.files) assert(/^[0-9a-f]{64}$/.test(f.sha256), `${f.source}:${f.path}`);
});

Deno.test("the merged dictionary contains every kaomoji and reading in the ADR 0002 checklist", async () => {
  const { entries } = buildEntries((await loadSources()).sources);
  const kaomoji = new Set([...entries.values()].flat());
  for (const k of CHECKLIST_KAOMOJI) assert(kaomoji.has(k), `missing kaomoji ${k}`);
  for (const r of CHECKLIST_READINGS) assert(entries.has(r), `missing reading ${r}`);
});
