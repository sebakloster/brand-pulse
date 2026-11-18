# Brand Pulse

Brand Pulse watches Reddit for mentions of your brands. For each brand it finds what people are saying, works out how they feel, decides what needs attention and drafts a reply when one makes sense. A person always reviews and posts replies; nothing is posted automatically.

**Live demo:** https://brand-pulse-smoky.vercel.app (password protected)

## What it does

- **Find:** searches Reddit for each brand's search terms, every few hours.
- **Feel:** marks each mention positive, neutral or negative.
- **Prioritize:** sorts mentions into urgent, today, when you can and FYI, with a one-line reason for each.
- **Draft:** writes a short reply in the brand's voice, only when replying is the right move.
- **Alert:** emails a daily digest, plus an instant email when a thread starts blowing up.

## How a check works

Every check, automatic or manual, runs the same steps. The free steps run first, so the AI only sees what's worth paying for.

```
Reddit → Scrape → Save → Rules → Relevance → Triage → Spike check → Draft → Inbox + email
                         (code)     (AI)       (AI)      (code)      (AI)
```

1. **Scrape.** Apify searches Reddit for new posts and comments since the last check (14 days back on the first check), plus up to 50 comments per post for context.
2. **Save.** Everything is stored as it arrived. Each Reddit item is saved once, so reading it again never creates duplicates.
3. **Rules.** Plain code drops obvious noise: bots, ignored subreddits, deleted posts and phrases that mean something else.
4. **Relevance (AI).** A small, cheap model checks whether each remaining mention is really about the brand.
5. **Triage (AI).** A stronger model reads each thread and returns the feeling, urgency, next step (reply, send to a team, watch or ignore) and a reason.
6. **Spike check.** Code compares how fast a thread is getting comments with the brand's usual rate. A fast thread gets flagged and triggers an instant email.
7. **Draft (AI).** Only mentions marked "reply" get a draft, and never in a thread that's blowing up.

Results show up in each brand's inbox, where you can edit a draft, copy it to Reddit and mark it done.

## Architecture

One Next.js app on Vercel with a Postgres database.

- **Pages only read from the database.** The heavy work runs in a background job, `/api/tick`, which Vercel Cron calls every 15 minutes.
- **The job is safe to repeat.** Each step picks up whatever is still pending. If a run is cut short, the next one continues, and a lock stops two runs from overlapping.
- **"Check Reddit now"** starts a scrape and returns right away. A small popup shows progress.
- **`/api/digest`** runs hourly and sends the daily email once, at the configured local time.
- **One shared password** protects the app.

**Stack:** Next.js 16 · TypeScript · HeroUI v3 · Tailwind CSS v4 · Neon Postgres + Drizzle · Anthropic SDK · Apify · Resend · Vercel · Vitest

## Run it locally

You need Node 22+ and a Postgres database. No API keys are needed to try it: the app replays a saved Reddit dataset.

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL, APP_PASSWORD, SESSION_SECRET, CRON_SECRET
npm run db:migrate
npm run ingest:fixture         # load the saved dataset
npm run dev                    # http://localhost:3000
```

Optional keys:

| Variable | Turns on |
|---|---|
| `ANTHROPIC_API_KEY` | Relevance, triage and drafts (`npm run tick` processes the data) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Daily digest and spike emails |
| `APIFY_TOKEN` + `REDDIT_SOURCE=apify` | Live Reddit checks instead of the saved dataset |

## Useful scripts

| Command | What it does |
|---|---|
| `npm test` · `npm run typecheck` · `npm run lint` | Tests and checks |
| `npm run tick` | Run the background job locally until nothing is pending |
| `npm run eval` | Score the AI against the hand-labeled mentions |
| `npm run demo:spike [-- --clear]` | Add or remove a simulated spike (labeled "demo") |
| `npm run reset:ai` | Re-run the AI steps after a prompt change |
| `npm run live:test` | One small live Apify run |

## Project layout

```
src/app/            pages, server actions and API routes
src/components/     UI components
src/db/             database schema
src/lib/pipeline/   rules, relevance, triage, spikes and the background job
src/lib/llm/        Claude client and prompts
src/lib/drafts/     reply drafts and tone checks
src/lib/email/      digest and alert emails
src/lib/reddit/     data sources and validation
fixture/            saved Reddit dataset for the demo, tests and evals
evals/              hand-labeled mentions and results
```
