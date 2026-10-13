# Website stats

Open **Stats** in the header at `https://www.elidoggart.com/editor/`. It opens over the editor without unloading your draft. The existing GitHub sign-in also unlocks stats. **Back to editor** or Escape returns to editing. Refresh fetches new totals; changing the range shows the last 7, 30 or 90 UTC calendar days, including today.

## What is counted

- Visits: one visible public page load, including reloads. Section switches do not add visits.
- Résumé download clicks: at most one per page load, not proof a file was saved. Direct PDF visits and downloads through a browser's context menu are not counted.
- Work dropdown opens: at most one per dropdown per page load. Closing/reopening does not inflate the count. Automatically expanded deep links are not clicks.
- Sources: known referring websites (LinkedIn, GitHub, Google, Bing, DuckDuckGo), explicitly tagged links, other websites, and direct/unknown. Apps sometimes hide referrers.

Use `https://www.elidoggart.com/l` on LinkedIn. GitHub Pages serves `/l/`, which redirects to `/?utm_source=linkedin`. Other supported explicit tags are `github`, `resume`, `email`, `application`, `google`, `bing`, and `duckduckgo`. Unknown tags become **Other tagged links**; arbitrary query strings and referring URLs are never stored. Other referring domains are grouped as **Other websites**.

These totals are not unique people. No visitor IDs, cookies, local/session storage, fingerprints, IP addresses, full URLs, user agents or individual event records are stored by this feature. Requests necessarily pass through Cloudflare; this description covers the application's stored data. The existing private editor login still uses its short-lived OAuth cookie. Known bots and browser DNT/GPC opt-outs are excluded. Blockers, failed delivery and unrecognized bots mean counts are approximate.

The editor, guide, iframe previews and localhost are excluded. Use `https://www.elidoggart.com/?preview=1` to inspect the live public site without counting that page. Ordinary visits you make to the public site are counted too. There is no persistent owner-tracking cookie.

## Operation

The existing `portfolio-editor-auth` Cloudflare Worker adds public `POST /collect` and private `GET /stats?days=30`. Collection accepts a small allowlisted event body from the exact production origin, writes an atomic daily aggregate to D1, and never gates website navigation or downloads. Public code makes tiny background requests without credentials or referrers. It does not retry ambiguous writes.

`portfolio-stats` is a D1 database in the existing Free account, bound to the Worker as `STATS_DB`. Apply `auth/stats-schema.sql` once (it is idempotent). Its only data is daily action/source/target totals and the collection start time. Database ID: `83f8768e-4f4f-4cb9-9211-06697989c8f1`. Keep Worker invocation logging disabled and do not add request/body logging.

The successful existing OAuth flow issues an encrypted, expiring **stats-only** capability after checking the numeric owner and repository access. This capability cannot write to GitHub. The editor keeps it in memory and sends it only to the configured auth origin. The GitHub token continues to go only to GitHub. Wrong origins, expired capabilities, wrong identities/purposes and OAuth cookies cannot read the dashboard. No new GitHub permissions are required.

Build a single deployable Worker module with `node scripts/build-auth.mjs`. Deploy `.local/portfolio-editor-auth.mjs` to the existing Worker, preserving all existing secret and non-secret bindings, and add `STATS_DB`. Frontend deployment continues through the repository's normal validated pull request / GitHub Pages process. Publish the compatible Worker before enabling the frontend. Older editor versions can still sign in after the Worker update.

Stats failures show an explicit retry/sign-in message rather than invented zeros. Loading, closing, failed requests and expiry do not save, publish or replace the portfolio draft. Cloudflare Free quotas are hard limits; exceeding them can temporarily stop counters, while the GitHub-hosted website keeps working. This is basic aggregate analytics, not abuse-proof accounting or outage-proof delivery.

## Verification

`tests/stats.test.mjs` runs real SQLite schema/upsert/range queries and checks invalid input, bounded bodies, origin restrictions, bot/opt-out exclusion, database failures, OAuth-to-stats capability isolation, expiry, source labeling, preview exclusion and deduplication. Browser tests exercise login, private totals, unsaved drafts, logout, failed reads/retry, empty ranges, mobile layout, expired/cancelled sign-in, keyboard dropdowns, résumé downloads, LinkedIn redirects and preview exclusion in Chromium and WebKit. All traffic in these regression tests is intercepted; it does not contribute to live counters.

Not measured by tests: actual human uniqueness, complete bot detection, blocker coverage, context-menu/direct PDF downloads, and visits before activation. Local verification on 2026-10-13 passed 75 unit checks and all 94 browser tests in each of Chromium and WebKit. Cloudflare Worker version `3cdb733b` was deployed with `STATS_DB` bound and automatic invocation logging still disabled; the live stats endpoint returned 401 for an unauthenticated request from the approved origin. PR #27 passed required checks and deployed frontend revision `77c9ab5`. A live Safari check signed in through the existing GitHub account, opened Stats over the saved draft, followed `/l`, opened Nimbus Current Work and clicked the résumé download. Refresh showed one LinkedIn visit, one résumé click and one correctly labeled work open. These initial counts are verification activity.

The final review also reproduced a sign-in timing defect with a clock advancing one millisecond per read: independently sampled issue/expiry timestamps could exceed the accepted lifetime. Issuance now takes one timestamp and derives expiry from it; the regression verifies both OAuth completion and the maximum eight-hour stats capability. The prior code returned HTTP 400 for that reproduction; the correction returns HTTP 200.
