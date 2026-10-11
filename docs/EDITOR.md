> Status: the owner approved the full editor, favicon, branch-protection and Pages rollout on 2026-10-11. Earlier pending-approval notes below are historical. See [ROLLOUT-STATUS.md](ROLLOUT-STATUS.md) for current execution and verification.

# Portfolio editor review

## Start locally

```sh
npm ci --ignore-scripts
npm run build
npm run dev
```

Open `http://127.0.0.1:4173/editor/`. The server binds only to loopback and accepts only read requests. Open `/` to inspect the built site directly. `dist/` is the deployment artifact; the root `index.html` is retained as the approved publication baseline during review and is not the new build output.

## Edit and review

Choose Work, Projects, Skills or Passions, open an entry, then edit its summary, image, roles and content blocks. Add, move up/down or remove items. Undo restores the previous edit group. Existing IDs are read-only in the form; titles and ordering never determine image selection or resource placement. Nimbus's old work remains in Internship. All work titles and dates stay on the visible role controls.

The allowed blocks are section, text, citation, gallery, figure, resource group, resource link, heading and list. Content fields are escaped; no raw HTML, CSS, scripts or arbitrary element attributes are accepted. Internal IDs, URL schemes, file paths, list sizes, field lengths, nesting, image dimensions and file sizes are validated. Image placements require alt text and provide caption/credit fields. The media library uses stable content-hash filenames for new uploads. Shared media/resources are referenced by ID, never by heading text or array slices.

The preview uses the exact same renderer and stylesheet as the build. It supports the site's section navigation, expandable entries, keyboard focus and mobile layout. Invalid content leaves the last valid preview visible and reports a validation error.

**Save Draft** always saves valid content in this browser first. The loopback preview saves locally. On the approved production domain, signing in also enables saving a public draft branch and pull request, leaving the live site unchanged. A failed remote save explicitly reports that the local copy is safe. Uploaded images are optimized to static WebP (maximum 2400 px, 2 MB) and stored in browser IndexedDB, with metadata stripped by canvas re-encoding. Export the draft ZIP to keep a portable backup with the content JSON and all newly uploaded images. Existing site images stay referenced. Browser/site-data clearing removes local drafts. Changes since the last save trigger a leave-page warning. Multiple tabs detect newer saved drafts; export a conflicting tab before reloading.

**Import draft** accepts exported ZIP files or the content JSON (new image files must already exist or be included). ZIP imports do not extract paths to disk. **Publish…** requires a connected session on the approved production domain. Publish checks the saved draft's exact revision, permitted changed files, successful required validation and GitHub mergeability, then asks for explicit confirmation of that revision. A merge rejection never falls back to force merging. A confirmed merge is shown separately from a successful Pages deployment.

On the production editor, use **Sign in with GitHub** on a compatible computer; GitHub handles the phone/passkey interaction. Use **Load GitHub draft** to resume a remote draft and its optimized images on another computer. Export local changes before replacing them with remote content. A newer remote draft or changed main blocks saving until reconciled. Tokens stay only in memory and are cleared on logout, expiry or revocation; local drafts survive. This public repository's draft branches and pull requests are public.

To validate an exported ZIP without changing source files:

```sh
npm run draft -- /path/to/portfolio-draft.zip
```

To apply a reviewed ZIP locally:

```sh
npm run draft -- /path/to/portfolio-draft.zip --apply
npm run build
```

The importer validates content and every referenced local asset before applying, checks uploaded filenames against their bytes, and refuses to overwrite different existing assets. It changes only `content/portfolio.json` and new image assets. It does not commit, push, deploy or edit the resume source. The optional CLI media optimizer is `npm run media -- /path/to/image.jpg`.

## Source organization

