# GitHub maintenance review — 13 October 2026

This review supports dependable editing and publishing. It does not add a new publishing service, require another person to approve a solo repository, or expand the editor's GitHub permissions.

| Area | Finding and action |
| --- | --- |
| Main branch | Active ruleset `24894237` requires a PR, up-to-date `validate` from GitHub Actions, and blocks deletion/force pushes. Retained. |
| Human approvals | Zero required reviewers is appropriate for the owner's current workflow. Requiring somebody else would block normal publishing. The editor still confirms publication explicitly. |
| Workflow permissions | Validation/build use `contents: read`; only Pages deployment has `pages: write` and `id-token: write`. No `pull_request_target` execution or broad write token was introduced. Checkout credentials are no longer persisted for later test steps. |
| Action versions | Replaced older Node-runtime Actions with verified official releases pinned to full commit SHAs, with readable version comments. The browser runner uses Ubuntu 24.04 so an automatic runner-image migration does not silently change its rendering environment. |
| Failed checks | Added downloadable screenshots/context for failed UI runs, retained seven days, plus bounded job timeouts. Superseded PR validation runs are cancelled; an active deployment is not cancelled. |
| Publishing versus test examples | Tests previously depended on mutable Nimbus headings and other real content. Editor regression examples now use `tests/fixtures/editor-content.json` and an isolated `.local/browser-dist/` build. Actual portfolio content/assets still receive validation and a separate `dist/` deployment build. A regression verifies the fixture build cannot overwrite it. |
| Dependencies | Exact package versions and lockfile are retained. A fresh `npm audit` on this review date reported zero known vulnerabilities. This is an advisory check, not a security certification. |
| Secrets | A focused tracked-file scan found no common GitHub-token, AWS-access-key or private-key patterns. Inert test credentials are deliberate fixtures. This was not a full history or infrastructure secret audit. |
| Commits and PRs | Keep changes reviewable, summarize the concrete behavior and tests, use normal squash merges and preserve failed-check evidence. Avoid bypassing checks or force-pushing main. |
| Comments | Explain non-obvious constraints: delayed image paint, storage compatibility, exact revision reconciliation and preview races. Avoid comments that merely restate straightforward code. |
| Documentation | Added a useful project README and corrected editor/authentication instructions that still described the completed rollout as pending. Historical setup and review evidence remains labelled as such. |
| Generated files | `node_modules/`, `dist/`, `.local/` and test reports are ignored. The deployment uploads the real build, not the source repository or UI fixture. |
| Cleanup | At inspection, 23 old branch heads exactly matched their merged PR heads. They are optional, recoverable housekeeping, not a source of UI failures. No active draft should be deleted based only on its age or name. |

## Files that should stay

`README.txt` is a published attribution file copied by the build. Legacy HTML/editor routes support existing links. Authentication examples are imported by regression tests. Migration fixtures and earlier review evidence document previous behavior. These files are not dead simply because they are old; broad deletion would create unnecessary risk.

A merged topic branch can be removed after confirming its head still matches the merged PR and no open PR or active draft uses it. GitHub provides [branch deletion and restoration through the PR](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/deleting-and-restoring-branches-in-a-pull-request). Bulk deletion and automatic branch-deletion settings were not enabled during this review.

The workflow changes follow GitHub's [guidance on minimum token permissions and immutable action pins](https://docs.github.com/en/actions/reference/security/secure-use). Pins were resolved from the official Actions repositories; upgrades should continue through reviewed PRs and passing checks. No automatic dependency-PR schedule was enabled.

## Limits

This was a repository and publishing-workflow review. It did not audit Cloudflare account settings, GitHub organization-wide policy, billing, every historical commit, or all transitive upstream code. No secret values were accessed or moved.
