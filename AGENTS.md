# Repository Agent Instructions

You are working in a learning-focused codebase. The human collaborator (Jack) is a CS junior who is building this project to learn it deeply enough to discuss every line of code in technical interviews. Optimize for understanding over speed.

The development environment is Windows. Jack is using either WSL (Ubuntu) or PowerShell as his shell. Unless told otherwise, assume WSL/bash. If a command is platform-sensitive (file paths, clipboard, env vars), provide the bash version and note the PowerShell equivalent.

## Operating principles

1. **Before writing code, explain.** When starting a new file, feature, or significant change, write a 2-4 sentence explanation in chat covering: what you're about to build, why this approach, and how it connects to the rest of the system. Then write the code.

2. **Append to LEARNING_LOG.md.** After completing each meaningful unit of work (a new file, a new feature, a non-trivial refactor), append a dated entry to `LEARNING_LOG.md` with:
   - **What:** one sentence describing what changed.
   - **Why:** the technical reasoning, including alternatives you considered and rejected.
   - **Interview hook:** one sentence Jack can use if asked about this in an interview.

   Keep entries concise (under 8 lines each). Do not repeat content already in the log.

3. **Teach the primitives, not just the code.** When using a Cloudflare-specific concept for the first time in this repo (Workers, static assets, D1, the `request.cf` object, `run_worker_first`, bindings, wrangler routes), pause and explain the primitive in 2-3 sentences in chat before using it.

4. **Respect the medium leash.** You may edit files freely without asking. You must ask before running any shell command. When asking, state what the command does and what you expect to happen.

5. **Source of truth is PRD.md.** If a request conflicts with PRD.md, surface the conflict and ask. Do not silently expand scope. If PRD.md is ambiguous, ask one focused question rather than guessing.

6. **No invented complexity.** Do not add abstractions, frameworks, build tools, or dependencies that PRD.md does not require. Vanilla HTML + Chart.js + a Worker is the target. If you find yourself reaching for React, Vite, Tailwind, an ORM, etc., stop and ask first.

## Stack constraints

- **Runtime:** Cloudflare Workers (free plan).
- **Frontend hosting:** Workers + Static Assets (the `[assets]` block in `wrangler.jsonc` with a `directory`). Do NOT use Cloudflare Pages.
- **Database:** Cloudflare D1.
- **Language:** TypeScript for Worker code, vanilla HTML/CSS/JS for frontends.
- **Charts:** Chart.js from CDN.
- **Maps (honeypot project only):** Leaflet from CDN.
- **Deployment URL:** `*.workers.dev` subdomains, not custom domains.
- **Compatibility date:** today's date when scaffolding `wrangler.jsonc`.

## Code style

- Prefer clarity over cleverness. Jack must be able to read every line and explain it.
- Comment any non-obvious line with WHY, not what.
- Use named functions over anonymous ones for anything longer than a one-liner.
- Group related logic into clearly named modules; do not split prematurely.
- TypeScript: no `any` unless interfacing with `request.cf`, which is fine to cast.

## Git workflow

- You may run `git add` and `git commit` after a phase is complete, but only after Jack has reviewed the diff.
- Always run `git diff --stat` and summarize the changes before committing.
- Use commit message format: `phase N: <short description>` for phase commits, `fix: <description>` for bug fixes, `docs: <description>` for documentation.
- NEVER run `git push`. Jack pushes manually.
- NEVER run `git reset --hard`, `git rebase`, or any destructive operation without explicit confirmation in chat.

## Definition of done for any task

A task is done when:
1. The code is written and works locally with `wrangler dev`.
2. `LEARNING_LOG.md` has been updated.
3. You have explained, in chat, what was built and what to verify manually.
4. You have proposed the next task from PRD.md.

## Things you must never do

- Use Cloudflare Pages.
- Hardcode secrets (database IDs go in `wrangler.jsonc`, which is fine; API keys, if ever needed, go in `.dev.vars` and via `wrangler secret put`).
- Add npm packages without explaining the tradeoff.
- Skip the LEARNING_LOG entry to "save time."
- Tell Jack a feature works without telling him exactly how to verify it.

## Interview-readiness checklist

This repo is interview-ready when, in addition to working code:
- LEARNING_LOG.md has an entry for every significant component.
- README.md explains the architecture in plain English with one diagram.
- Jack has run the project end-to-end at least twice and can demo it from a cold start.