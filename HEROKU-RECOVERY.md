# THE EVENING WIRE — Heroku recovery preparation

**Prepared branch, not a live deployment.** This branch exists only to test restoring the original application. A prior deceptive-site alert and hosting suspension remain unresolved; the goal is remediation, not avoiding a restriction.

## Preserved site
The original site is in `public/`, and its server and application features are in the root Node.js files. Nothing in the original frontend was redesigned. The original `main` branch is unchanged.

## Hosting configuration
- Platform: Heroku Node.js web dyno (a continuously running application, not static hosting).
- Entrypoint: `Procfile` runs `node server.mjs`.
- Heroku provides `PORT`; the application binds to `0.0.0.0`.
- Health endpoint: `/health`. Its response alone is **not proof** that member sign-in, PostgreSQL, or AP results integration is operating.
- Keep the GitHub branch `heroku-recovery-prep` separate until fully validated.
- No API keys, admin passwords, or connection URLs belong in Git.

## BEFORE enabling public access
1. Identify what triggered the prior Google Safe Browsing deceptive-site alert and the Render account restriction. Inspect any relevant search console security issues, site redirects, outbound links, third-party scripts, login presentation, security reports and Render support decision. Remove issues and request appropriate review/clearance. **Do not use a new hostname to evade a warning or platform policy.**
2. Recover the original PostgreSQL database, preferably an authenticated export from the previous provider or a reliable encrypted backup. Source code does not contain the historical members, password hashes, sessions, race calls, prediction entries, reactions and analytics.
3. Use a managed PostgreSQL service with trusted TLS certificate chain. Heroku Postgres Essential / Advanced use AWS RDS certificates; configure `DATABASE_URL` as a Heroku config var, and if necessary `PG_CA_CERT` with a trusted certificate. This recovery code enforces certificate validation. Do not set `rejectUnauthorized:false` to make the connection pass.
4. Restore **real** database records and validate the tables privately; do not invent members or manually change stored password hashes.
5. Restore `EW_ADMIN_PASSWORD_SHA256` securely via Heroku Config Vars. Restore/rotate `REACTION_ADMIN_TOKEN` if applicable. For election data, configure `AP_ELECTIONS_API_KEY` and feed URLs/tokens only when properly licensed; the presence of source code does not mean AP is connected.
6. Test sign-in, admin-only race calls, updates, Reaction Hub, voting challenge, traffic counts, the news feed, and all election tabs. Test with an isolated/private staging instance, and ensure the public site does not disclose member email addresses or secrets.
7. After the safety review, host approval and secure data restoration, deploy via Heroku dashboard by connecting GitHub repository `ybnaiman101-a11y/the-evening-wire-2026` and branch `heroku-recovery-prep` (disable automatic deploys until validated).
8. Validate HTTPS, domain configuration, fresh backups and security monitoring before public announcement.

## Operational notes
- Paid Heroku dyno and database plans may be required.
- Browser-based Heroku deploys can use `app.json`, but it does **not** automatically attach a database or restore historical user data.
- GitHub CI verifies syntax/basic recovery tests, not hosting approval, third-party feed licensing or the previous warning's root cause.

Official references:
- https://devcenter.heroku.com/articles/github-integration
- https://devcenter.heroku.com/articles/connecting-heroku-postgres
- https://devcenter.heroku.com/articles/heroku-button
