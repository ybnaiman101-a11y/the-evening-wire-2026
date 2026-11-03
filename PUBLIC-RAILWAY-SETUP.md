# THE EVENING WIRE — electionhub2026.com.co

## Important status
The **domain is registered at Cloudflare**, but the website is **not yet deployed**.
This is a safe, deployment-ready code branch, not a public website. The
current local website and its existing `private-data` folder are untouched.

## Secure Railway hosting
1. Connect Railway to your GitHub account and select
   `ybnaiman101-a11y/the-evening-wire-2026` on branch **public-electionhub2026**.
2. In Railway, add a PostgreSQL service (not a public TCP proxy) and connect
   the Node web service with a private `DATABASE_URL` reference. Enable
   Railway database backups.
3. In web service Variables set **NODE_ENV=production**.
   Do NOT set `EW_LOCAL_DATABASE=1`, and do not expose the local PC.
4. On your private Windows computer, run `CREATE-PRIVATE-PUBLIC-LOGIN.cmd`
   from this branch folder. The local `private-data/PUBLIC-ADMIN-CREDENTIALS-KEEP-PRIVATE.txt`
   file includes a newly generated private owner login password and its
   `EW_ADMIN_PASSWORD_SHA256` hash. **Never upload that file, share its value in chat,
   or store it in GitHub.** Enter only the hash in Railway web service Variables.
   You will use the new secret password to log into the public administrator desk.
   The older local owner password must NOT be reused publicly.
5. Set the web service start command `node start-public.mjs` (included in
   railway.toml). The app **refuses to start** if the database is unreachable,
   TLS identity verification fails or the new owner secret hash is absent.
   Review the logs before providing public access.
6. Test using the Railway-provided public `*.up.railway.app` URL, including
   member signup, login, race calls and live feeds. Ensure administrator
   passwords and member account details never appear on public endpoints.
7. Under Railway web service **Settings → Networking → + Custom Domain**,
   add exactly `electionhub2026.com.co`.
8. Railway provides a **CNAME target and TXT verification record**. Open
   Cloudflare → electionhub2026.com.co → DNS Records. Copy the Railway-supplied
   hostnames/values **exactly**; do not invent any destination. Both DNS records
   are necessary; wait for Railway to verify the records and provision HTTPS.
   Configure Cloudflare TLS per Railway's current published instructions.
9. Test https://electionhub2026.com.co from a phone on cellular data.
   Confirm the certificate, working navigation, registration, owner login,
   privacy disclosures and verified live-results source labels.

Sources:
- https://docs.railway.com/networking/domains/working-with-domains
- https://docs.railway.com/databases/postgresql
- https://docs.railway.com/quick-start

## Personal data and database migration
The public site starts with a **new empty PostgreSQL database**. No data from
`private-data/pglite` on your Windows PC has been imported or exposed.
If you want to preserve your existing registered readers or local election
calls, arrange a **separate owner-approved encrypted migration** before the
site accepts public registrations. Do not email or upload the raw PGlite
directory or passwords.

## Security limitations
The GitHub branch includes cookie authentication, security headers, rate limits,
admin-only race calls, and a verified-TLS database preflight. These are
defenses, not proof of safety. Before a broader launch, independently review
the app for vulnerabilities (especially content injection and abuse of
public registrations); review Cloudflare/WAF settings, incident response and
backups, and keep dependencies current. The local site is not replaced.

## Provider coverage
Open America and The People's Tally feeds cover only supported election
offices and states. Arizona direct JSON can reject oversized upstream files.
AP requires a licensed key. Ohio's direct XML connector is not implemented.
Do not represent limited coverage as complete real-time nationwide results.
