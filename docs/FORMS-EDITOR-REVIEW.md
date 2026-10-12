# Forms-first portfolio editor

The owner approved the forms-first interface and requested heading/subheading ownership followed by publication on 2026-10-12. This revision makes it the default at `/editor/`; `/editor/forms.html` also opens it. The former visual editor remains at `/editor/visual.html` and the original form at `/editor/form.html`. The revision is based on published main commit `c192831005686258475b2b5a60b284ed60e2b531`.

Open **https://www.elidoggart.com/editor/** after deployment, or **http://127.0.0.1:4180/editor/** for a local preview. Port 4180 has separate browser storage from earlier previews on port 4173 and from the live website. Nothing clears or replaces those drafts. To bring a draft into this review, download its backup in the existing editor and use **Restore backup** here. Restoring asks before replacing current work and supports Undo.

To restart the read-only review server:

```sh
npm run build
PORT=4180 node scripts/serve.mjs
```

## Editing flow

1. Choose Work, Projects, Skills, or Passions. Expand an existing item to see its filled fields. The bottom **Add job / project / skill group / interest** button creates a blank form and focuses its name field.
2. Fill in the name and summary, optional metadata, and details. Jobs have ordered roles with job title and employment dates. Other categories have ordered details sections. Stable link IDs are assigned automatically and never change when content is renamed or reordered.
3. **Upload image** opens the computer's file picker directly. Review the optimized photo and enter its required description before choosing **Use image**. **Choose existing image** opens the searchable thumbnail library. Each placed photo has a thumbnail, description, caption, and credit fields. Galleries have visible ordering controls. Cancel or Escape leaves content untouched.
4. **More detail / Add content** provides only approved sections, paragraphs, headings, bullet lists, photo galleries, individual images, links, and citations. Nested content uses the same ordinary fields and photo buttons. There is no canvas editing, arbitrary HTML, styling, or ID entry.
5. **Move up / Move down** and **Remove** are visible for entries, roles, and images. Removal asks first and can be undone. Required final roles and gallery images are protected. Keyboard focus stays with the affected form.
6. **Preview website** opens a separate, faithful visitor preview. Its Desktop / Phone selector, navigation, expansion controls, and resume link use the existing public renderer. **Back to forms** or Escape returns to editing. Unfinished new entries are omitted from visitor preview until their name and summary are filled in.
7. **Save Draft** keeps the draft in this browser, including unfinished new entries. **Download backup** includes the draft and uploaded images/PDF; **Restore backup** transfers it between compatible computers. Unsaved state, Undo/Redo, reload recovery, validation, and conflicting saves from another tab are retained. Invalid fields open and receive focus when Save is blocked.

Resume, Site & contact, Education, Images, and Links & downloads remain ordinary form groups. Resume upload still validates and reviews a new immutable PDF before adding it to the draft. Original files are never overwritten. Existing resources and credits remain intact.

## Headings and content ownership

**Add heading** creates a main heading; **Add subheading** inside it creates the next level. Three named levels correspond to the existing website semantics: Main heading, Subheading, and Nested subheading. In Nimbus Internship, **Skills Developed → LabView / Wiring and Plumbing / Documentation** is now a visible group, and **Projects → New 20 Cell Cart → Power Distribution Unit / 8020 Frame** shows all three levels. Each heading's text, images and galleries are in its own content area. **Edit heading & placement** exposes its title, level, parent, and approved section format. Changing the parent moves the whole group. Move up/down and removal include associated content and lower headings; Undo restores them together. Changes cannot push descendants beyond the supported heading depth.

Legacy content stores some heading relationships as a sequence of heading levels, while section bodies already have explicit child arrays. The editor projects both as nested forms without converting stored data on load or save. All original content, heading levels, section boundaries, styles and image/resource references remain byte-for-byte unchanged by the rollout. Creating headings/subheadings through the forms uses the existing validated format. No schema extension or draft migration is needed.

All nine approved block types remain editable: section, heading only, paragraph, citation, image gallery, individual image, links/downloads group, link, and bullet list. The controls expose every existing visual variant through bounded choices: regular/note/source/context/italic paragraphs; side-by-side/single-wide/photography galleries; standard/chart/narrow images; and group-heading versus content-section spacing. This allows reconstruction of the current pages through fields and upload controls, including the report headings/citations/downloads and photography layouts. Arbitrary markup and styles remain unavailable.

## Compatibility and publication

This interface shares the existing schema, rendering, browser draft/IndexedDB storage, backup format, image optimization, PDF validation, authentication, and guarded GitHub workflow. Existing complete drafts and unfinished visual-editor templates are compatible. It adds no account, permission, credential, OAuth app, secret, or service.

Publishing is disabled on the local review origin. The authenticated production flow is covered with inert mocked credentials: sign in, save a public draft branch, explicitly review and confirm publication, check deployment status, and sign out. Cancelled sign-in preserves local work. Nothing in these tests writes to GitHub. GitHub drafts remain public. The owner explicitly authorized this hierarchy fix and deployment as the default editor. Rollout still uses the existing protected pull-request, validation and Pages flow.

## Verification

- 27 Node tests and 56 browser tests passed, including the public site, old form, visual editor, security contracts, resume replacement, and the new forms interface.
- All 17 original entries, 149 media records, 10 resources, and stable IDs retained. Saving the unchanged forms reproduces the original content exactly.
- Tests cover all four blank templates, existing filled fields, save/reload, unfinished backup recovery and publication rejection, direct/invalid/interrupted uploads, alt/caption/credit preservation, image reuse, galleries, nested content, entry/role ordering, removal/Undo, error focus across tabs and nested groups, safe links, contact fields, concurrent drafts, repeated navigation, phone overflow, and keyboard dialogs.
- Two consecutive builds produced identical bytes for all 203 output files. All 175 public source/content/asset files checked against `origin/main` are unchanged. The existing public-page screenshot parity tests passed on desktop and phone.
- Original resume SHA-256: `51ad284d3934b12f9d91c6f88acfa9979b313e1e49cc371620e395d61f06a025`.

Local evidence: `.local/forms-build-evidence.json`. Review screenshots: `.local/forms-editor-desktop.png`, `.local/forms-job-form.png`, `.local/forms-job-phone.png`, `.local/forms-image-upload.png`, and `.local/forms-preview-desktop.png`.
