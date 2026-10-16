# Content editing and reliability audit — 16 October 2026

The editing scope is Work, Projects and Skills. New items use the existing website templates and styles. The reliability review also covers the public site, editor storage, uploads, recovery and publishing.

## Changes

- Blank project and skill details now expose role/description and date fields, including when the original values are empty.
- The first-detail menu now includes grouped links and downloads, matching the existing content tree.
- Links & downloads can upload or replace certificate/report PDFs after a review step. Link addresses, labels, notes and download filenames remain editable. The shared resume validator bounds file size/pages and rejects unreadable or active PDFs; the resume selection stays independent.
- Draft previews resolve new PDFs to the uploaded bytes. Referenced PDFs are included in missing-file detection, portable ZIP export/import, local CLI import and GitHub draft upload/recovery. Duplicate references share one asset. Existing draft schemas and filename conventions remain compatible.
- A slow GitHub save now records only the remote revision associated with the snapshot it sent. It does not save newer in-flight edits or replace another tab's newer local draft. The revision metadata update uses the same browser lock as local saving.

## Content coverage

Existing controls were exercised for names, summaries, main images, role/details labels and dates, section introductions, entry headings, placeholders, headings and subheadings, paragraphs and text formats, lists, galleries and image layouts, alt text, captions, credits, image links, citations and resource groups. Creation, ordering, removal, Undo, unfinished drafts, reload and faithful preview remain supported. Stable IDs and controlled styling are preserved.

## Verification

Final browser and actual-content results are recorded with the pull request. Unit/content checks and the deterministic production build passed. The Chromium suite passed all 97 checks, including the original slow-save regression and new certificate/clean-browser backup tests. Browser suites use isolated local fixtures and mocked GitHub/OAuth requests; they do not alter the owner's live draft.

Routine PR publishing still requires content/asset validation, unit tests and build. Full Chromium/WebKit suites remain opt-in through the manual workflow while content is changing rapidly. Run unit checks, build and browser suites sequentially: the build-isolation unit test intentionally regenerates the browser fixture directory, so running it during a browser suite can temporarily remove served modules.

Phone checks use browser viewport sizes, not physical phones. The earlier audit's limits around browser-data deletion, actual provider outages and exhaustive accessibility/file-format testing still apply. Passing these checks addresses demonstrated failures; it is not a guarantee against every future defect.
