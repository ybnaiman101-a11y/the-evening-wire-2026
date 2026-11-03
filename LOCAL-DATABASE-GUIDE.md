# THE EVENING WIRE — New local database + owner controls

This is a **new** database, not a recovery of Render's historical accounts. Your original site design and main app remain.

## First run on your Windows computer
1. Stop any previous black window running THE EVENING WIRE.
2. Download the `windows-local-database` branch from GitHub as a ZIP and **Extract All**.
3. In the extracted folder, double-click `START-NEW-DATABASE.cmd`.
4. First run installs the embedded PGlite PostgreSQL-compatible engine. An internet connection is needed for this initial software installation.
5. On first run, the launcher automatically generates a strong, unique owner password **on your computer**. No typing is necessary. It shows the password only once and pauses so you can copy it into a trusted password manager or write it down in a secure place. **Do not screenshot or share it.**
6. When you have saved that password, press any key in the black window to start the site.
7. Keep the black window open and visit **http://127.0.0.1:3000** in Chrome.

This creates the database at `private-data/pglite` in the website folder. Your owner password is saved only as its SHA-256 digest at `private-data/owner-admin.sha256`; the actual password is shown only once. If you lose it, do not delete your database—recover access with a separate, explicit owner credential rotation process. If the database is empty, registration starts with zero members. The new database persists when you close and restart the application.

## Your administrator access
- Go to **Races Called** or **Members / Login → Owner Admin**.
- Enter the unique **owner password** that Step 5 generated on your computer.
- Only this separately authenticated owner session can publish or retract editorial race calls, send election updates, view the private member directory, or enter official final results.
- To participate as a normal reader, you may separately create a member account in **Members / Login**.
- Never share the owner password. Your friends should register as ordinary members, not administrators.

## Important security limits
- This setup **binds to 127.0.0.1 only** and is intended for the owner on this computer. It is **not accessible to friends from their homes or the Internet**. Don't forward TCP port 3000 or post this URL publicly.
- The old deceptive-site warning remains unresolved. Hosting a new public URL before the warning is investigated and security weaknesses are remedied is not an appropriate next step.
- Browsers use HTTP on loopback for the private test only. Public member logins require HTTPS and an independent security review. The existing four-digit PIN design warrants additional hardening before public launch.
- PGlite uses a single embedded connection; it is suited for local personal testing, not a substitute for a properly managed multi-user production database.
- Third-party feed availability and licensed AP result integration are independent of database installation. Do not assume election results are connected.

## Backups and updates
1. Stop the black server window **before** copying any database files.
2. Run `BACKUP-LOCAL-DATABASE.cmd` to create a ZIP in `backups/`.
3. Treat backups as private: they contain member email addresses and private password hashes.
4. If you download a later website ZIP, **move or copy the entire `private-data` directory** from your old extracted folder into the new folder **while both servers are stopped**, or the new version will appear empty.
5. Never upload `private-data`, `backups` or any administrator secret to GitHub or a public website.

## Architecture
- The existing `server.mjs` remains the Node.js web server.
- `start-local.mjs` sets localhost-only configuration and reads your owner hash.
- `local-db-pool.mjs` transparently uses the embedded PGlite engine for local mode and the existing `pg` pool for remote mode.
- Database data is stored on disk with PostgreSQL-compatible SQL support. No remote database account is required.

`START-ON-HOME-WIFI.cmd` is kept as a **read-only**, no-login mode. Do not use it for private accounts or writing into the database.
