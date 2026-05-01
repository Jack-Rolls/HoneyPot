# PRD: Cloudflare Workers Honeypot Network

## What we're building

A small deception network of four independent Cloudflare Workers, each impersonating a commonly-targeted vulnerable service. Every visitor gets logged to a shared D1 database with full enrichment from Cloudflare's `request.cf` object (ASN, geolocation, user agent, headers, attempted credentials). A separate dashboard Worker visualizes the captured data with charts, a geographic map, and a real-time activity feed.

## Why it exists

Resume project for a Cloudflare Security Engineering internship. Differentiator: it captures real internet attacker traffic. Within days of deployment it will accumulate genuine scanner / botnet / credential-stuffing data, providing real numbers for the resume bullet and a live demo for interviews.

## Architecture

Five Workers + one shared D1 database (`honey-db`):

- **`fake-admin`** — fake WordPress login at `fake-admin.<subdomain>.workers.dev`.
- **`fake-env`** — fake exposed `.env` and `.git/config` files at `fake-env.<subdomain>.workers.dev`.
- **`fake-api-keys`** — fake API key listing endpoint at `fake-api-keys.<subdomain>.workers.dev`.
- **`fake-phpmyadmin`** — fake phpMyAdmin login at `fake-phpmyadmin.<subdomain>.workers.dev`.
- **`honey-dashboard`** — dashboard with charts, map, and feed at `honey-dashboard.<subdomain>.workers.dev`.

All five Workers bind to the same D1 database.

## Shared logging module

A single `logHit()` function lives in `shared/logger.ts`. It is copied (not imported across project boundaries — Workers don't share code that way without packaging) into each honeypot Worker's `src/` directory. It captures every request to D1.

Fields captured: timestamp, honeypot name, HTTP method, full path+query, client IP (`cf-connecting-ip`), ASN, ASN org, country, region, city, latitude, longitude, user agent, full headers JSON, body preview, attempted username, attempted password, `is_known_scanner` boolean (regex-match user agent against a list of known scanner UAs: masscan, nmap, zgrab, shodan, censys, nuclei, sqlmap, nikto, gobuster, curl, wget, python-requests, go-http-client).

Logging uses `ctx.waitUntil` so honeypot responses are not delayed. If the D1 write fails, swallow the error — never let logging break the bait response.

## Honeypot designs

Each honeypot must be **believable enough that automated scanners interact with it**. That means HTTP responses must look right: correct content-type, plausible HTML structure, plausible status codes. Do not include any text identifying these as honeypots in the served content.

### `fake-admin`

- Static HTML at `/` mimicking a standard WordPress login form (fields: `log`, `pwd`; action `/wp-login.php`).
- Worker handles POST to `/wp-login.php`: extract username/password from form data, log via `logHit()`, return generic "incorrect username or password" HTML so scanners keep trying.
- Worker should also accept and log requests to `/wp-admin/`, `/xmlrpc.php`, `/wp-config.php` with appropriate-looking responses.

### `fake-env`

- Pure-Worker, no static assets needed.
- Routes:
  - `/.env` → returns plaintext fake env file with believable-but-inert credentials. Use AWS's documented example access keys (`AKIAIOSFODNN7EXAMPLE` etc.) and obviously-fake markers in JWT-like keys.
  - `/.git/config` → returns plaintext fake git config pointing at a fake internal repo.
  - Anything else → 404.
- All requests logged.

### `fake-api-keys`

- Pure-Worker.
- Returns JSON listing fake API keys with fake `last_used` timestamps. Looks like an exposed admin endpoint.
- All requests logged.

### `fake-phpmyadmin`

- Same pattern as `fake-admin` but with phpMyAdmin login styling.
- Form fields: `pma_username`, `pma_password`, action `/index.php?route=/`.
- Build the HTML/CSS by eye to resemble phpMyAdmin's login. Do NOT copy phpMyAdmin source code — recreate the look from scratch.
- Worker logs credentials and returns a generic phpMyAdmin-style failure page.

## Dashboard Worker (`honey-dashboard`)

### API routes

- `GET /api/overview` — total hits, total known-scanner hits, breakdown by honeypot, top countries, top ASN orgs, top 20 attempted passwords, top 20 attempted usernames, recent 50 hits.
- `GET /api/map` — coordinates for the map: `(lat, lon, country, count)` aggregated rows where `latitude IS NOT NULL`.

`run_worker_first` set to `["/api/*"]`.

### Frontend (vanilla HTML, Chart.js, Leaflet)

Sections:

1. **Headline stats** — total hits, known-scanner percentage, hits in last 24h.
2. **Hits by honeypot** — bar chart.
3. **Top attacker countries** — bar chart.
4. **Top ASN orgs** — table.
5. **Top attempted passwords** — table (most popular at top, with attempt count).
6. **Top attempted usernames** — table.
7. **Geographic map** — Leaflet map with circle markers sized by hit count per location.
8. **Recent activity feed** — last 50 hits, columns: time, honeypot, method, path, IP, country, ASN org, user agent (truncated). Auto-refresh every 5 seconds.

## Data model

```sql
CREATE TABLE hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  honeypot TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  client_ip TEXT,
  asn INTEGER,
  asn_org TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  user_agent TEXT,
  headers TEXT,                  -- JSON
  body TEXT,
  attempted_username TEXT,
  attempted_password TEXT,
  is_known_scanner INTEGER       -- 0 or 1
);
CREATE INDEX idx_hits_ts ON hits(timestamp DESC);
CREATE INDEX idx_hits_honeypot ON hits(honeypot);
CREATE INDEX idx_hits_asn ON hits(asn);
CREATE INDEX idx_hits_country ON hits(country);
```

## Optional Workers AI enhancement

If, after the core build is done, time allows: add a `GET /api/insights` endpoint to the dashboard Worker that uses Workers AI's free Llama model (`@cf/meta/llama-3.1-8b-instruct`) to generate a one-paragraph natural-language summary of the last 24 hours of activity. Render this as a card at the top of the dashboard. This is OPTIONAL — only do it after everything else works and is committed.

## Constraints

- Cloudflare Workers free plan only.
- Workers + Static Assets, NOT Pages.
- `.workers.dev` subdomains.
- TypeScript for Workers, vanilla HTML/JS for frontends.
- Honeypots must be safe: stateless, never proxy traffic anywhere, never relay.

## Ethics & safety

The honeypots must not:

- Proxy or forward traffic to any other host.
- Execute attacker-supplied input.
- Return content that would help an attacker (no real credentials, no working API keys, no exploitable redirects).
- Be left running unattended after Jack stops using this for interviews. Add a note to README about how to wind it down (`wrangler delete <worker>`).

## Demo script (must work end to end)

1. Open `honey-dashboard.<subdomain>.workers.dev` — dashboard loads with whatever data has been collected so far.
2. In a second tab, manually visit each honeypot URL once. Submit a fake credential to `fake-admin` and `fake-phpmyadmin`. Hit `fake-env/.env` and `fake-api-keys`.
3. Wait 10 seconds, refresh dashboard — the manual visits appear in the recent activity feed; the map gains a marker; the password/username tables show your test entries.
4. Bonus: after a few days of passive collection, dashboard shows real attacker data with non-trivial counts.

If steps 1-3 fail, the project is not done. Step 4 is what makes the project memorable in interviews.