import { assertEquals } from "@std/assert";
import { classify, commitLine, isVersionBump, notes } from "../scripts/release_notes.ts";

const ctx = { repo: "o/r", tag: "v1.0.0", adrFiles: ["docs/adr/0001-x.md"] };

Deno.test("classify by the first word", () => {
  assertEquals(classify("Add foo"), "Added");
  assertEquals(classify("add foo"), "Added");
  assertEquals(classify("Introduce foo"), "Added");
  assertEquals(classify("Remove foo"), "Removed");
  assertEquals(classify("Drop foo"), "Removed");
  assertEquals(classify("Fix foo"), "Fixed");
  assertEquals(classify("Bump foo"), "Changed");
});

Deno.test("version bump subjects", () => {
  assertEquals(isVersionBump("v0.1.0"), true);
  assertEquals(isVersionBump("v0.1.0-rc1"), true);
  assertEquals(isVersionBump("v2 support"), false);
});

Deno.test("commit, PR and ADR links", () => {
  const sha = "abcdef1234567890abcdef1234567890abcdef12";
  assertEquals(
    commitLine({ sha, subject: "Add foo (#12) per ADR 0001 and ADR 0099" }, ctx),
    "- Add foo ([#12](https://github.com/o/r/pull/12)) per " +
      "[ADR 0001](https://github.com/o/r/blob/v1.0.0/docs/adr/0001-x.md) and ADR 0099 " +
      `([abcdef1](https://github.com/o/r/commit/${sha}))`,
  );
});

Deno.test("notes with a previous release", () => {
  const text = notes({
    ...ctx,
    prevTag: "v0.1.0",
    commits: [{ sha: "a".repeat(40), subject: "Add foo" }, { sha: "b".repeat(40), subject: "v1.0.0" }],
    readings: 10,
    kaomoji: 20,
  });
  assertEquals(
    text.startsWith("## v1.0.0\n\nChanges since [v0.1.0](https://github.com/o/r/releases/tag/v0.1.0).\n"),
    true,
  );
  assertEquals(text.includes("### Added\n"), true);
  assertEquals(text.includes("### Fixed"), false);
  assertEquals(text.includes("v1.0.0 ("), false);
  assertEquals(text.includes("### Dictionary\n"), true);
  assertEquals(text.includes("### Files\n"), true);
});

Deno.test("notes for the first release", () => {
  const text = notes({ ...ctx, commits: [], readings: 1, kaomoji: 1 });
  assertEquals(text.includes("\nFirst release.\n"), true);
});
