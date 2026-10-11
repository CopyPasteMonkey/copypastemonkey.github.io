> Status: the owner approved the full editor, favicon, branch-protection and Pages rollout on 2026-10-11. Earlier pending-approval notes below are historical. See [ROLLOUT-STATUS.md](ROLLOUT-STATUS.md) for current execution and verification.

# Local editor review

Branch: `feat/constrained-content-editor` in this isolated checkout. Authoritative baseline: `5f4c6e3fcae64040df353a4600546cf0f0f59786`, the approved border change, integrated by fast-forward. No repository push or editor publication has occurred. After later user approval, the Cloudflare login helper was created in an inactive configuration; see [setup status](../auth/SETUP-STATUS.md). The correct favicon commit is reported as `861b60ea…`, with upload approval pending; it has not been integrated. Do not integrate the incorrect `3f5fc6c` commit.

## Delivered

- One graphical editor at `/editor/`: constrained forms, add/reorder/remove entries and roles, approved blocks, alt/caption/credit fields, media/resources, site/contact/resume fields and education.
- Validated JSON, shared static renderer, stable IDs/references, asset checks, frozen migration proof and a read-only loopback server.
- Local draft save/recovery, Undo/Redo, faithful interactive preview, mobile layout, portable ZIP import/export, optimized image uploads and conflicting-tab detection.
- Actual official Decap GitHub API module behind this UI, with the stock CMS/demo removed. The retired demo URL redirects to the editor. The full dependency tree audits clean (zero vulnerabilities).
- Integrated secure popup client, OAuth Worker, memory-only session tokens, guarded public draft/PR workflow, explicit SHA-bound publish and separate deployment feedback. The approved Cloudflare Worker exists and the approved GitHub App is installed only on the portfolio repository. The user supplied the two Production secrets directly and approved user OAuth authorization. Browser initiation and the standalone callback succeed. Production-origin popup and full workflow acceptance remain pending; shipping config stays disabled.
- Validation-only GitHub workflow and an inactive, reviewable Pages deployment example. No deployment workflow was enabled.

## Evidence

- 15 Node tests passed in the fresh 2026-10-11 run: full schema/assets, exact rendering, malicious paths/URLs/fields, bounded content, OAuth state/PKCE/cookie rejection and popup trust/timeout checks.
- All 16 browser tests passed in one fresh 2026-10-11 run after the screenshot-test adjustment. They cover all 18 disclosures; keyboard/focus; desktop/mobile routing, repeated/back/direct navigation; draft recovery/undo/import/export; optimized image persistence; conflicting tabs; invalid inputs; disabled setup; actual Decap draft/upload/update/PR/labels; exact-revision publish; rejected checks/merge; stale drafts; wrong identity; 403/401; expiry; cancellation; logout; cross-computer image reload and corrupted-media rejection.
- Two additional tests pass for the proposed, unpublished production-origin sign-in diagnostic: the real popup handshake with inert credentials completes two read-only API checks without browser storage, and a wrong account is rejected before repository access. These tests intercept all provider traffic and are separate from live acceptance.
- The real popup handshake executes on a separate mocked origin. All GitHub responses and credentials in these tests are inert; no test contacts a real account or writes remotely.
- 2,511 parsed HTML nodes match the approved publication exactly, including every text, attribute, image, link and stable ID.
- 10 screenshot comparisons match byte-for-byte: Work, expanded Nimbus Internship, MQP, Film Photography and Contact at 1440 px and 390 px.
- The screenshot test checks hash-scroll positions within one pixel, then aligns their scroll coordinates for the exact pixel comparison. A fresh run exposed intermittent one-pixel initial scrolling from font-loading timing; page heights and content remained identical. Only the test was adjusted, not public CSS or navigation.
- 17 entries, 149 distinct media records / 158 image placements and 10 resources migrated and validated.
- Before the Cloudflare origin was configured, two complete builds produced identical 181-file output. SHA-256 over the sorted relative-path/file-hash manifest at that review point: `730050a4c4cdff6676f4998bd299f0011a4f20617697af291611e0c851e6a695`.
- After configuring the approved Cloudflare origin, two further builds produced identical 181-file output with publishing still disabled. SHA-256 of the JSON-encoded sorted `[relativePath, fileSha256]` manifest: `51fd36157cf9d5592167b4b28f6d751fdfaba1930c79a8766cca06430c0e3413`.
- Original HTML, CSS, assets, resume PDF, font licenses, credits and legacy redirects are unchanged relative to the border baseline. Existing app.js has only the editable title and iframe-safe hash-navigation adjustments.
- Exported ZIP with an optimized image passed CLI content/hash/asset validation without applying changes.
- `npm audit` on 2026-10-11: info 0, low 0, moderate 0, high 0, critical 0. Every build rejects unwanted rich-text/auth/widget modules in the backend graph.

## Review images

- [Desktop editor](review/editor-desktop.png)
- [Mobile editor](review/editor-mobile.png)
- [Desktop portfolio](review/portfolio-desktop.png)
- [Mobile portfolio](review/portfolio-mobile.png)

Desktop and mobile editor screenshots were also saved as new generated image items in the user's Library. Library identities are retained in local metadata, outside the repository.

## Remaining approvals and acceptance

1. After its pending upload approval, integrate the correct favicon commit `861b60ea…` without substituting its artwork; rerun template/content parity if its head metadata changes. Do not use `3f5fc6c`.
2. Completed after explicit approval: install the user-owned GitHub App on only `elidoggart/elidoggart.github.io`, with Metadata read, Contents read/write and Pull requests read/write. App ID `5275120`, installation ID `170301476`, repository ID `1412250381`, user ID `183743177`. Eight-hour user-token expiration is enabled; no OAuth user authorization has been run.
3. Cloudflare setup, user-operated secret entry, specifically approved user OAuth authorization and the standalone callback are complete. Production deployment `bf21e667` is Ready. No bearer token or stored secret was read, and no private key, passkey, deployment API token or paid service was created. The next gate is the locally prepared [three-file read-only diagnostic deployment](AUTH-TEST-PROPOSAL.md), requiring separate approval. The direct test client remains edge-blocked; normal Chrome reaches the helper successfully.
4. Test the actual installed App and intended laptop/phone flow. Mock/contract tests establish local behavior, not live provider acceptance. Confirm permission denial, expiry, cross-computer resume and GitHub-enforced branch rules.
5. Separately approve editor publication, Pages settings and deployment workflow. Require PR validation with no app bypass. Confirm real deployment feedback and a checked revert through Git history. Public repository drafts are public.

See [EDITOR.md](EDITOR.md), [DEPENDENCIES.md](DEPENDENCIES.md) and [auth/README.md](../auth/README.md) for operation, dependency evidence and exact setup steps.
