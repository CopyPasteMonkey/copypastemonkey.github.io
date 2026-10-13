# Authentication integration

The editor and OAuth helper are deployed. Publishing is enabled for the fixed production origin and portfolio repository. Completed sign-in, draft/publish and deployment evidence is recorded in [ROLLOUT-STATUS.md](../docs/ROLLOUT-STATUS.md); the current editing workflow is in [EDITOR.md](../docs/EDITOR.md).

Repository `elidoggart/elidoggart.github.io` (ID `1412250381`) and user ID `183743177` are non-secret configuration. The GitHub App is installed only on this repository. Its approved permissions remain Metadata read, Contents read/write and Pull requests read/write. Secrets belong in the Worker secret bindings, never source files or browser storage.

The checklist below preserves setup decisions from the initial rollout. Its references to separate approval describe that historical sequence; the approved rollout has already completed.

## Historical setup checklist

1. Completed after approval: create a user-owned GitHub App and install it on **only** `elidoggart/elidoggart.github.io`. Repository permissions: **Metadata read, Contents read/write, Pull requests read/write**. No Issues, Checks, Administration, Actions, Workflows, organization permissions or OAuth `repo` scope. Label operations support Pull requests write; public check/deployment status is fetched without a token. User OAuth authorization and the standalone callback also succeeded after separate specific approval. If a real operation requires more, stop and report the exact failure and proposed permission.
2. Completed after approval: deploy `worker.mjs` on the approved default Cloudflare `workers.dev` hostname, verify the Free plan and disable automatic invocation logs. No portfolio DNS change was needed. Normal-browser reachability is confirmed; the separate direct test client remains edge-blocked. Do not bypass a security control or enable a paid service.
3. Completed by the user: generate the app's OAuth client secret and enter `CLIENT_SECRET` and a locally generated `COOKIE_KEY` into Production Worker secret bindings. Values were not read by the agent. No GitHub App private key is needed. Non-secret bindings are already saved: `CLIENT_ID`, `AUTH_ORIGIN`, `EDITOR_ORIGIN=https://www.elidoggart.com`, `REPOSITORY_ID=1412250381`, `ALLOWED_USER_ID=183743177`. The app callback is registered as `https://portfolio-editor-auth.elidoggart.workers.dev/callback`.
4. Verified enabled: expiring GitHub App user tokens (eight hours). The token exchange narrows to the numeric repository ID. Refresh tokens are discarded, so another sign-in is required after expiry.
5. Completed in the approved rollout: repository branch rules requiring pull requests and the `validate` GitHub Actions check before merging into main, without an app bypass. GitHub authorizes every API write. Client-side path checks are defense in depth; Contents write is repository-wide and is not a server-enforced path-limited permission. If that narrower capability is required, design a server-side write gateway before connection.
6. Completed in the approved rollout: editor publication and GitHub Pages Actions deployment. The inactive example in `docs/examples/pages.yml` validates/builds and deploys only `dist/`; it is not an enabled workflow. Changing Pages from branch/root serving to GitHub Actions is an administrative user action, not an app permission.

## Security behavior

The Worker binds random state and S256 PKCE to an AES-GCM encrypted, short-lived Secure/HttpOnly/SameSite=Lax `__Host-` cookie. It uses a fixed callback, a numeric user allowlist and repository write checks. Caller-selected scope, redirect and repository parameters are rejected. Both popup sides require the exact origin **and** window source, and exchange the token only after their handshake. Responses are no-store; callback scripts have a nonce CSP; errors do not expose provider bodies or tokens. Disable hosting request/header/query logging that could capture OAuth callback codes before deployment.

The editor holds the bearer token only in memory and sends it only to GitHub's API with redirects rejected. Logout, provider revocation and expiry clear it and abort authenticated requests. Refresh tokens are never retained. The editor has a restrictive script/connect CSP and renders authored content as escaped text. Browser XSS would still be a risk to an in-memory bearer token.

Save Draft first saves locally, then writes content and optimized images to a public `cms/portfolio/portfolio-…` branch and pull request. Existing draft updates check the expected head and use non-force ref updates. A second session's changes, changed main, multiple drafts, missing images and unexpected PR files block writing/publication. There is no direct main ref update, branch deletion or forced merge. An interrupted operation preserves the local draft; export it before reloading the GitHub state.

Publish checks the actual draft content/head, permitted changed paths, one successful `validate` check from GitHub Actions on that exact SHA, and GitHub mergeability. The user then confirms the reviewed revision. The merge request supplies that SHA and rechecks everything. Merge rejection remains a rejection. A confirmed merge and a successful Pages deployment are reported separately.

## Acceptance checklist for future integration changes

- Review the helper, configured origins, numeric identities, permission list and branch rules.
- Test the actual installed App user token: sign-in, repository read, optimized image upload, public draft/PR creation and update, labels, another-computer draft reload, publish, 403/revoked-token behavior, expiry/relogin and popup cancellation.
- Confirm checks cannot be bypassed; invalid JSON/assets must fail the required workflow. Do not weaken branch rules to make a test pass.
- Confirm preview fidelity on the approved domain, deployment success/failure feedback, and a reviewed revert commit through the same validation/deployment path.
- Test GitHub's phone/passkey flow on the user's intended laptop/browser. Compatible cross-device sign-in may use a nearby Bluetooth-enabled phone and QR prompt. Creating/registering the passkey is user-operated.
- Only after these gates and publication approval, fill the approved auth origin and enable publishing.

Sources: [Decap GitHub backend](https://decapcms.org/docs/github-backend/), [GitHub App user tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app), [labels permissions](https://docs.github.com/en/rest/issues/labels), [public check runs](https://docs.github.com/en/rest/checks/runs), [GitHub passkey sign-in](https://docs.github.com/en/authentication/authenticating-with-a-passkey/signing-in-with-a-passkey).
