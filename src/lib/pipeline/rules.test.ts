import { describe, expect, it } from "vitest";
import { applyRules, compileRules, wordRegex, type RuleInput } from "./rules";
import { PELOTON } from "@/lib/brands/peloton";

const rules = compileRules(PELOTON);
const post = (over: Partial<RuleInput> = {}): RuleInput => ({
  kind: "post", title: "", body: "", subreddit: "pelotonfans", depth: 0, isDeleted: false, isBotLike: false, ...over,
});
const comment = (over: Partial<RuleInput> = {}): RuleInput => post({ kind: "comment", ...over });

describe("wordRegex", () => {
  const re = wordRegex(["Peloton"])!;
  it("matches the brand as a whole word, any case", () => {
    expect(re.test("My Peloton screen died")).toBe(true);
    expect(re.test("peloton app is down")).toBe(true);
    expect(re.test("Peloton's support")).toBe(true);
  });
  it("accepts plurals only when asked", () => {
    expect(wordRegex(["Peloton"], { plural: true })!.test("looked up a bunch of Pelotons")).toBe(true);
    expect(re.test("looked up a bunch of Pelotons")).toBe(false);
  });
  it("does not match inside other words or accented variants", () => {
    expect(re.test("pelotonics")).toBe(false);
    expect(re.test("el pelotón de ataque")).toBe(false);
  });
});

describe("applyRules", () => {
  it("keeps a brand post as a candidate", () => {
    expect(applyRules(post({ title: "Peloton trying to delay screen replacement" }), rules))
      .toEqual({ status: "candidate", isDirectMatch: true });
  });

  it("filters loose search hits that don't name the brand", () => {
    expect(applyRules(post({ title: "Purchased used connect sport" }), rules))
      .toMatchObject({ status: "filtered", reason: "no_brand_word" });
  });

  it("filters blocked subreddits even when the word matches", () => {
    expect(applyRules(post({ title: "Peloton splits on lap 3", subreddit: "cyclocross" }), rules))
      .toMatchObject({ status: "filtered", reason: "blocked_subreddit", isDirectMatch: true });
  });

  it("filters exclusion phrases", () => {
    expect(applyRules(post({ body: "the main peloton was 2 minutes back" }), rules))
      .toMatchObject({ status: "filtered", reason: "exclusion_term" });
  });

  it("checks deleted and bot items first", () => {
    expect(applyRules(post({ title: "Peloton", isDeleted: true }), rules)).toMatchObject({ reason: "deleted" });
    expect(applyRules(comment({ body: "Peloton rules reminder", isBotLike: true }), rules)).toMatchObject({ reason: "bot_or_mod" });
  });

  it("keeps non-mentioning comments in a brand thread as context", () => {
    const parent = applyRules(post({ title: "Peloton Bike+ worth it?" }), rules);
    expect(applyRules(comment({ body: "Return it" }), rules, parent)).toEqual({ status: "context", isDirectMatch: false });
  });

  it("comments inherit an off-brand thread, even if they say the word", () => {
    const parent = applyRules(post({ title: "Peloton results", subreddit: "cyclocross" }), rules);
    expect(applyRules(comment({ body: "the peloton was huge", subreddit: "cyclocross" }), rules, parent))
      .toMatchObject({ status: "filtered", reason: "blocked_subreddit" });
    const offBrand = { status: "filtered", reason: "thread_not_about_brand", isDirectMatch: false } as const;
    expect(applyRules(comment({ body: "Peloton!" }), rules, offBrand))
      .toMatchObject({ status: "filtered", reason: "thread_not_about_brand" });
  });

  it("uses a comment's own text, not its post title", () => {
    expect(applyRules(comment({ title: "Peloton thread", body: "agreed" }), rules))
      .toMatchObject({ status: "filtered", reason: "no_brand_word" });
  });

  it("an exclusion phrase only removes its own match (real case: 400+ FTP thread)", () => {
    const text = "Not sure if this group includes cycling on a Peloton. The main peloton groups are great";
    expect(applyRules(post({ title: "Working to a 400+ FTP", body: text, subreddit: "cycling" }), rules))
      .toEqual({ status: "candidate", isDirectMatch: true });
  });

  it("brand subreddit posts are on-topic without the word", () => {
    expect(applyRules(post({ title: "What happened to share to IG?", subreddit: "onepelotonrealsub" }), rules))
      .toEqual({ status: "candidate", isDirectMatch: false });
  });

  it("megathreads in brand subreddits: top-level comments are candidates, replies are context", () => {
    const thread = applyRules(post({ title: "Tech Support [Weekly]", subreddit: "pelotoncycle", isBotLike: true }), rules);
    expect(thread).toMatchObject({ status: "context", megathread: true });
    expect(applyRules(comment({ body: "My screen is flickering", subreddit: "pelotoncycle" }), rules, thread))
      .toEqual({ status: "candidate", isDirectMatch: false });
    expect(applyRules(comment({ body: "try a reboot", depth: 1, subreddit: "pelotoncycle" }), rules, thread))
      .toEqual({ status: "context", isDirectMatch: false });
  });

  it("bot posts outside brand subreddits are still filtered", () => {
    expect(applyRules(post({ title: "[Race thread] Peloton", subreddit: "cycling", isBotLike: true }), rules))
      .toMatchObject({ status: "filtered", reason: "bot_or_mod" });
  });
});
