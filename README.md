# Cloudflare Workers Honeypot Network

A small deception network built on Cloudflare Workers. It deploys four independent honeypot Workers that imitate commonly exposed internet services, logs every request to a shared Cloudflare D1 database, and visualizes the activity in a live dashboard with charts, credential-attempt tables, recent activity, and a map.

## Live demo

- Dashboard: https://honey-dashboard.jackrolls1185.workers.dev
- Fake exposed .env: https://fake-env.jackrolls1185.workers.dev/.env
- Fake API key endpoint: https://fake-api-keys.jackrolls1185.workers.dev
- Fake WordPress-style admin login: https://fake-admin.jackrolls1185.workers.dev
- Fake phpMyAdmin-style login: https://fake-phpmyadmin.jackrolls1185.workers.dev

## Why I built this

I built this project to learn how Cloudflare Workers can be used as lightweight security telemetry collectors at the edge. The goal was not to build a vulnerable app. The goal was to build safe, inert bait services that look realistic enough for scanners and bots to touch, then centralize that traffic into a useful dashboard.

This demonstrates:

- Cloudflare Workers for globally deployed request handling
- Cloudflare D1 for lightweight event storage
- Worker bindings through wrangler.jsonc
- ctx.waitUntil() for non-blocking logging
- Cloudflare request metadata through request.cf
- Vanilla HTML/CSS/JS dashboarding with Chart.js and Leaflet
- Safe honeypot design that never executes or forwards attacker input

## Architecture

Internet scanners / visitors
    |
    |--> fake-env Worker
    |--> fake-api-keys Worker
    |--> fake-admin Worker
    |--> fake-phpmyadmin Worker
              |
              v
        shared logHit()
              |
              v
      Cloudflare D1: honey-db
              ^
              |
      honey-dashboard Worker
              ^
              |
      Dashboard UI: Chart.js + Leaflet

## Workers

### fake-env

Imitates exposed configuration files.

Routes:

- /.env
- /.git/config

The returned values are fake and inert. The AWS keys use documented example-style values and the other secrets are obvious non-working placeholders.

### fake-api-keys

Imitates an exposed internal API key registry endpoint.

It returns JSON that looks like an internal service response, but all keys and webhook URLs are fake/inert.

### fake-admin

Imitates a WordPress-style admin login.

Routes include:

- /
- /wp-login.php
- /wp-admin/
- /xmlrpc.php
- /wp-config.php

POST /wp-login.php extracts attempted log and pwd values and stores them as telemetry.

### fake-phpmyadmin

Imitates a phpMyAdmin-style login.

Routes include:

- /
- /index.php
- /phpmyadmin/
- /phpMyAdmin/

POST /index.php?route=/ extracts attempted pma_username and pma_password values and stores them as telemetry.

### honey-dashboard

Reads from the shared D1 database and exposes:

- GET /api/overview
- GET /api/map

The frontend polls those APIs every 5 seconds and renders total hits, scanner percentage, hits by honeypot, top countries, top ASN organizations, attempted usernames/passwords, recent activity, and a geographic map.

## Data captured

Each hit stores:

- Timestamp
- Honeypot name
- HTTP method
- Path and query string
- Client IP
- ASN and ASN organization
- Country, region, city
- Latitude and longitude when available
- User agent
- Request headers
- Body preview
- Attempted username
- Attempted password
- Known scanner flag

The known-scanner flag is based on user-agent patterns such as curl, wget, nmap, masscan, zgrab, shodan, censys, nuclei, sqlmap, nikto, gobuster, python-requests, and go-http-client.

## Local development

Use WSL Ubuntu.

Apply the schema locally from the dashboard Worker folder:

    cd honey-dashboard
    wrangler d1 execute honey-db --local --persist-to ../.local-state --file=../shared/schema.sql

Run any honeypot locally with shared D1 state:

    cd ../fake-env
    wrangler dev --persist-to ../.local-state

Example test traffic:

    curl -i http://localhost:8787/.env
    curl -i http://localhost:8787/.git/config

Inspect local D1:

    cd ../honey-dashboard
    wrangler d1 execute honey-db --local --persist-to ../.local-state --command="SELECT id, honeypot, method, path FROM hits ORDER BY id DESC LIMIT 10;"

Run the dashboard locally:

    cd honey-dashboard
    wrangler dev --persist-to ../.local-state

Then open:

    http://localhost:8787

## Deployment

Create the remote D1 database:

    cd honey-dashboard
    wrangler d1 create honey-db

Apply the schema:

    wrangler d1 execute honey-db --remote --file=../shared/schema.sql

Deploy all Workers:

    cd ..
    for dir in fake-env fake-api-keys fake-admin fake-phpmyadmin honey-dashboard; do
      echo "===== Deploying $dir ====="
      (cd "$dir" && wrangler deploy)
    done

Verify remote telemetry:

    cd honey-dashboard
    wrangler d1 execute honey-db --remote --command="SELECT id, honeypot, method, path, attempted_username, attempted_password, country, asn_org FROM hits ORDER BY id DESC LIMIT 20;"

## Safety and ethics

This project is intentionally safe:

- It never executes attacker-supplied input.
- It never proxies or forwards traffic to another host.
- It never returns real credentials or real working API keys.
- It only logs requests and returns inert bait responses.
- The dashboard is public for demo purposes, so it should not be used to store sensitive data.
- The honeypots should be wound down after interviews or demo use if they are no longer needed.

## Wind-down commands

To delete the deployed Workers:

    cd fake-env && wrangler delete
    cd ../fake-api-keys && wrangler delete
    cd ../fake-admin && wrangler delete
    cd ../fake-phpmyadmin && wrangler delete
    cd ../honey-dashboard && wrangler delete

To delete the D1 database, use the Cloudflare dashboard or Wrangler’s D1 delete command after confirming the exact database name or ID.

## What I learned

- How to structure multiple Cloudflare Workers around one shared D1 database.
- How to use ctx.waitUntil() so logging does not slow down or break user-facing responses.
- How to safely design honeypots that collect telemetry without executing or forwarding malicious input.
- How Cloudflare request metadata can enrich security events with ASN, geolocation, and client details.
- How to build a lightweight dashboard without adding unnecessary frontend framework complexity.
- How to test multi-Worker systems locally with one shared --persist-to D1 state folder.
