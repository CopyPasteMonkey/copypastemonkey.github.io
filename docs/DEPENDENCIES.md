# Dependency review

The editor has one custom constrained form interface and uses the official `decap-cms-backend-github@3.8.3` API module for GitHub draft operations. It does not load the full Decap React CMS, stock authenticator, rich-text widgets or Markdown parser. The public portfolio has no runtime dependency on the editor.

The locked development tools are Playwright 1.64.0, Sharp 0.35.5 and esbuild 0.28.2. The lockfile also pins the transitive tree; a uuid 11.1.1 override resolves its advisory without including uuid in the browser bundle.

## Audit result

On 2026-10-11, a fresh installation and `npm audit --json` reported **0 vulnerabilities** across all severities. No audit suppression or force-fix was used.

The earlier full Decap 3.16.3 tree reported 34 affected entries arising from @platejs/core, trim, sprintf-js and uuid. Removing the unnecessary CMS/widget dependency tree removed the first three packages; the uuid override addresses the fourth. This is a dependency reduction and patched resolution, not a claim that hidden rich-text fields make vulnerable code safe.

`scripts/build.mjs` bundles the API entry point from source into a self-contained 250,651-byte browser ES module. Its esbuild input graph is checked on every build: @platejs, trim, sprintf-js, uuid, decap-cms-core, decap-cms-lib-auth and all decap-cms-widget packages are forbidden. It uses no CDN, external module import or client secret. The editor CSP does not permit eval, inline scripts or external script origins. Local metadata caches from Decap's utility dependencies do not receive the session token; the stock authentication/storage modules are absent.

## Compatibility evidence

Browser contract tests instantiate the actual bundled Decap API against mocked GitHub responses, including file/blob/tree/commit creation, media upload, draft branches, pull requests, labels and app-compatible Bearer headers. Existing draft updates use Decap's blob/tree/commit methods and non-force branch updates. Publication uses a strict SHA-bound merge call; Decap's force-merge fallback is disabled.

Full interface tests exercise the real popup handshake, explicit Save Draft versus Publish, cancellation recovery, logout and the distinction between merge and deployment. Live GitHub App compatibility still requires approved setup and the acceptance checks in [auth/README.md](../auth/README.md).

Rerun `npm audit`, the build graph checks and the integration tests after dependency changes. Zero current advisories does not replace live acceptance or code review.
