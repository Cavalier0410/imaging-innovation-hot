# Hourly GitHub Pages Deployment Design

## Goal

Publish the existing imaging innovation reports at `https://camera.lts4ai.com` and refresh them automatically once per hour without operating a separate server.

## Confirmed decisions

- Hosting: GitHub Pages.
- Scheduler: GitHub Actions, hourly at minute 17 to avoid the busiest top-of-hour window.
- Manual recovery: allow `workflow_dispatch` runs from the Actions tab.
- Primary page: `data/innovation-product-library.html` becomes the deployed `index.html`.
- Secondary page: `data/imaging-hot-report.html` is deployed as `hot.html`.
- Custom domain: `camera.lts4ai.com`.
- DNS: `camera.lts4ai.com CNAME Cavalier0410.github.io` is managed outside this repository.
- Runtime: Node.js 20 with `npm ci` and the existing `npm run use` pipeline.
- Server requirement: none; GitHub Actions builds the files and GitHub Pages serves them.

## Architecture and data flow

One GitHub Actions workflow owns both generation and publication:

1. Run every hour, on manual request, and when deployment files change on `main`.
2. Check out `main` and install the locked dependencies with Node.js 20.
3. Expose optional translation secrets to the existing scripts without printing their values.
4. Run `npm run use`, which fetches RSS feeds, deduplicates and clusters items, translates content, and regenerates both HTML reports.
5. Assemble a clean `_site` directory containing only public assets:
   - `_site/index.html` from the innovation product library.
   - `_site/hot.html` from the Hot report.
   - `_site/.nojekyll` so GitHub Pages serves the files unchanged.
6. Upload `_site` as a Pages artifact and deploy it through the `github-pages` environment.

Generated working JSON, translation caches, and repository contents are not exposed as website files. Hourly output is deployed as an artifact rather than committed back to `main`, avoiding one automated commit per hour.

## Permissions and secrets

The workflow uses the minimum Pages permissions:

- `contents: read`
- `pages: write`
- `id-token: write`

The concurrency group allows only one Pages deployment at a time and cancels an older in-progress run when a newer run starts.

The workflow may read these optional repository secrets already supported by the project:

- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `SILICONFLOW_API_KEY`
- `DASHSCOPE_API_KEY`

If none is configured, the current translation fallback remains in effect.

## Failure handling

- Individual RSS failures keep the existing behavior: report source warnings and continue when usable items were fetched.
- A generation, validation, artifact upload, or deployment failure stops the workflow and leaves the previously deployed site online.
- A manual run provides the recovery path after transient feed or platform failures.
- The workflow does not commit generated files, so a failed run cannot corrupt repository history.

## Verification

Before publishing the change:

1. Run the existing full pipeline locally and confirm `verify:dedupe` succeeds.
2. Validate the workflow YAML structure and required triggers, permissions, Pages actions, and file mappings.
3. Assemble `_site` locally and verify `index.html`, `hot.html`, and `.nojekyll` exist and both HTML files contain valid document titles.
4. After merging to `main`, manually run the workflow once and confirm the Pages deployment succeeds.
5. Resolve `camera.lts4ai.com` and confirm it points to `Cavalier0410.github.io`.
6. Confirm the custom domain loads both `/` and `/hot.html` over HTTPS.

## Out of scope

- A backend, database, user accounts, or cross-device favorite synchronization.
- Committing hourly generated reports back into the repository.
- Redesigning the two generated pages.
- Managing the DNS provider account from the workflow.
