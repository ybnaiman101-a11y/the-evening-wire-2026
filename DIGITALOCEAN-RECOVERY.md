# THE EVENING WIRE — DigitalOcean App Platform recovery guide

**Status: recovery preparation only. Do not publish a replacement while the previous site is under a Chrome "Dangerous site" warning and a hosting restriction whose cause remains unconfirmed.** Investigate the root cause and obtain appropriate clearance/review before releasing a new public address. Do not use a new domain to work around a security warning.

## What is already preserved
- Main application source: `server.mjs` and the related Node.js modules.
- Original website, election headquarters layout, member/login screens and visual assets in `public/`.
- Candidate catalog, electoral maps, historical state/county datasets, race-call UI and reaction UI.
- Server application manifest in `package.json`, with `npm start` launching `node server.mjs`.
- The original main branch is unchanged by this recovery work.
- This branch contains `.do/app.yaml` specifically for DigitalOcean.

## What the source code does NOT preserve
Database-backed members, their authentication hashes/sessions, reactions, election updates, traffic statistics, prediction entries and administrator editorial calls are stored in PostgreSQL, **not in the Git repository**. From the last prior successful Render log check, the active database contained 5 member records and 44 editorial calls, but those counts are historical observations, not proof of a current complete backup.

**Do not create placeholder readers or pretend that historical database records have been restored.** Recover the actual data from Render's original PostgreSQL instance or an authenticated backup. If Render access is restricted, request a secure export through support.

## DigitalOcean preparation (do not publicly deploy yet)
1. Create or access a DigitalOcean account at https://cloud.digitalocean.com and review the provider's acceptable-use and security policies.
2. Authorize DigitalOcean App Platform to access the GitHub repository `ybnaiman101-a11y/the-evening-wire-2026` (read-only where supported).
3. Prepare the code from branch `digitalocean-recovery-prep`; the application specification is in `.do/app.yaml`. Autodeploy is intentionally **disabled**.
4. Use one **Node.js web service**, not a static-only site. The existing server handles feeds, sign-in, reader accounts, admin tools and APIs. Command `npm start`; port `8080` bound on `0.0.0.0`; health check `/health`. Do not publish the URL until the review and data migration are complete.
5. Provision a **managed production PostgreSQL** database in DigitalOcean, or attach an existing appropriately secured database. Do not use a disposable dev database for member accounts. Restrict connections with trusted sources and require TLS.
6. Restore the original PostgreSQL backup *before* turning on registration. A typical administrator-run workflow, using credentials stored securely outside source control:
   - Export: `pg_dump --format=custom --no-owner --no-acl --file=evening-wire.backup "$OLD_DATABASE_URL"`
   - Import into an empty managed database: `pg_restore --no-owner --no-acl --dbname="$NEW_DATABASE_URL" evening-wire.backup`
   - Use a secure workstation; do **not** upload the backup or database URL to a public GitHub repo, a chat, or website.
   - If schemas/roles/extensions differ, validate the import and resolve differences before opening the site.
7. Verify restored row counts *privately*: `SELECT count(*) FROM ew_members;`, `SELECT count(*) FROM ew_editor_sessions;`, and inspect `ew_editor_state` plus tables for reactions/updates/challenge/analytics. Existing sessions may be intentionally invalidated for security; never discard or rotate password hashes as a substitute for data migration.
8. Configure **encrypted runtime** environment variables in DigitalOcean, not in Git:
   - `DATABASE_URL`: production PostgreSQL connection string pointing at the restored database.
   - `EW_ADMIN_PASSWORD_SHA256`: existing owner-password SHA-256 digest; manage as a secret, not plaintext in Git. Rotate securely if compromise is suspected.
   - `REACTION_ADMIN_TOKEN`: only if the old site used it; restore/rotate securely.
   - `AP_ELECTIONS_API_KEY`: only if a properly authorized AP feed integration exists. Never claim AP is connected if it is not.
   - `POLL_INTERVAL_MS`, `AP_RESULTS_POLL_MS`, `ELECTION_RESULTS_FEED_URL`, `ELECTION_RESULTS_FEED_TOKEN` only if relevant and authorized.
   - Confirm database TLS certificate validation: the current code includes permissive PostgreSQL SSL configuration and **must be reviewed/hardened** before enabling member login on the replacement.
9. Conduct a security review of the former phishing classification, forms, redirects, outbound links, dependencies, headers, sign-in flow, rate-limiting and logging. Verify admin authentication remains restricted, email addresses are not publicly displayed, and credential handling is appropriate.
10. Confirm the host's account/acceptable-use approval and resolve Google Safe Browsing/Search Console security issues. After remediation, request a review of any incorrect flag. Do not route visitors to an unreviewed new address to evade the old warning.
11. Test in a restricted environment: `/health`, the homepage, public navigation, all major election tabs, member sign-in, owner-only directory, API calls, editorial calls, live updates, reaction hub, maps, and data integrity. Recheck after restart and redeploy.
12. Only after clearance and validation, enable public ingress, HTTPS, domain and autodeploy if desired.

## Design fidelity and features
The intended approach is an **unmodified reuse of the original frontend and backend code**, not an AI-generated visual imitation. Moving the same source preserves the layouts and features. Exact behavior is only possible when the required production secrets, databases, feeds and services are restored.

## Operations and ownership
- Maintain regular off-site encrypted PostgreSQL backups and a restore drill.
- Keep the site repo private once desired and restrict deployment permissions. GitHub's public/private setting is separate from the `private` flag in `package.json`.
- Do not add API keys to commits. Never paste passwords or DB URLs into support emails.
- Deployment costs depend on service instance size and production database size. Confirm in DigitalOcean before creation.

Useful documentation:
- https://docs.digitalocean.com/products/app-platform/how-to/create-apps/
- https://docs.digitalocean.com/products/app-platform/reference/app-spec/
- https://docs.digitalocean.com/products/app-platform/how-to/manage-databases/
