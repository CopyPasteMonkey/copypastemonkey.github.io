# Portfolio editor guide

## Start locally

```sh
npm ci --ignore-scripts
npm run build
npm run dev
```

Open `http://127.0.0.1:4173/editor/`. The server binds only to loopback and accepts only read requests. Open `/` to inspect the built site directly. `dist/` is the deployment artifact; the root `index.html` is retained as the approved publication baseline during review and is not the new build output.

## Edit and review

Choose Work, Projects, Skills or Passions in the left sidebar (or the Edit section selector on a phone), then fill in the ordinary forms. The sidebar groups website sections, profile information and the media/link library. Save Draft and Preview website stay together in the top toolbar; backups and Undo/Redo are grouped under Draft tools. Bottom Add buttons create blank jobs, projects, skill groups or interests; Upload image opens the file picker. Main headings, subheadings and nested subheadings appear as nested groups, with their own text and images. See [the forms editor guide](FORMS-EDITOR-REVIEW.md) for heading ownership, templates, images, drafts and preview. The previous visual interface remains at `/editor/visual.html`, and the original form remains at `/editor/form.html`. Existing IDs are handled automatically; titles and ordering never determine image selection or resource placement. Nimbus’s old work remains in Internship. Public work titles and dates stay on the visible role controls.

The allowed blocks are section, text, citation, gallery, figure, resource group, resource link, heading and list. Content fields are escaped; no raw HTML, CSS, scripts or arbitrary element attributes are accepted. Internal IDs, URL schemes, file paths, list sizes, field lengths, nesting, image dimensions and file sizes are validated. Image placements require alt text and provide caption/credit fields. The media library uses stable content-hash filenames for new uploads. Shared media/resources are referenced by ID, never by heading text or array slices.

The preview uses the exact same renderer and stylesheet as the build. It supports the site's section navigation, expandable entries, keyboard focus and mobile layout. Invalid content leaves the last valid preview visible and reports a validation error.

**Save Draft** keeps structurally valid content in this browser first, including unfinished text and links. Required fields are checked before publishing, without blocking local saving or backup. The loopback preview saves locally. On the approved production domain, signing in also enables saving a public draft branch and pull request, leaving the live site unchanged. A failed remote save explicitly reports that the local copy is safe. Uploaded images are optimized to static WebP or PNG (maximum 2400 px, 2 MB) and stored as bytes in browser IndexedDB, with metadata stripped by canvas re-encoding. Export the draft ZIP to keep a portable backup with the content JSON and all newly uploaded images and the selected resume PDF. Existing site images stay referenced. Browser/site-data clearing removes local drafts. Changes since the last save trigger a leave-page warning and receive separate automatic recovery copies per tab. After a reload, use Restore recovered edits or download that copy. Multiple tabs detect conflicting saves and offer an explicit choice; earlier versions remain available in recovery controls.

**Restore backup** accepts exported ZIP files or content JSON. A full backup includes new files. If any files are missing, Download backup can provide a clearly labelled text-only recovery JSON; restored text remains editable, and the missing files must be uploaded again before publishing.

**Publish…** handles sign-in, saving the current edits to GitHub, and waiting for validation automatically. The browser checks can take several minutes; pending checks are displayed as progress. After checks pass, click **Publish now** in the confirmation window. The progress tracker checks deployment until the update is live. You do not need to click Save Draft or load a remote draft first. Identical drafts are reused without another commit. An unchanged live version reports that it is already up to date.

If GitHub has a different draft and this editor has local edits, choose **Keep my current edits**, **Load saved GitHub version**, or **Cancel**. Loading keeps the displaced edits in Undo and a browser recovery copy. **Load saved version** is also available after sign-in if you want to resume editing on another computer. Multiple editor tabs require an explicit choice before replacing a newer local save. Download backup keeps a portable copy independent of browser storage.

Publication still checks the exact draft revision, permitted changed files, successful required validation and GitHub mergeability, then requires explicit confirmation. A merge rejection never falls back to force merging. Tokens stay only in memory and are cleared on logout, expiry or revocation; local drafts survive. This public repository's draft branches and pull requests are public.

To validate an exported ZIP without changing source files:

```sh
npm run draft -- /path/to/portfolio-draft.zip
```

To apply a reviewed ZIP locally:

```sh
npm run draft -- /path/to/portfolio-draft.zip --apply
npm run build
```

The importer validates content and every referenced local asset before applying, checks uploaded filenames against their bytes, and refuses to overwrite different existing assets. It changes only `content/portfolio.json` and new uploaded assets. It does not commit, push, deploy or edit the resume source. The optional CLI media optimizer is `npm run media -- /path/to/image.jpg`.

## Replace the resume PDF

