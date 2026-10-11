# Approved rollout — 2026-10-11

The owner explicitly approved the full editor publication, original resume favicon, required validation/branch protection, Pages Actions deployment, and one bounded public test draft/media publish followed by a validated revert and cleanup. This supersedes earlier pending-publication notes. The temporary auth-only diagnostic deployment is skipped.

## Preparation

- Fresh remote `main`: `5f4c6e3fcae64040df353a4600546cf0f0f59786` before rollout.
- Local backup branch: `backup/pre-approved-rollout-20261011`; a Git bundle is retained under ignored `.local/backups/`.
- The exact approved favicon commit `861b60ea6d9db65acf7d0bb36ae057dc38505371` is merged. The superseded `3f5fc6c` commit is excluded.
- All four icon asset hashes match the design handoff. The frozen approved HTML body is unchanged; only its head icon links were copied into the controlled renderer and migration fixture. The static build now includes all four approved icon assets.
- Production publishing is enabled only for the existing fixed origin, repository and numeric user. No credential values are stored in the repository.
- The reviewed Pages workflow is activated at `.github/workflows/pages.yml`; the required validation job remains `validate` in `.github/workflows/content-validation.yml`.
- Local content/asset validation, 15 Node tests and the build pass. Browser checks and live deployment verification are in progress.

## Approved settings and acceptance

- Active `main` ruleset: PR required; zero required human approvals; successful `validate` from GitHub Actions; branch up to date; block force pushes/deletion; no bypass entries. Squash merging enabled.
- Pages source changes from `main`/root to GitHub Actions while retaining `www.elidoggart.com`, CNAME and HTTPS. Build has `contents: read`; deploy has only `pages: write` and `id-token: write` and publishes `dist/` through the `github-pages` environment.
- The one public test draft may add one synthetic optimized WebP to the media catalog without placing it in any visible section. Its merge must pass validation. A subsequent validated revert removes the test record and asset; only test branches/diagnostics are cleaned up.
- Final acceptance covers popup sign-in, read/save/reload/publish, deployment feedback, successful cleanup, public sections/links, resume and all approved icon assets. Cancellation/expiry use safe live checks where practical and existing mock tests otherwise.

No deployment success is claimed until the actual run, commit and public URLs are verified below.
