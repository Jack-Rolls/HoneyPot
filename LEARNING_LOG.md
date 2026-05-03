# Learning Log
## 2026-05-03 — Phase 1: Shared schema and logger

**What:** Added the shared D1 `hits` schema and reusable `logHit()` module for all honeypot Workers.

**Why:** A single shared database makes the dashboard much simpler because every honeypot writes the same row shape. The logger captures request metadata, Cloudflare enrichment, headers, body preview, attempted credentials, and scanner user-agent detection while swallowing D1 failures so logging never breaks the bait response.

**Interview hook:** I designed the honeypot network around a shared event model so independent Workers could act like separate exposed services while still feeding one centralized security analytics dashboard.