1. Open **Resume**, choose **Upload resume PDF**, and select the PDF exported from your LaTeX editor or word processor.
2. In **Review replacement resume**, use **Open PDF preview** to inspect the exact file, then choose **Use this PDF in draft**. Cancel or Escape leaves the previous resume selected.
3. **Save Draft** retains the PDF with the browser draft and, when signed in, uploads it to the public GitHub draft. **Load GitHub draft** restores that PDF on another computer. **Download backup** includes it in the portable ZIP.
4. Choose **Publish…** and confirm the reviewed, validated draft. The public Download resume link changes only after deployment succeeds.

PDFs must be at most 5 MB, contain 1–20 pages, and have a safe `.pdf` filename. The shared PDF parser rejects malformed, incomplete, password-protected, scripted, attached-file, and interactive-form documents. It checks object streams as well as ordinary dictionaries. The uploaded bytes remain unchanged, with a hash-based immutable filename; the former resume and Git history remain recoverable. No LaTeX source or local resume file is edited. A browser preview link opens the PDF in a separate tab using the browser's viewer.

The same validation runs in required CI. The GitHub transport only adds hashed resume PDFs alongside controlled content and optimized images. No new provider permission or service is needed. Public draft PDFs are public even before publication. Native LaTeX editing would additionally need source/asset management, a compiler with a fixed package set, bounded and isolated execution, error reporting, and compiled-PDF review; it is outside this upload feature.

## Source organization

- `content/portfolio.json`: editable content, media catalog and resource catalog.
- `lib/schema.mjs`: bounded schema and semantic validation, shared by browser and Node. `npm run schema` regenerates the standard JSON Schema at `content/schema.json`.
- `lib/render.mjs`: controlled static templates. No framework is needed for the public site.
- `editor/`: the forms-first editor and compatible visual/original form interfaces, secure auth client, guarded remote workflow and faithful preview. `build/decap-api.mjs` bundles the actual official Decap GitHub API module; it is not the stock Decap CMS interface. The retired `/editor/cms.html` demo redirects to `/editor/`.
- `scripts/`: deterministic build, read-only server, media and draft import.
- `auth/`: the deployed OAuth Worker source and documented repository-only GitHub App integration. Secrets are managed outside this repository. Completed rollout evidence is in [ROLLOUT-STATUS.md](ROLLOUT-STATUS.md).
- `tests/fixtures/`: approved HTML and border CSS; assets remain the originals in `assets/`.

`index.html`, assets, legacy redirect pages, credits, font notices and resume PDF are preserved. `app.js` has only two necessary adjustments: page titles follow the editable site name, and same-document navigation also works in preview iframes. The actual approved site CSS is unchanged by the editor feature.

## Verification

```sh
npm test
npm run validate
npm run build
npx playwright install chromium webkit
npm run test:browser
TEST_BROWSER=webkit npm run test:browser
```

The initial migration test compares 2,511 parsed HTML nodes: all text, tags, attributes, IDs, images and links. This migration fixture is frozen independently of the editable content, so future intentional edits can pass validation without needing to rewrite the migration proof. Update fixtures only for a reviewed template/design change, never automatically in CI. The tests also validate all referenced assets, block/URL/path safety and authentication-helper rejection cases. Browser checks exercise all 18 disclosures, repeated/back/direct navigation, keyboard focus, mobile overflow, local drafts, undo, import/export, image optimization and conflicting tabs. Actual Decap API contract tests use mocked GitHub responses; interface tests execute the real popup handshake on a mocked separate origin. They cover public draft creation/update/upload, explicit publish, stale drafts, failed checks/merge, expiry, permission denial, revoked credentials, logout and cancellation. No test uses a real GitHub account or writes remotely.

## Current deployment and rollback

Publishing is enabled at `https://www.elidoggart.com/editor/`. Protected `main` requires a pull request and successful, up-to-date `validate` checks. Force pushes and main-branch deletion are blocked. Zero required human approvals is intentional for this owner-operated repository; the editor still requires explicit publication confirmation.

`.github/workflows/content-validation.yml` validates actual content/assets, runs unit tests, builds the actual website, and exercises both browser engines against the separate frozen editor fixture. `.github/workflows/pages.yml` publishes only the real `dist/` build through the `github-pages` environment. Test builds go to `.local/browser-dist/` and cannot replace the deployment artifact. Failed UI screenshots and context are retained as workflow artifacts for seven days.

A merge is not proof of deployment. Verify the Pages result and `/build.json` revision before reporting a change live. Revert a bad release with a new reviewed commit through the same checks; never reset or force-push main.

The initial setup and approval records in [ROLLOUT-STATUS.md](ROLLOUT-STATUS.md), older review documents and `docs/examples/` are historical evidence. They are not current instructions to disable publication or repeat setup. The authentication examples also support regression tests.
