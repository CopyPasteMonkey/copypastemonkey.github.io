> Status: the owner approved the full editor, favicon, branch-protection and Pages rollout on 2026-10-11. Earlier pending-approval notes below are historical. See [ROLLOUT-STATUS.md](ROLLOUT-STATUS.md) for current execution and verification.

# Production-origin sign-in test — pending approval

GitHub user OAuth authorization and the standalone Worker callback succeeded on 2026-10-11. The callback's completion message is generated only after the helper verifies state/PKCE, exchanges the code, checks token expiry and verifies the approved numeric user/repository with write access. The token was not read or logged by the agent. The completed standalone callback tab was closed. No repository write occurred.

The remaining authentication test is popup delivery to `https://www.elidoggart.com`. The helper intentionally does not trust localhost. Its origin allowlist will not be changed for this test.

## Smallest proposed deployment

The Pages settings were inspected and currently show **Deploy from a branch → main → / (root)**. Publish only these three reviewed files in a narrowly scoped commit/PR after user approval:

| Reviewed local source | Public repository path |
| --- | --- |
| `docs/examples/auth-check.html` | `editor/auth-check.html` |
| `docs/examples/auth-check.mjs` | `editor/auth-check.mjs` |
| `editor/auth-client.mjs` | `editor/auth-client.mjs` |

The resulting temporary test URL is `https://www.elidoggart.com/editor/auth-check.html`. The page reuses the existing stylesheet and font assets. Its sources in `docs/examples/` are excluded from the normal editor build until copied deliberately. No credentials are embedded in any file.

The only control starts the existing reviewed popup client. After the callback handshake, it makes **GET** requests to GitHub for the current user and the approved repository, verifies numeric identities and access, and discards the in-memory session. It does not print tokens, persist credentials, create drafts, upload images, open PRs or publish content. Its page enforces the production origin and a restrictive content-security policy. Local browser tests exercise the real popup handshake with inert credentials and intercepted API responses; they make no live account requests.

This is a public diagnostic page, not a private preview. No menu link is added, and it requests no indexing. Existing portfolio content, CSS, favicon, resume, Pages source and DNS remain unchanged. This narrow commit must be prepared from the then-current approved remote baseline so other publication work is preserved. Do not merge the entire editor feature branch to publish this test.

Approval scope: upload/merge just these three files and let the existing branch-based Pages deployment publish them; then run the read-only sign-in test in the user's browser. Approve their later removal as a separate cleanup commit, or remove them with the separately approved final editor rollout. This approval would not cover editor publication, draft writes, branch settings or a Pages-source change.

## Separate gates for the complete editor

The repository currently has **no rulesets** and **no classic branch protection rules**, verified read-only on 2026-10-11. Before enabling Save Draft/Publish remotely:

1. Review/approve the complete editor feature and integrate only the correct, approved favicon commit. Keep the incorrect `3f5fc6c` artwork excluded.
2. Approve the validation workflow and an active `main` ruleset requiring pull requests, the GitHub Actions `validate` check on the current revision, and an up-to-date branch; block force pushes and deletion with no bypass entries. Do not invent a second human-review requirement for this single-owner workflow. The check needs a real successful run before selecting it as required.
3. Separately approve activating the reviewed deployment workflow from `docs/examples/pages.yml` and changing Pages source to **GitHub Actions**. It validates/builds and deploys only `dist/`; deployment permissions are `pages: write` and `id-token: write` on the deployment job. No extra GitHub App permissions are needed.
4. Approve the complete editor publication at `/editor/` and enabling its existing fixed-origin publishing configuration. Then test an explicitly identified public draft/PR, conflict/permission behavior, a separately confirmed publish, deployment feedback and a checked Git revert. The temporary authentication page alone does not validate this write/publish workflow.

No proposed deployment or settings change has been performed.
