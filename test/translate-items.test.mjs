import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("../scripts/translate-items.mjs", import.meta.url));
const failingFetchUrl = new URL("../test-support/failing-fetch.mjs", import.meta.url);

test("keeps source text without caching it when free translation is unavailable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "imaging-translation-"));
  const dataDir = path.join(root, "data");
  await mkdir(dataDir);
  await writeFile(
    path.join(dataDir, "items.selected.json"),
    JSON.stringify({ generatedAt: null, items: [{ title: "Camera title", summary: "" }] })
  );
  await writeFile(path.join(dataDir, "hot-topics.json"), JSON.stringify({ generatedAt: null, items: [] }));
  await writeFile(path.join(dataDir, "translation-cache.json"), "{}");

  const result = spawnSync(process.execPath, ["--import", failingFetchUrl.href, scriptPath], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, TRANSLATE_CONCURRENCY: "1" }
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /keeping source text/i);
  const translated = JSON.parse(await readFile(path.join(dataDir, "items.selected.zh.json"), "utf8"));
  assert.equal(translated.items[0].titleZh, "Camera title");
  assert.deepEqual(JSON.parse(await readFile(path.join(dataDir, "translation-cache.json"), "utf8")), {});
});
