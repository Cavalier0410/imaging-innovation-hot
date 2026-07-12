# Hourly GitHub Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish the existing imaging reports to `camera.lts4ai.com` every hour through GitHub Actions and GitHub Pages.

**Architecture:** A small Node.js preparation script copies only the two public HTML reports into a clean `_site` artifact. A single GitHub Actions workflow runs the existing content pipeline, prepares the artifact, and deploys it to Pages without committing hourly output back to the repository.

**Tech Stack:** Node.js 20, Node built-in test runner, GitHub Actions, GitHub Pages

---

## File structure

- `scripts/prepare-pages.mjs`: deterministic creation of the public `_site` artifact.
- `test/prepare-pages.test.mjs`: behavior tests for file mapping and clean rebuilds.
- `test/pages-workflow.test.mjs`: contract test for the scheduled Pages workflow.
- `.github/workflows/pages.yml`: hourly generation and deployment orchestration.
- `package.json`: test and artifact-preparation commands.
- `README.md`: published URLs, schedule, manual recovery, and secret configuration.

### Task 1: Prepare a clean Pages artifact

**Files:**
- Create: `test/prepare-pages.test.mjs`
- Create: `scripts/prepare-pages.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing artifact tests**

```js
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
```

- [ ] **Step 2: Run the tests and confirm the missing module failure**

Run: `node --test test/prepare-pages.test.mjs`

Expected: FAIL because `scripts/prepare-pages.mjs` does not exist.

- [ ] **Step 3: Implement the artifact preparation script**

```js
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function preparePages({ dataDir, outputDir }) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await copyFile(path.join(dataDir, "innovation-product-library.html"), path.join(outputDir, "index.html"));
  await copyFile(path.join(dataDir, "imaging-hot-report.html"), path.join(outputDir, "hot.html"));
  await writeFile(path.join(outputDir, ".nojekyll"), "");
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const root = process.cwd();
  await preparePages({
    dataDir: path.join(root, "data"),
    outputDir: path.join(root, "_site")
  });
  console.log("Prepared GitHub Pages artifact in _site/.");
}
```

Add these scripts to `package.json`:

```json
"pages:prepare": "node scripts/prepare-pages.mjs",
"test": "node --test"
```

Add the generated Pages artifact to `.gitignore`:

```gitignore
_site/
```

- [ ] **Step 4: Run the tests and artifact command**

Run: `npm test && npm run pages:prepare`

Expected: 2 tests pass and `_site/index.html`, `_site/hot.html`, and `_site/.nojekyll` exist.

- [ ] **Step 5: Commit Task 1**

```bash
git add .gitignore package.json scripts/prepare-pages.mjs test/prepare-pages.test.mjs
git commit -m "feat: prepare GitHub Pages artifact"
```

### Task 2: Add the hourly GitHub Pages workflow

**Files:**
- Create: `test/pages-workflow.test.mjs`
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Write the failing workflow contract test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../.github/workflows/pages.yml", import.meta.url);

test("workflow schedules hourly content generation and Pages deployment", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /cron: ["']17 \* \* \* \*["']/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run use/);
  assert.match(workflow, /npm run pages:prepare/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
});
```

- [ ] **Step 2: Run the full test suite and confirm the missing workflow failure**

Run: `npm test`

Expected: the preparation tests pass and the workflow test fails with `ENOENT` for `.github/workflows/pages.yml`.

- [ ] **Step 3: Add the Pages workflow**

