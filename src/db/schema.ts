// Data model.
import {
  pgTable, pgEnum, text, integer, boolean, timestamp, jsonb, real, uuid, index, uniqueIndex,
} from "drizzle-orm/pg-core";

export const mentionKind = pgEnum("mention_kind", ["post", "comment"]);
export const pipelineStatus = pgEnum("pipeline_status", [
  "new", "filtered", "context", "candidate", "irrelevant", "relevant", "triaged", "triage_failed", "invalid",
]);
export const userStatus = pgEnum("user_status", ["open", "discarded", "replied", "handled"]);
export const runStatus = pgEnum("run_status", ["starting", "running", "succeeded", "failed", "timed_out"]);
export const runSource = pgEnum("run_source", ["apify", "fixture"]);
export const importance = pgEnum("importance", ["P0", "P1", "P2", "P3"]);
export const triageAction = pgEnum("triage_action", ["reply", "route", "monitor", "ignore"]);
export const draftStatus = pgEnum("draft_status", ["suggested", "copied", "replied"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  domain: text("domain"),
  description: text("description").notNull().default(""),
  searchTerms: text("search_terms").array().notNull().default([]),
  exclusionTerms: text("exclusion_terms").array().notNull().default([]),
  blockedSubreddits: text("blocked_subreddits").array().notNull().default([]),
  brandSubreddits: text("brand_subreddits").array().notNull().default([]),
  voiceGuide: text("voice_guide").notNull().default(""),
  voiceVersion: integer("voice_version").notNull().default(1),
  neverDo: text("never_do").array().notNull().default([]),
  supportUrl: text("support_url"),
  pollEveryHours: integer("poll_every_hours").notNull().default(6),
  livePollingEnabled: boolean("live_polling_enabled").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  backfillDays: integer("backfill_days").notNull().default(2),
  createdAt: createdAt(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brands.id),
  source: runSource("source").notNull(),
  purpose: text("purpose").notNull().default("search"), // search | snapshot
  apifyRunId: text("apify_run_id"),
  status: runStatus("status").notNull().default("starting"),
  input: jsonb("input"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }),
  itemsCount: integer("items_count"),
  capHit: boolean("cap_hit").notNull().default(false),
  costUsd: real("cost_usd"),
  costDetail: jsonb("cost_detail"), // raw cost fields from Apify, so the number can be audited
  error: text("error"),
  warning: text("warning"), // e.g. a cap was hit, so results may be incomplete
  manual: boolean("manual").notNull().default(false), // "Run now" vs scheduled
}, (t) => [index("runs_brand_status_idx").on(t.brandId, t.status)]);

// Never modified, except text wiped when Reddit shows the item was deleted.
export const rawItems = pgTable("raw_items", {
  redditId: text("reddit_id").primaryKey(),
  runId: uuid("run_id").references(() => runs.id),
  payload: jsonb("payload").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mentions = pgTable("mentions", {
  id: uuid("id").primaryKey().defaultRandom(),
  redditId: text("reddit_id").notNull(), // t3_ / t1_ prefixed
  brandId: uuid("brand_id").notNull().references(() => brands.id),
  kind: mentionKind("kind").notNull(),
  postId: text("post_id").notNull(), // the thread; equals redditId for posts
  parentId: text("parent_id"),
  depth: integer("depth").notNull().default(0),
  subreddit: text("subreddit").notNull(),
  author: text("author"),
  title: text("title"),
  body: text("body"),
  url: text("url"),
  createdAtReddit: timestamp("created_at_reddit", { withTimezone: true }).notNull(),
  score: integer("score"),
  numComments: integer("num_comments"),
  isDirectMatch: boolean("is_direct_match").notNull().default(false),
  limitedContext: boolean("limited_context").notNull().default(false),
  upvoteRatio: real("upvote_ratio"),
  commentsPerHour: real("comments_per_hour"), // from the Actor at fetch time; first-sight spike signal
  pipelineStatus: pipelineStatus("pipeline_status").notNull().default("new"),
  filteredReason: text("filtered_reason"),
  language: text("language"),
  userStatus: userStatus("user_status").notNull().default("open"),
  discardReason: text("discard_reason"),
  followed: boolean("followed").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  isBotLike: boolean("is_bot_like").notNull().default(false),
  aiAttempts: integer("ai_attempts").notNull().default(0), // failed AI calls; stops endless retries
  triageError: text("triage_error"),
  relevanceReason: text("relevance_reason"), // why the model judged it off-brand
  // Spike state, posts only. Computed in code from snapshots.
  spikeActive: boolean("spike_active").notNull().default(false),
  spikeSince: timestamp("spike_since", { withTimezone: true }),
  spikeRate: real("spike_rate"), // comments per hour
  spikeReason: text("spike_reason"),
  spikeNegative: boolean("spike_negative").notNull().default(false),
  spikeSimulated: boolean("spike_simulated").notNull().default(false), // demo only, labeled in the UI
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }), // comment count went up (followed threads)
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // The same Reddit item can mention two tracked brands.
  uniqueIndex("mentions_brand_reddit_idx").on(t.brandId, t.redditId),
  index("mentions_brand_pipeline_idx").on(t.brandId, t.pipelineStatus),
  index("mentions_post_idx").on(t.postId),
]);

export const triage = pgTable("triage", {
  id: uuid("id").primaryKey().defaultRandom(),
  mentionId: uuid("mention_id").notNull().references(() => mentions.id),
  sentiment: integer("sentiment").notNull(), // -2..+2
  topic: text("topic").notNull(),
  intent: text("intent").notNull(),
  riskFlags: text("risk_flags").array().notNull().default([]),
  importance: importance("importance").notNull(),
  action: triageAction("action").notNull(),
  routeTo: text("route_to"),
  reason: text("reason").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("triage_mention_version_idx").on(t.mentionId, t.promptVersion)]);

export const drafts = pgTable("drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  mentionId: uuid("mention_id").notNull().references(() => mentions.id),
  aiText: text("ai_text"),
  userInput: text("user_input"),
  improvedText: text("improved_text"),
  finalText: text("final_text"),
  checks: jsonb("checks"),
  voiceVersion: integer("voice_version").notNull(),
  status: draftStatus("status").notNull().default("suggested"),
  createdAt: createdAt(),
});

export const snapshots = pgTable("snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: text("post_id").notNull(),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  score: integer("score"),
  numComments: integer("num_comments"),
  upvoteRatio: real("upvote_ratio"),
  simulated: boolean("simulated").notNull().default(false), // demo spike, labeled
}, (t) => [uniqueIndex("snapshots_post_time_idx").on(t.postId, t.takenAt)]);

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brands.id),
  postId: text("post_id").notNull(),
  kind: text("kind").notNull().default("spike"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const llmCalls = pgTable("llm_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").references(() => brands.id),
  purpose: text("purpose").notNull(), // relevance | triage | draft | improve
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  ok: boolean("ok").notNull().default(true),
  error: text("error"),
  createdAt: createdAt(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1), // single row
  emailRecipients: text("email_recipients").array().notNull().default([]),
  timezone: text("timezone").notNull().default("America/New_York"),
  digestHour: integer("digest_hour").notNull().default(8),
  monthlyApifyBudgetUsd: real("monthly_apify_budget_usd").notNull().default(5),
});

// Lease lock for /api/tick. The Neon HTTP driver has no sessions, so
// pg advisory locks would not hold across statements.
export const locks = pgTable("locks", {
  name: text("name").primaryKey(),
  holder: text("holder").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
