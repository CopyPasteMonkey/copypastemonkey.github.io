# Eli Doggart — portfolio and editor

[Website](https://www.elidoggart.com/) · [Editor](https://www.elidoggart.com/editor/) · [Editor guide](docs/EDITOR.md)

Custom website and editor code generated and assembled using OpenAI tools.

The public site is generated from `content/portfolio.json`. Edit content through the website editor; use reviewed pull requests for code changes.

## Work locally

Use Node.js 22 and Python 3 (the migration comparison uses Python).

```sh
npm ci --ignore-scripts
npm run build
npm run dev
```

Open `http://127.0.0.1:4173/editor/`. This local preview saves drafts locally; publication is enabled only on the production origin.

## Verify changes

```sh
npm test
npm run validate
npm run build
npx playwright install chromium webkit
npm run test:browser
TEST_BROWSER=webkit npm run test:browser
```

Run browser engines sequentially. Tests start their own read-only fixture server on port 4175. Their fixed portfolio is built into `.local/browser-dist/`, separate from the actual `dist/` deployment. Renaming your real headings or removing an entry must not break tests that exercise the editor with example content. Actual content and assets are still validated on every change.

## Repository map

- `content/`: actual portfolio content and schema.
- `editor/`, `lib/`: editor UI, validation and shared rendering.
- `scripts/`, `build/`: build, local preview, imports and dependency bundling.
- `auth/`: authentication helper source and integration documentation.
- `tests/`: regression scenarios and deliberately frozen example content.
- `.github/workflows/`: required validation and Pages deployment.
- `docs/`: current guides, audit evidence and historical reviews.

Generated builds, installed dependencies, downloads and test results are ignored by Git. `README.txt` remains the published attribution file; [asset credits](README.txt) and font/license notices must be retained.

## Change and release process

1. Make a focused branch and describe the problem, resulting behavior and checks in its pull request.
2. Add a regression test for a demonstrated bug. Comments should explain non-obvious decisions or constraints.
3. Wait for required `validate` checks. Merge through a PR; do not force-push `main` or bypass checks.
4. Confirm Pages deployment and the exact revision in `/build.json` before saying a change is live.
5. A merged topic branch can be removed after confirming it has no newer commits or open draft. Keep active editor draft branches.

Undo a released change with a reviewed revert commit through the same checks. Keep dependencies and Actions pinned, and review upgrades explicitly. See the [reliability audit](docs/editor-reliability-audit.md) and [GitHub maintenance review](docs/github-maintenance-review.md).