- `content/portfolio.json`: editable content, media catalog and resource catalog.
- `lib/schema.mjs`: bounded schema and semantic validation, shared by browser and Node. `npm run schema` regenerates the standard JSON Schema at `content/schema.json`.
- `lib/render.mjs`: controlled static templates. No framework is needed for the public site.
- `editor/`: the single graphical editor, secure auth client, guarded remote workflow and faithful preview. `build/decap-api.mjs` bundles the actual official Decap GitHub API module; it is not the stock Decap CMS interface. The retired `/editor/cms.html` demo redirects to `/editor/`.
- `scripts/`: deterministic build, read-only server, media and draft import.
- `auth/`: integrated OAuth Worker source, current setup status and exact approval/acceptance scope. The approved Cloudflare Worker and repository-only GitHub App are configured, with secrets entered directly by the user. User OAuth consent and the standalone callback succeeded after approval. Production-origin popup acceptance and the full write workflow remain pending.
- `tests/fixtures/`: approved HTML and border CSS; assets remain the originals in `assets/`.

`index.html`, assets, legacy redirect pages, credits, font notices and resume PDF are preserved. `app.js` has only two necessary adjustments: page titles follow the editable site name, and same-document navigation also works in preview iframes. The actual approved site CSS is unchanged by the editor feature.

## Verification

```sh
npm test
npm run validate
npm run build
npx playwright install chromium
npm run dev
# In another terminal:
npm run test:browser
```

The initial migration test compares 2,511 parsed HTML nodes: all text, tags, attributes, IDs, images and links. This migration fixture is frozen independently of the editable content, so future intentional edits can pass validation without needing to rewrite the migration proof. Update fixtures only for a reviewed template/design change, never automatically in CI. The tests also validate all referenced assets, block/URL/path safety and authentication-helper rejection cases. Browser checks exercise all 18 disclosures, repeated/back/direct navigation, keyboard focus, mobile overflow, local drafts, undo, import/export, image optimization and conflicting tabs. Actual Decap API contract tests use mocked GitHub responses; interface tests execute the real popup handshake on a mocked separate origin. They cover public draft creation/update/upload, explicit publish, stale drafts, failed checks/merge, expiry, permission denial, revoked credentials, logout and cancellation. No test uses a real GitHub account or writes remotely.

## Rollback and deployment plan

The completed migration confirmed `elidoggart/elidoggart.github.io`, repository ID `1412250381`, and allowed user ID `183743177`. The isolated checkout remote and disabled publishing configuration now use those verified values. The app, helper secrets and user OAuth authorization are configured, but editor sign-in remains disabled pending production-origin acceptance and publication approval. The separate three-file diagnostic proposal in `docs/AUTH-TEST-PROPOSAL.md` does not publish the full editor.

Publication requires separate review and approval. The dependency advisory work is complete: the fresh locked tree audits clean, and the browser bundles only the narrow Decap backend. See [DEPENDENCIES.md](DEPENDENCIES.md). Before enabling the integration, complete the live GitHub App acceptance gates in `auth/README.md`. Approved and installed permissions are limited to this single repository: Metadata read, Contents read/write, Pull requests read/write. Additional permissions must not be silently requested.

The supplied GitHub workflow only validates/builds pull requests. It cannot deploy. An inactive, reviewable deployment example is supplied at `docs/examples/pages.yml`: it validates/builds, uploads only `dist/`, and deploys through the GitHub Pages environment. GitHub Pages must be changed from root/branch serving to the approved build workflow if it is not already configured that way. Required validation checks/branch rules must block invalid content before the Publish merge without app bypass. Request exact settings changes at setup time; do not rely on client validation as authorization.

A successful merge is not proof of deployment. Show the GitHub Actions run link and commit SHA, then confirm the deployed revision/URL before reporting live success. In the absence of a preview provider, use the faithful local preview and label remote deployment preview unavailable. Do not add a preview service or paid plan without approval.

Rollback after publication: identify the last working content commit, create a new revert commit (no force push), validate/build it and deploy through the same checks. Restore referenced image/resource files in that revert if they changed. Draft changes can be discarded or restored from their Git history without changing the published branch.
