// Free, deterministic filters that run before any AI call.
// Pure functions: easy to unit test and to explain.
import type { NormalizedMention } from "@/lib/reddit/normalize";

export type BrandRules = {
  searchTerms: string[];
  exclusionTerms: string[];
  blockedSubreddits: string[];
  /** Communities about the brand: posts there are on-topic even without the brand word. */
  brandSubreddits: string[];
};

export type RuleOutcome =
  | { status: "candidate"; isDirectMatch: boolean } // false: on-topic by place (brand subreddit / megathread)
  // Kept only as context for triage. `megathread`: a bot/mod post in a brand subreddit
  // (e.g. "Daily Discussion"); its top-level comments are each their own topic.
  | { status: "context"; isDirectMatch: false; megathread?: true }
  | { status: "filtered"; reason: FilterReason; isDirectMatch: boolean };

export type FilterReason =
  | "deleted"
  | "bot_or_mod"
  | "blocked_subreddit"
  | "exclusion_term"
  | "no_brand_word" // the Actor's search is loose; the item's own text must name the brand
  | "thread_not_about_brand"; // comment in a thread the relevance step judged off-brand

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word, case-insensitive match. Unicode-aware so "pelotón" is not "peloton".
 * `plural` also accepts a trailing "s" ("a bunch of Pelotons").
 */
export function wordRegex(terms: string[], { plural = false } = {}): RegExp | null {
  const cleaned = terms.map((t) => t.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  const s = plural ? "s?" : "";
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${cleaned.map(escape).join("|")})${s}(?![\\p{L}\\p{N}_])`, "iu");
}

export function normalizeSubreddit(s: string) {
  return s.trim().replace(/^\/?r\//i, "").toLowerCase();
}

export function ownText(m: Pick<RuleInput, "kind" | "title" | "body">) {
  // For comments, `title` is the post title; it is not the comment's own text.
  return m.kind === "post" ? `${m.title ?? ""}\n${m.body ?? ""}` : (m.body ?? "");
}

export function compileRules(rules: BrandRules) {
  const exclusion = wordRegex(rules.exclusionTerms);
  return {
    brand: wordRegex(rules.searchTerms, { plural: true }),
    exclusion,
    exclusionGlobal: exclusion ? new RegExp(exclusion.source, "giu") : null,
    blocked: new Set(rules.blockedSubreddits.map(normalizeSubreddit)),
    brandSubs: new Set(rules.brandSubreddits.map(normalizeSubreddit)),
  };
}
export type CompiledRules = ReturnType<typeof compileRules>;

// A comment in a thread that is off-brand by these reasons is off-brand too,
// even if it says "Peloton" (e.g. "the peloton caught the breakaway").
const INHERITED = new Set<FilterReason>(["blocked_subreddit", "exclusion_term", "thread_not_about_brand"]);

export type RuleInput = Pick<NormalizedMention, "kind" | "title" | "body" | "subreddit" | "depth" | "isDeleted" | "isBotLike">;

/**
 * Order matters and is part of the story: cheapest, most certain rules first.
 * `postOutcome` is the outcome of the comment's post, when the post is in our data:
 * comments inherit a blocked/excluded post (no point triaging replies in an off-brand thread).
 */
export function applyRules(
  m: RuleInput,
  rules: CompiledRules,
  postOutcome?: RuleOutcome,
): RuleOutcome {
  const text = ownText(m);
  const isDirectMatch = rules.brand ? rules.brand.test(text) : false;
  const inBrandSub = rules.brandSubs.has(m.subreddit);

  if (m.isDeleted) return { status: "filtered", reason: "deleted", isDirectMatch };
  if (m.isBotLike) {
    // AutoModerator's "Daily Discussion" / "Tech Support" posts in a brand community hold real questions.
    if (m.kind === "post" && inBrandSub) return { status: "context", isDirectMatch: false, megathread: true };
    return { status: "filtered", reason: "bot_or_mod", isDirectMatch };
  }
  if (rules.blocked.has(m.subreddit)) return { status: "filtered", reason: "blocked_subreddit", isDirectMatch };

  // An exclusion phrase only removes its own match. "the main peloton groups are great… on a
  // Peloton" still names the brand, so it stays.
  if (rules.exclusion?.test(text)) {
    const rest = text.replace(rules.exclusionGlobal!, " ");
    if (!rules.brand?.test(rest)) return { status: "filtered", reason: "exclusion_term", isDirectMatch };
  }

  if (m.kind === "comment" && postOutcome?.status === "filtered" && INHERITED.has(postOutcome.reason)) {
    return { status: "filtered", reason: postOutcome.reason, isDirectMatch };
  }

  if (isDirectMatch) return { status: "candidate", isDirectMatch: true };
  // In a brand community, a post is on-topic; so is a comment whose thread we don't have.
  if (inBrandSub && (m.kind === "post" || !postOutcome)) return { status: "candidate", isDirectMatch: false };
  if (m.kind === "comment" && postOutcome?.status === "context" && postOutcome.megathread) {
    return m.depth === 0 ? { status: "candidate", isDirectMatch: false } : { status: "context", isDirectMatch: false };
  }
  // A comment that doesn't name the brand but sits in a brand thread we have: keep it as context.
  if (m.kind === "comment" && postOutcome?.status === "candidate") return { status: "context", isDirectMatch: false };
  return { status: "filtered", reason: "no_brand_word", isDirectMatch: false };
}
