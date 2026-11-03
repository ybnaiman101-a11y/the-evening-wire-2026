# THE EVENING WIRE — 2026 Election Results Connectors

## Install without losing members

This branch carries the same member database and owner role as the previous local edition.

**Recommended:** Stop the black server window, download the `live-results-2026` GitHub branch ZIP, choose **Extract All**, open the extracted folder and double-click `INSTALL-LIVE-RESULTS.cmd`. It finds your existing website, checks for the owner-password file, requests a YES confirmation, backs up the original code, and installs **only** three code files (`server.mjs`, `public/index.html`, `live-results.mjs`). Your `private-data` directory is not copied, overwritten or deleted. When prompted type `START` to relaunch.

If the updater reports multiple websites, select the one with your actual member accounts and most recent database. If there are none, copy your existing website folder location in File Explorer using Ctrl+L then Ctrl+C and paste it into the updater.

## Feed coverage and limitations

- **Open America:** Public API, House/Senate/Governor; 22-state coverage at publication. Missing state != zero. 60s polling with backoff before counting; https://openamerica.io/elections/api/.
- **The People's Tally:** Free CC BY 4.0 `/data/results.json` at 90s intervals, attribution and links; https://thepeoplestally.com/open-data/.
- **Arizona official results JSON:** The 2026 Arizona Secretary of State official media export, 120s intervals. Results appear only once published by Arizona (announced after 8pm local time November 3); https://azsos.gov/press.
- **Ohio official source:** Link to https://liveresults.ohiosos.gov/Home/Index. The state advertises NIST XML every three minutes, but an exact stable XML URL could not be verified. This version links to Ohio directly and obtains Ohio numerical vote totals via the other supported feeds. It does **not** falsely claim a direct Ohio XML machine connection.
- **AP Elections API:** An AP v3 connector exists and is included in the results merge, but requires a purchased/licensed API key. A live public AP connection is **not** active until the owner separately supplies a key and is authorized to display results. https://developer.ap.org/ap-elections-api/.
- No provider is guaranteed to cover every race or every jurisdiction; source-specific coverage is always reported.

Every result shows credited source, candidate vote counts, percentages, last source timestamp, precinct reporting when provided, and whether source data is stale. The same race is shown once using a defined source priority (Arizona direct, licensed AP, Open America, People's Tally) with fresher updates preferred.

**Absolutely no winner flags or race calls** are imported from any feed. Only your owner-authenticated admin controls may publish editorial race calls. Reported totals are unofficial until certified.

## Optional AP key

If AP has granted you the Elections API license, create a text file in the private `private-data` folder named `ap-api-key.txt` containing ONLY your key. The updated local launcher reads the file at startup. **Never share your key, put it in a screenshot or upload it to GitHub.** If your existing API contract does not authorize redistribution to site visitors, obtain approval first.

## Viewing the results

Open http://127.0.0.1:3000. The Headquarters page and Senate/House/Governor tabs include the Live Vote Totals board. Click a race to see vote counts and the original data source. A separate endpoint `/api/live-results` reports provider status and numerical data for diagnostics.

Your local PC must be powered on, connected to the internet, and keep the black server window open to poll external feeds. **This URL is not a public website**; do not expose local port 3000 to the internet. A separately hardened HTTPS deployment is needed before friends can view it remotely.