```yaml
name: Refresh and deploy Pages

on:
  schedule:
    - cron: "17 * * * *"
  workflow_dispatch:
  push:
    branches:
      - main
    paths:
      - ".github/workflows/pages.yml"
      - "package.json"
      - "package-lock.json"
      - "scripts/**"
      - "sources/**"

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: github-pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Check out repository
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Refresh reports
        run: npm run use
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          SILICONFLOW_API_KEY: ${{ secrets.SILICONFLOW_API_KEY }}
          DASHSCOPE_API_KEY: ${{ secrets.DASHSCOPE_API_KEY }}
      - name: Prepare Pages artifact
        run: npm run pages:prepare
      - name: Configure Pages
        uses: actions/configure-pages@v5
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - name: Deploy Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Run workflow and artifact tests**

Run: `npm test && npm run pages:prepare`

Expected: 3 tests pass and the public artifact is rebuilt successfully.

- [ ] **Step 5: Commit Task 2**

```bash
git add .github/workflows/pages.yml test/pages-workflow.test.mjs
git commit -m "ci: refresh and deploy Pages hourly"
```

### Task 2.5: Keep publication running when free translation is unreachable

**Files:**
- Create: `test-support/failing-fetch.mjs`
- Create: `test/translate-items.test.mjs`
- Modify: `scripts/translate-items.mjs`

- [ ] **Step 1: Add an integration test that injects a failed network request**

The test runs the real translation script against temporary input, requires a successful exit, verifies the original title is retained, and verifies the untranslated source is not persisted in `translation-cache.json`.

Use this fetch fixture:

```js
globalThis.fetch = async () => {
  throw new TypeError("simulated translation network failure");
};
```

Use this integration test:

```js
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
```

- [ ] **Step 2: Run the focused test and confirm the network failure exits nonzero**

Run: `node --test test/translate-items.test.mjs`

Expected: FAIL because the rejected Google request currently escapes `translateText`.

- [ ] **Step 3: Make Google translation fail soft for the current run**

Wrap the Google request in `translateText` with a run-level availability flag. On the first rejection, log a warning, stop further Google requests during that process, return the source value, and do not add that source value to the translation cache.

```js
let googleTranslationAvailable = true;

if (!translated && googleTranslationAvailable) {
  try {
    translated = await translateByGoogle(value);
  } catch (error) {
    googleTranslationAvailable = false;
    console.warn(`Google translation failed, keeping source text for this run: ${error.message}`);
  }
}

if (translated) {
  cache[key] = translated;
  return translated;
}

return value;
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test test/translate-items.test.mjs && npm test`

Expected: the focused test passes and the full suite reports four passing tests.

- [ ] **Step 5: Commit the reliability fix**

```bash
git add scripts/translate-items.mjs test-support/failing-fetch.mjs test/translate-items.test.mjs docs/superpowers/specs/2026-07-12-hourly-pages-deployment-design.md docs/superpowers/plans/2026-07-12-hourly-pages-deployment.md
git commit -m "fix: keep updates running when translation is unavailable"
```

### Task 3: Document operation and run final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add deployment documentation**

Add a `## 在线部署` section documenting:

```markdown
## 在线部署

站点通过 GitHub Actions 每小时更新并发布到 GitHub Pages：

- 产品库首页：`https://camera.lts4ai.com/`
- Hot 报告：`https://camera.lts4ai.com/hot.html`
- 自动更新：每小时第 17 分钟执行
- 手动更新：在仓库 Actions 页面运行 `Refresh and deploy Pages`

工作流执行现有的 `npm run use`，再将两个 HTML 页面打包为 Pages artifact；生成结果不会每小时提交回仓库。

翻译密钥可配置为 GitHub Actions repository secrets：`OPENAI_API_KEY`、`DEEPSEEK_API_KEY`、`SILICONFLOW_API_KEY` 或 `DASHSCOPE_API_KEY`。未配置时继续使用项目现有的免费翻译回退。
```

- [ ] **Step 2: Run fresh verification**

Run: `npm test && npm run use && npm run pages:prepare && git diff --check`

Expected: all tests pass, the content pipeline and dedupe verification succeed, the Pages artifact contains the expected files, and Git reports no whitespace errors.

- [ ] **Step 3: Inspect the final scope**

Run: `git status --short && git diff --stat && git diff`

Expected: only `README.md` remains uncommitted after the two task commits, and its diff matches the approved deployment design.

- [ ] **Step 4: Commit Task 3**

```bash
git add README.md
git commit -m "docs: explain hourly Pages operation"
```

- [ ] **Step 5: Push and publish the branch**

Run: `git push -u origin codex/pages-hourly-deploy`

Expected: the branch is available on GitHub for integration into `main`.
