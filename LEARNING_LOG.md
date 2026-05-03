# Learning Log
## 2026-05-03 — Phase 1: Shared schema and logger

**What:** Added the shared D1 `hits` schema and reusable `logHit()` module for all honeypot Workers.

**Why:** A single shared database makes the dashboard much simpler because every honeypot writes the same row shape. The logger captures request metadata, Cloudflare enrichment, headers, body preview, attempted credentials, and scanner user-agent detection while swallowing D1 failures so logging never breaks the bait response.

**Interview hook:** I designed the honeypot network around a shared event model so independent Workers could act like separate exposed services while still feeding one centralized security analytics dashboard.

## 2026-05-03 — Phase 2: Simple bait Workers

**What:** Added the `fake-env` and `fake-api-keys` Workers with believable exposed-file and exposed-key responses.

**Why:** These are the simplest honeypots because they do not need forms or static assets. Building them first proves the repeated Worker pattern: route request, return safe bait content, and log the hit asynchronously through the shared D1 logger.

**Interview hook:** I started with low-complexity honeypots to validate the shared logging architecture before adding credential-capture flows and the analytics dashboard.

## 2026-05-03 — Phase 3: Credential-capture honeypots

**What:** Added WordPress-style and phpMyAdmin-style login Workers that record attempted usernames and passwords.

**Why:** Credential-capture routes create more interesting security telemetry than passive file exposure because scanner and bot traffic often submits common username/password combinations. The pages are Worker-rendered instead of static assets so every page view and form submission reliably passes through logging.

**Interview hook:** I built credential-focused honeypots that look like common internet-exposed admin surfaces while keeping them safe, stateless, and unable to execute or forward attacker input.
