# THE EVENING WIRE — Northflank recovery staging

**Status: Preparation only.** Previous browser deceptive-site warning and provider suspension must be investigated and resolved. Do not publish the same unreviewed application to evade an existing safety warning.

This branch retains the original website and application code. The `Dockerfile` builds the existing Node.js 22 application with no redesign.

## Prepare restricted staging on Northflank
1. Sign in at https://app.northflank.com and link GitHub.
2. Create a project, then create a **combined** service.
3. Repository: `ybnaiman101-a11y/the-evening-wire-2026`; branch: `northflank-recovery-prep`.
4. Build: Dockerfile, with `/Dockerfile` at repository root.
5. Runtime: `NODE_ENV=production`, `PORT=8080`. Dockerfile exposes port 8080.
6. For initial security tests, avoid a public port/domain. Use restricted internal access, and only deploy after confirming Northflank allows recovery/staging.
7. Check `/health` in the restricted environment. Note: a healthy response is not proof that member accounts or data feeds are functioning.
8. Disable continuous deployment until security review, data restoration and functional tests pass.

## Database and account restoration
- Historic member accounts, password hashes, reactions, admin calls, updates and traffic data live in the original PostgreSQL database, not GitHub.
- Recover an authenticated PostgreSQL backup/export from the original provider; do not fabricate or overwrite old user records.
- Provision a managed PostgreSQL instance with TLS, and restore the database privately.
- Pass `DATABASE_URL` securely as a Northflank runtime secret. This code validates PostgreSQL TLS certificates, optionally using `PG_CA_CERT` to supply the provider's trusted CA chain.
- Set `EW_ADMIN_PASSWORD_SHA256` and other licensed integration secrets (if applicable) in private config, never in repository, ticket or chat.
- Verify account login, admin authorization, race calls, reaction persistence, news feeds, current election data licensing, and backups.

## Mandatory security remediation before public release
1. Investigate the previous browser deceptive-site classification and hosting suspension; inspect the original reports and inspect login, scripts, link destinations, redirects and dependency vulnerabilities.
2. Fix any issues, confirm hosting terms permit the reviewed site, and request relevant reconsideration/review.
3. Confirm HTTPS, restrictive admin privileges, data security and third-party attribution.
4. Only after approval and data validation, enable a public endpoint.

References:
- https://northflank.com/docs/v1/application/getting-started/build-and-deploy-your-code
- https://northflank.com/docs/v1/application/databases-and-persistence/deploy-databases-on-northflank/deploy-postgresql-on-northflank
