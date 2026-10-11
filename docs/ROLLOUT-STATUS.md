# Approved rollout — 2026-10-11

The owner explicitly approved the full editor publication, original resume favicon, required validation/branch protection, Pages Actions deployment, and one bounded public test draft/media publish followed by a validated revert and cleanup. This supersedes earlier pending-publication notes. The temporary auth-only diagnostic deployment is skipped.

## Preparation

- Fresh remote `main`: `5f4c6e3fcae64040df353a4600546cf0f0f59786` before rollout.
- Local backup branch: `backup/pre-approved-rollout-20261011`; a Git bundle is retained under ignored `.local/backups/`.
- The exact approved favicon commit `861b60ea6d9db65acf7d0bb36ae057dc38505371` is merged. The superseded `3f5fc6c` commit is excluded.
- All four icon asset hashes match the design handoff. The frozen approved HTML body is unchanged; only its head icon links were copied into the controlled renderer and migration fixture. The static build now includes all four approved icon assets.
- Production publishing is enabled only for the existing fixed origin, repository and numeric user. No credential values are stored in the repository.
- The reviewed Pages workflow is activated at `.github/workflows/pages.yml`; the required validation job remains `validate` in `.github/workflows/content-validation.yml`.
- Local content/asset validation, 15 Node tests and the build pass. All 18 browser tests pass, including desktop/mobile parity and authentication recovery. Two clean builds produce identical bytes across all 185 output files.

## Approved settings and acceptance

- Active `main` ruleset: PR required; zero required human approvals; successful `validate` from GitHub Actions; branch up to date; block force pushes/deletion; no bypass entries. Squash merging enabled.
- Pages source changes from `main`/root to GitHub Actions while retaining `www.elidoggart.com`, CNAME and HTTPS. Build has `contents: read`; deploy has only `pages: write` and `id-token: write` and publishes `dist/` through the `github-pages` environment.
- The one public test draft may add one synthetic optimized WebP to the media catalog without placing it in any visible section. Its merge must pass validation. A subsequent validated revert removes the test record and asset; only test branches/diagnostics are cleaned up.
- Final acceptance covers popup sign-in, read/save/reload/publish, deployment feedback, successful cleanup, public sections/links, resume and all approved icon assets. Cancellation/expiry use safe live checks where practical and existing mock tests otherwise.

No deployment success is claimed until the actual run, commit and public URLs are verified below.

## Verified live rollout

- All 60 uploaded files on remote feature commit `22159bc901d3e8b246fc18d6cf37af525284cbf7` were byte-for-byte identical to tested local `b82c241` before merging.
- Rollout PR #1: https://github.com/elidoggart/elidoggart.github.io/pull/1. Required `validate` succeeded on GitHub Actions. Squash merge: `b653a921133400faddceeb56696e5718e39b2b63`.
- First Pages Actions deployment succeeded: https://github.com/elidoggart/elidoggart.github.io/actions/runs/38174963398. The public `build.json` returned that exact revision.
- Active ruleset `24894237` targets only `main`, requires a PR with zero human approvals and `validate` from GitHub Actions with an up-to-date branch, blocks force pushes/deletion, and has an empty bypass list. Squash merging is enabled.
- Pages uses GitHub Actions; the existing custom domain and enforced HTTPS remain enabled.
- Real popup sign-in completed, closed its popup, and connected the editor. No additional grant, credential, or passkey prompt was needed in the existing signed-in browser.
- The only public test draft was PR #2: https://github.com/elidoggart/elidoggart.github.io/pull/2. Its changes were exactly one 560-byte, 32-by-32 optimized WebP and one media record, with no placement in any visible section. The browser reload restored the local draft; a fresh sign-in and Load GitHub draft retrieved the saved remote content and image.
- The editor required validation on exact draft `f3f914a6c0f1`, showed its explicit confirmation, and published merge `bce0f7481f293abb2a66dbace501c354db88f720`. It first reported deployment pending, then successful deployment of that exact merge. Pages run: https://github.com/elidoggart/elidoggart.github.io/actions/runs/38175223509.
- Live icon assets, resume PDF and stylesheet were byte-for-byte equal to the approved originals. The resume source was not edited.
- Cleanup reverts only that bounded test addition through a normal validated PR and retains Git history. It also corrects the signed-out editor's stale pre-launch notice and adds the owner's exact approved code attribution sentence to `README.txt`, without a portfolio UI disclaimer. Required third-party credits remain intact.

Cancellation, expiry, stale drafts, changed checks, denied operations and repeated navigation are covered by local browser/contract tests. We did not wait eight hours for a real token expiry or claim to test a phone/passkey prompt that GitHub did not present.

The successful Actions runs report non-blocking upstream action-runtime deprecation notices. No new workflow permissions were needed.
