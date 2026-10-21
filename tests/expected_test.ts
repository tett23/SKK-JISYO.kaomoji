import { assertEquals, assertThrows } from "@std/assert";
import { expectedTsv } from "../scripts/expected.ts";

Deno.test("expected.tsv: one line per reading, raw kaomoji separated by tabs", () => {
  assertEquals(expectedTsv(new Map([["にこ", ["(^^)", "^_^"]]])), "にこ\t(^^)\t^_^\n");
});

Deno.test("expected.tsv: readings are sorted by UTF-8 bytes", () => {
  const tsv = expectedTsv(new Map([["あー", ["A"]], ["ああ", ["B"]], ["い", ["C"]]]));
  assertEquals(tsv, "ああ\tB\nあー\tA\nい\tC\n");
});

Deno.test("expected.tsv: kaomoji with a tab or a newline are rejected", () => {
  assertThrows(() => expectedTsv(new Map([["にこ", ["a\tb"]]])));
  assertThrows(() => expectedTsv(new Map([["にこ", ["a\nb"]]])));
});
