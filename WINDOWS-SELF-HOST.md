# THE EVENING WIRE — Run the original website on your own Windows PC

**Purpose:** Keep the original election newsroom website on your own equipment instead of paying Render, Railway, Heroku or another application-hosting company.

The original website source and design are preserved in `public/`, with its original Node.js server and supporting code at the repository root. This branch adds Windows launch scripts and a read-only preview safeguard. It does **not** migrate your old PostgreSQL database, automatically clear a deceptive-site warning, or put the website on the public internet.

## 1. Run it on your own computer

1. Download this branch from GitHub by choosing **Code > Download ZIP**; extract the ZIP into a folder on your Windows PC.
2. Install Node.js LTS from https://nodejs.org/ if it isn't already installed.
3. Double-click **START-ON-MY-COMPUTER.cmd**. You can inspect the plain-text script before running it.
4. Open **http://127.0.0.1:3000** in a browser on that PC.
5. Keep the Command Prompt window open. Closing it shuts down the website.

This is a **read-only preview**: login, posting and admin changes are intentionally disabled to avoid accepting credentials on an unreviewed test site. It may show incomplete or stale news if remote sources are unavailable.

## 2. Can friends see it without a hosting provider?

**Yes, on the same home Wi-Fi, for read-only testing:**
- Double-click **START-ON-HOME-WIFI.cmd**.
- Run `ipconfig` in another Command Prompt and find your computer's private IPv4 address (often `192.168.x.x` or `10.x.x.x`).
- Friends on that same trusted local network can visit `http://YOUR-PC-LOCAL-IP:3000`, if Windows Firewall allows inbound connections on TCP 3000 for **private** networks.
- Do **not** forward port 3000 on your router or expose this unencrypted preview to the internet. Do not let anyone enter passwords or personal information in preview mode.

**Friends outside your home** require additional infrastructure, even when your PC is the only web server: an internet connection with reachable public IP, a secure router/firewall configuration, HTTPS with a trusted certificate, a stable address/domain or DNS method, and often a reverse proxy. If your ISP uses carrier-grade NAT, direct inbound access might not be possible without an ISP change or network relay. You may need to pay an ISP or domain registrar, but you do not need a commercial cloud-web-hosting service.

Your PC must be on and running the program while people visit it. Your home upload bandwidth, power, system updates and backup practices affect reliability.

## 3. Before allowing account creation or public election-night traffic

**Do not publish the original unreviewed site or switch hosts merely to work around the prior browser “Deceptive site ahead” warning and Render suspension.** Obtain the source and rationale for those warnings, inspect and correct any unsafe login design, compromised files, redirects, third-party scripts, external links or policy violations, and request review/clearance.

The website contains a member-sign-in system that must be security-tested (including the four-digit PIN login), and a news/results integration that requires correct authorization. Read-only preview protects against accepting credentials but is **not a full security audit**.

The historical PostgreSQL database is **not in the GitHub repository**. It contained member records, password hashes, sessions, reactions, race calls, updates and prediction entries. Restore a verified backup from the previous database provider, not fabricated data. A real server setup needs a PostgreSQL installation with TLS configured securely, a secret `DATABASE_URL`, administrator credentials and backups. Never put credentials into GitHub, screenshots, or chats.

For a public self-hosted setup after security approval, a sensible architecture is:

`Internet visitors -> router TCP 443 -> HTTPS reverse proxy (e.g. Caddy on your PC) -> Node.js bound to 127.0.0.1:3000 -> local PostgreSQL`

- Forward only **TCP 443** (and TCP 80 if necessary for certificate issuance), to the HTTPS reverse proxy. Never expose PostgreSQL port 5432 or Node's port 3000 directly.
- Configure `HOST=127.0.0.1`, `PORT=3000`, `NODE_ENV=production`, `EW_READ_ONLY_PREVIEW=0` only after the security review is complete, the database is correctly restored and encrypted, and TLS termination is working.
- Ensure the Node process is managed to restart automatically after power loss and is backed up regularly.
- A production reverse proxy must preserve the correct host and forwarding headers; test authentication, sessions, admin access and all app features after configuring it.
- If using a domain and HTTPS certificate, those rely on DNS/certificate services, though they are **not application hosts**. If you literally want no other internet infrastructure provider, a reliably reachable and broadly browser-trusted public website may not be practical.

## 4. Files and verification

- `START-ON-MY-COMPUTER.cmd` — localhost-only read-only preview.
- `START-ON-HOME-WIFI.cmd` — read-only preview on a trusted home network.
- `server.mjs` — original server with `HOST` support and `EW_READ_ONLY_PREVIEW` blocks.
- `.github/workflows/windows-selfhost-checks.yml` — syntax, existing TLS tests, and a local HTTP smoke test.

This branch is preparation for owner-controlled hosting, **not a published or security-approved website**.
