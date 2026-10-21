/**
 * sources.lock に固定したファイルを .cache/<名前>/<コミット>/<パス> に取得する（ADR 0001、ADR 0004）。
 * 取得済みで SHA-256 が合えば取り直さない。合わなければ失敗する。
 */
import { parseSourcesLock, SOURCES } from "./lib.ts";

export const CACHE = ".cache";

export const cachePath = (source: string, commit: string, path: string) => `${CACHE}/${source}/${commit}/${path}`;

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function readIfExists(path: string): Promise<Uint8Array | undefined> {
  try {
    return await Deno.readFile(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return undefined;
    throw e;
  }
}

if (import.meta.main) {
  const lock = parseSourcesLock(await Deno.readTextFile("sources.lock"));
  for (const { source, path, sha256: hash } of lock.files) {
    const commit = lock.commits[source];
    if (!commit) throw new Error(`${source}_commit is not in sources.lock`);
    const local = cachePath(source, commit, path);
    const cached = await readIfExists(local);
    if (cached && await sha256(cached) === hash) continue;
    const url = `https://raw.githubusercontent.com/${SOURCES[source]}/${commit}/${path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const actual = await sha256(bytes);
    if (actual !== hash) throw new Error(`${url}: SHA-256 mismatch (expected ${hash}, got ${actual})`);
    await Deno.mkdir(local.slice(0, local.lastIndexOf("/")), { recursive: true });
    await Deno.writeFile(local, bytes);
    console.error(`fetched ${url}`);
  }
}
