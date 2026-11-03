# THE EVENING WIRE — Koyeb Recovery (staging preparation)

**Status: Source prepared for a private security-reviewed staging deployment, not publicly launched.** The previous provider suspended the site, and a deceptive-site / browser warning remains to be investigated. Do not use a new host or domain to circumvent an active browser or provider security determination.

## What is preserved
- Original frontend and newsroom layout in `public/`, unchanged.
- Existing Node server, news feed scanner, administrative calls, reader accounts, Reaction Hub, site updates, election dashboards, historical datasets and results adapters.
- Original `main` branch unchanged.
- This branch has a Node 22 production `Dockerfile`, running the same server via `node server.mjs`.
- A successful startup does not establish that feeds or the existing member database have been restored.

## Proposed Koyeb setup (after security clearance for hosting)
- Connect GitHub repository `ybnaiman101-a11y/the-evening-wire-2026` and branch `koyeb-recovery-prep` under Create Web Service.
- Choose Dockerfile builder, root Dockerfile, run one instance, expose port **8080**, and route `/` to 8080.
- Set `NODE_ENV=production` and `PORT=8080`. Do not enable automatic public deployment until security review is complete.
- Check `/health` and all major workflows after provisioning. This website requires a continuously running Node web service; static hosting alone will not retain the features.

## Data and secrets
- The Git repository does **not** contain the original PostgreSQL member accounts, editorial calls, reactions, administrator sessions, prediction entries, or user traffic records.
- Recover those records from an authenticated original database backup or provider export. Do not re-create fictitious member data or reset original passwords.
- Provision a managed PostgreSQL database and restore the data privately. Configure `DATABASE_URL` as a secret. Where required, configure `PG_CA_CERT` to verify database TLS, as implemented in `postgres-tls.mjs`. Do not use insecure `rejectUnauthorized: false`.
- Store `EW_ADMIN_PASSWORD_SHA256`, optional `REACTION_ADMIN_TOKEN`, and any properly licensed `AP_ELECTIONS_API_KEY`, election feed tokens/URLs in the hosting secret manager only, never in Git or chat.
- Verify data integrity and permissions with a real staging database. No API feed is assumed licensed or connected merely because its integration code is present.

## Safety verification before publishing
1. Identify and remediate the root cause of the earlier deceptive-site warning, including possible login page confusion, redirects, links, scripts, site naming, and any abusive compromise. Confirm provider policy allows a corrected version.
2. Request relevant Safe Browsing / Search Console review and provider clarification. A new URL cannot substitute for remediation.
3. Run the source repository CI syntax and TLS tests; independently validate runtime authentication, member registration, calls, reaction persistence, election results and rate limiting.
4. Confirm HTTPS, PostgreSQL backup/restore, administrator isolation, no public reader email leakage, and licensing/attribution of syndicated sources.
5. Enable public access only after proper clearance and verification.

Official Koyeb docs: https://www.koyeb.com/docs/build-and-deploy
