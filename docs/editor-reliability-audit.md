# Editor reliability audit — 13 October 2026

Feature work was paused for this audit. Public portfolio content and the photography/guide work are unchanged.

## Findings and fixes

| Failure or risk | Result after the fix | Regression coverage |
| --- | --- | --- |
| Temporarily clearing a required field prevented both saving and backup download. | Unfinished text and links can be saved, reloaded and exported. Public rendering and publishing remain strictly validated. | Local-draft schema tests; browser save/reload/restore and publication rejection. |
| Unsaved edits relied on a leave-page warning. | Separate automatic recovery copies preserve each tab's edits. Reload offers explicit restore and download controls; displaced GitHub/other-tab versions are accessible there too. | Last-keystroke reload, Undo, independent tabs, archived versions, full storage. |
| Slow saves could describe an older snapshot as if it included newer edits. | The saved snapshot is explicit, and the message identifies newer unsaved edits. Other tabs do not wait indefinitely on the local save lock. | Delayed GitHub save, local snapshot assertions, lock contention and retry. |
| Restore, load and publication operations allowed overlapping actions. | Mutation controls, including visual-editor canvas controls, stay locked until completion. Failed/cancelled operations preserve the current draft and unlock controls. | Slow/failed backup restore, remote media failure, cancellation, retry, Undo, merge overlap. |
| File storage could hang on blocked opens, aborted reads or stalled transactions. | Bounded operations report a useful recovery action. Damaged records do not hide intact uploaded files. | Storage fault injection and backward-compatible record tests. |
| WebKit's temporary storage rejected Blob records. | Uploads store exact bytes and MIME type; existing Blob records remain readable. | Real IndexedDB upload/reload tests in Chromium and WebKit; manual Safari image save/reload. |
| Cancelling image preparation could keep Save blocked. | Cancellation releases the pending UI operation and prevents the abandoned upload from changing the draft. | Existing interrupted-upload tests and malformed-image retry. |
| Missing image/PDF bytes blocked every backup attempt. | A clearly labelled text-only recovery download preserves text and references, and can be restored. It explicitly reports missing files. | Missing-file download/restore test; complete-backup checks remain enforced. |
| A failed content request could prevent access to a saved draft. | A validated cached website copy supports continued editing when available. Startup requests have timeouts; controls wait for initialization. | Content-request failure followed by edit, save and backup. |
| GitHub reads can lag a successful save; a lost merge reply can look like failure. | Bounded read-only reconciliation verifies the saved branch or exact reviewed merge. Uncertain writes are not replayed. | Stale read responses, unconfirmed saves, lost merge reply, wrong-head/content rejection. |
| A tracker race could strand a newer deployment, and already-merged content could be described as live prematurely. | Checks follow the current revision, resume after reload, and distinguish published content from a completed deployment. Waiting validation is not presented as user error. | Superseded checks, failed/pending/success transitions, reload, no duplicate merge, already-published content. |
| Rapid Undo during a preview reload could restore text inside a collapsed disclosure, appearing to do nothing. | Consecutive preview updates preserve the last usable section, expanded details and scroll position until the replacement is ready. | Remove then Undo while the preview stylesheet is deliberately stalled, in both browsers. |
| Safari could lose keyboard focus after moving an entry. | The moved control regains focus after the DOM update. | Keyboard reorder tests in WebKit and Chromium. |
| Browser tests were not part of the publishing gate, and several fixtures assumed no existing uploads or WebP-only output. | PR validation and main deployment run unit tests, content validation, build, and both browser suites. Fixtures reflect existing uploaded images and both supported formats. | CI workflows; real Decap transport contract tests; image and backup tests. |

The WebKit storage behavior also has an [upstream WebKit report](https://bugs.webkit.org/show_bug.cgi?id=286561). The compatibility change was verified by reproducing the failure and rerunning the same storage test successfully, rather than excluding WebKit from testing.

## Verification method

- Unit/contract tests exercise schema safety, image processing, PDF validation, ZIP integrity, storage faults, OAuth boundaries and GitHub request/response failures.
- Browser tests use actual editor controls and browser storage. GitHub/OAuth failures are injected into isolated test sessions; they do not write to the production repository.
- The browser suites cover forms, the visual editor, the legacy form route, keyboard navigation, phone/laptop layouts, uploads, resume replacement, backup/restore, multi-tab conflicts and publication progress.
- Manual Safari checks reproduced the original unfinished-draft save/backup failure before the change, then verified unfinished saving and download, leave-page warning, unsaved-text recovery, and image replacement surviving save/reload after the change.
- Public content and asset validation, deterministic build and whitespace checks were also run. Final execution counts and deployment evidence are recorded in the PR.

Run locally, after installing dependencies and Playwright's Chromium/WebKit browsers:

```sh
npm test
npm run validate
npm run build
npm run test:browser
TEST_BROWSER=webkit npm run test:browser
```

The browser configuration starts its own local preview server when needed. Run the two browser commands sequentially; some older test artifacts use shared paths under `.local/`.

## What remains untested or limited

- Physical iPhone/iPad/Android devices, Firefox, older Safari versions and assistive-technology sessions were not exercised. Phone checks use browser viewport sizes; WebKit automation is supplemented by desktop Safari checks.
- OS crashes, sudden power loss, actual disk exhaustion and deliberate browser-data eviction were not induced. Storage errors, interruptions and reloads were tested through controlled faults. Browser recovery cannot survive a user/browser deleting all site data; downloaded backups and saved GitHub drafts remain the separate copies.
- GitHub-wide outages, real credential expiry while publishing, and a real network disconnection at the exact merge instant were simulated. The exact reviewed revision and content are checked during reconciliation; unknown results never justify blindly resending a merge.
- This is not a full offline installation. Cached content helps only if the editor's page/scripts can load and a validated website copy exists.
- No overnight editing soak, exhaustive file-format fuzzing or accessibility certification was performed. Passing tests reduce known risks; they do not establish that no bugs remain.
