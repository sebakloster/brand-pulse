# Brand Pulse

Reddit brand monitoring. Finds mentions of a brand on Reddit, shows how people feel and what needs attention (with a reason for each item), and drafts replies in the brand's voice for a person to review and post. Nothing is posted automatically.

## Features

- **Ingestion:** Reddit search (posts, comments, thread context) through a pluggable `RedditSource` (Apify Actor or a saved dataset).
- **Filtering:** free rule filters (bots, blocked subreddits, whole-word match, exclusion phrases, brand communities), then an LLM relevance check.
- **Triage:** per thread: sentiment, intent, risk flags, importance P0–P3, action (reply / route to a team / monitor / ignore) and a one-line reason.
- **Spike detection:** comment velocity against the brand's baseline, computed in code from engagement snapshots.
- **Reply drafts:** only for items worth replying to; versioned voice guide, "say it in your words → Improve", tone checks that re-run while editing.
- **Per-brand inbox:** pick a brand, see what needs attention ("Urgent · Pass to security", "Today · Reply suggested"), open an item, reply or mark it done. Mobile-friendly.
- **Brands:** settings, tracking toggles, "Check Reddit now", recent checks, real cost per brand (scraper + LLM) with a monthly spend guard.
- **Email:** daily digest and instant spike alerts.
- **Evals:** relevance and triage scored against hand-labeled items.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · HeroUI v3 · Drizzle ORM + Postgres (Neon) · Anthropic SDK (Claude Haiku 5.5 for relevance, Sonnet 5.5 for triage and drafts) · Apify · Resend · Vercel (Functions, Cron) · Vitest.

## How it works

```
Vercel Cron (every 15 min) / "Run now"
        │
        ▼
/api/tick   lease lock, 240 s budget; every step is idempotent and resumable
  1. collect finished scraper runs → validate (Zod) → upsert raw items + mentions → snapshots
  2. start runs for brands that are due (spend guard)
  3. rule filters → relevance (batched)
  4. triage, one call per thread (structured outputs, prompt caching)
  5. spike detection → reply drafts → spike alert emails
/api/digest (hourly cron): one digest per local day at the configured hour
```

Pages read from Postgres only; LLM calls happen in the background job or on explicit user actions.

## Getting started

Requirements: Node 22+, a Postgres database.

```bash
npm install
cp .env.example .env.local     # DATABASE_URL, APP_PASSWORD, SESSION_SECRET, CRON_SECRET
npm run db:migrate
npm run ingest:fixture         # load the saved Peloton dataset (no API keys needed)
npm run dev                    # http://localhost:3000
```

Optional keys in `.env.local`:

| Variable | Enables |
|---|---|
| `ANTHROPIC_API_KEY` | Relevance, triage, drafts (`npm run tick` processes the dataset) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Daily digest and spike emails |
| `APIFY_TOKEN` + `REDDIT_SOURCE=apify` | Live Reddit runs (otherwise "Run now" replays the saved dataset) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests |
| `npm run typecheck` · `npm run lint` | Type check and lint |
| `npm run db:generate` · `db:migrate` · `db:seed` | Drizzle migrations and seed |
| `npm run ingest:fixture [-- --reset]` | Ingest the saved dataset and apply rule filters |
| `npm run tick` | Run the background job locally until nothing is pending |
| `npm run eval` | Score relevance and triage against `evals/labels.json` |
| `npm run reset:ai` | Re-run the LLM steps on stored data after a prompt change |
| `npm run demo:spike [-- --clear]` | Add or remove a simulated (labeled) spike |
| `npm run live:test` | One small live Apify run |

## Project structure

```
src/
  app/              pages (brands, brand inbox, mention, insights, settings, login), server actions, API routes
  components/       UI components
  db/               Drizzle schema and client
  lib/
    reddit/         data sources, validation, normalization
    pipeline/       rules, ingest, relevance, triage, runs, spikes, tick, lock
    llm/            Claude client, prompts, pricing, output cleaning
    drafts/         draft generation and tone checks
    email/          digest and alert rendering and sending
    brands/         demo brand config and voice guide
drizzle/            SQL migrations
scripts/            CLI scripts (ingest, tick, eval, seed, …)
evals/              labeled items and results
fixture/            saved Reddit dataset used for demo mode, tests and evals
```
