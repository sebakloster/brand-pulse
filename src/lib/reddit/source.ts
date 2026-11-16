// RedditSource hides where Reddit data comes from. Today: an Apify Actor,
// or a saved dataset replayed for demos, tests and evals. A licensed
// provider would be a third implementation of the same interface.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ApifyClient } from "apify-client";

export type SearchInput = {
  searchTerms: string[];
  postedAfter: Date; // posts on or after
  commentedAfter: Date; // comments on or after (comment search)
  maxPostsCount: number;
  maxCommentsPerPost: number;
  maxCommentsCount: number;
  maxTotalChargeUsd: number; // hard spend cap per run
};

export type RunState = {
  status: "running" | "succeeded" | "failed" | "timed_out";
  costUsd: number | null;
  itemsCount: number | null;
  error: string | null;
};

export interface RedditSource {
  readonly kind: "apify" | "fixture";
  /** Starts a search run and returns its id. Never waits for it to finish. */
  startSearch(input: SearchInput): Promise<{ externalId: string; input: unknown }>;
  getRun(externalId: string): Promise<RunState>;
  /** Yields the run's items page by page. */
  items(externalId: string, pageSize?: number): AsyncGenerator<unknown[]>;
}

// ---------------------------------------------------------------------------
// Fixture: replays a saved Actor dataset through the same code path.

const FIXTURE_DIR = path.join(process.cwd(), "fixture");

export class FixtureSource implements RedditSource {
  readonly kind = "fixture" as const;
  constructor(private readonly file = "peloton-2026-11-16.json") {}

  async startSearch(input: SearchInput) {
    return { externalId: `fixture:${this.file}`, input: { ...input, fixture: this.file } };
  }

  async getRun(externalId: string): Promise<RunState> {
    const items = await this.load(externalId);
    return { status: "succeeded", costUsd: 0, itemsCount: items.length, error: null };
  }

  async *items(externalId: string, pageSize = 500) {
    const items = await this.load(externalId);
    for (let i = 0; i < items.length; i += pageSize) yield items.slice(i, i + pageSize);
  }

  private async load(externalId: string): Promise<unknown[]> {
    const file = path.basename(externalId.replace(/^fixture:/, "")); // no path traversal
    return JSON.parse(await readFile(path.join(FIXTURE_DIR, file), "utf8"));
  }
}

// ---------------------------------------------------------------------------
// Apify: harshmaur/reddit-scraper.

export const APIFY_ACTOR = "harshmaur/reddit-scraper";

export function buildActorInput(input: SearchInput) {
  return {
    searchTerms: input.searchTerms,
    searchPosts: true,
    searchComments: true,
    searchSort: "new",
    postedAfter: input.postedAfter.toISOString(),
    commentedAfter: input.commentedAfter.toISOString(),
    crawlCommentsPerPost: true,
    maxPostsCount: input.maxPostsCount,
    maxCommentsPerPost: input.maxCommentsPerPost,
    maxCommentsCount: input.maxCommentsCount,
    includeNSFW: false,
    // Classification is our job, not the Actor's.
    aiAnalysis: false,
    hasPain: false,
    wantsHelp: false,
  };
}

export class ApifySource implements RedditSource {
  readonly kind = "apify" as const;
  private client: ApifyClient;

  constructor(token = process.env.APIFY_TOKEN) {
    if (!token) throw new Error("APIFY_TOKEN is not set (or use REDDIT_SOURCE=fixture).");
    this.client = new ApifyClient({ token });
  }

  async startSearch(input: SearchInput) {
    const actorInput = buildActorInput(input);
    const run = await this.client.actor(APIFY_ACTOR).start(actorInput, {
      maxTotalChargeUsd: input.maxTotalChargeUsd,
    });
    return { externalId: run.id, input: actorInput };
  }

  async getRun(externalId: string): Promise<RunState> {
    const run = await this.client.run(externalId).get();
    if (!run) return { status: "failed", costUsd: null, itemsCount: null, error: "run not found" };
    const costUsd = typeof run.usageTotalUsd === "number" ? run.usageTotalUsd : null;
    const map: Record<string, RunState["status"]> = {
      READY: "running", RUNNING: "running", SUCCEEDED: "succeeded",
      FAILED: "failed", ABORTING: "failed", ABORTED: "failed",
      "TIMING-OUT": "timed_out", "TIMED-OUT": "timed_out",
    };
    const status = map[run.status] ?? "running";
    let itemsCount: number | null = null;
    if (status === "succeeded") {
      const ds = await this.client.dataset(run.defaultDatasetId).get();
      itemsCount = ds?.itemCount ?? null;
    }
    return {
      status,
      costUsd,
      itemsCount,
      error: status === "failed" || status === "timed_out" ? (run.statusMessage ?? run.status) : null,
    };
  }

  async *items(externalId: string, pageSize = 500) {
    const run = await this.client.run(externalId).get();
    if (!run) return;
    const ds = this.client.dataset(run.defaultDatasetId);
    for (let offset = 0; ; offset += pageSize) {
      const page = await ds.listItems({ offset, limit: pageSize, clean: true });
      if (page.items.length === 0) return;
      yield page.items as unknown[];
      if (page.items.length < pageSize) return;
    }
  }
}

export function getRedditSource(kind = process.env.REDDIT_SOURCE ?? "fixture"): RedditSource {
  return kind === "apify" ? new ApifySource() : new FixtureSource();
}
