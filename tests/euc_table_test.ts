import { assertEquals } from "@std/assert";
import { eucTableTsv } from "../scripts/euc_table.ts";

const rows = eucTableTsv().split("\n").filter(Boolean);

Deno.test("euc-jp-table.tsv: row format", () => {
  assertEquals(rows.includes("a4a2\t3042\t"), true);
  assertEquals(rows.includes("a1c1\tff5e\tdiffers"), true);
  assertEquals(rows.includes("8edf\tff9f\t"), true);
});

Deno.test("euc-jp-table.tsv: exactly seven rows differ from Emacs", () => {
  assertEquals(rows.filter((r) => r.endsWith("\tdiffers")).length, 7);
});

Deno.test("euc-jp-table.tsv: 6,879 JIS X 0208 rows and 63 JIS X 0201 kana rows", () => {
  assertEquals(rows.filter((r) => r.startsWith("8e")).length, 63);
  assertEquals(rows.length, 6942);
});
