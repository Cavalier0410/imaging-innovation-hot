import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { preparePages } from "../scripts/prepare-pages.mjs";

test("maps the product library to index and the Hot report to hot.html", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "imaging-pages-"));
  const dataDir = path.join(root, "data");
  const outputDir = path.join(root, "_site");
  await mkdir(dataDir);
  await writeFile(path.join(dataDir, "innovation-product-library.html"), "<title>Library</title>");
  await writeFile(path.join(dataDir, "imaging-hot-report.html"), "<title>Hot</title>");

  await preparePages({ dataDir, outputDir });

  assert.equal(await readFile(path.join(outputDir, "index.html"), "utf8"), "<title>Library</title>");
  assert.equal(await readFile(path.join(outputDir, "hot.html"), "utf8"), "<title>Hot</title>");
  assert.equal(await readFile(path.join(outputDir, "imaging-hot-report.html"), "utf8"), "<title>Hot</title>");
  assert.equal(await readFile(path.join(outputDir, ".nojekyll"), "utf8"), "");
});

test("removes stale files before preparing the next artifact", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "imaging-pages-"));
  const dataDir = path.join(root, "data");
  const outputDir = path.join(root, "_site");
  await mkdir(dataDir);
  await mkdir(outputDir);
  await writeFile(path.join(dataDir, "innovation-product-library.html"), "library");
  await writeFile(path.join(dataDir, "imaging-hot-report.html"), "hot");
  await writeFile(path.join(outputDir, "stale.html"), "stale");

  await preparePages({ dataDir, outputDir });

  await assert.rejects(readFile(path.join(outputDir, "stale.html"), "utf8"), { code: "ENOENT" });
});
