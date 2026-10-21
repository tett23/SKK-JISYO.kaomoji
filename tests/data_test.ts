import { assert, assertEquals } from "@std/assert";
import { normalizeReading, parseExtra, parseSourcesLock } from "../scripts/lib.ts";

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
  for (const h of lock.files.values()) assert(/^[0-9a-f]{64}$/.test(h));
});
