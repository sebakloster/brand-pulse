import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseItem } from "./normalize";

const fixture: unknown[] = JSON.parse(
  readFileSync(path.join(process.cwd(), "fixture/peloton-2026-11-16.json"), "utf8"),
);

describe("parseItem on the real Peloton fixture", () => {
  const results = fixture.map(parseItem);

  it("validates every item", () => {
    const failures = results.filter((r) => !r.ok);
    expect(failures).toEqual([]);
  });

  it("finds 50 posts and 1,124 comments with unique ids", () => {
    const ok = results.flatMap((r) => (r.ok ? [r.mention] : []));
    expect(ok.filter((m) => m.kind === "post")).toHaveLength(50);
    expect(ok.filter((m) => m.kind === "comment")).toHaveLength(1124);
    expect(new Set(ok.map((m) => m.redditId)).size).toBe(1174);
  });

  it("links comments to their post and parent with type prefixes", () => {
    const c = results.find((r) => r.ok && r.mention.kind === "comment" && r.mention.depth > 0);
    expect(c?.ok && c.mention.postId).toMatch(/^t3_/);
    expect(c?.ok && c.mention.parentId).toMatch(/^t1_/);
  });

  it("marks AutoModerator as bot-like", () => {
    const bots = results.filter((r) => r.ok && r.mention.author === "AutoModerator");
    expect(bots.length).toBeGreaterThan(0);
    expect(bots.every((r) => r.ok && r.mention.isBotLike)).toBe(true);
  });
});

describe("parseItem edge cases", () => {
  it("rejects items without an id instead of throwing", () => {
    expect(parseItem({ dataType: "post" }).ok).toBe(false);
    expect(parseItem(null).ok).toBe(false);
  });

  it("treats [deleted]/[removed] text as deleted", () => {
    const r = parseItem({
      dataType: "comment", id: "abc", parsedPostId: "p1", subredditName: "pelotoncycle",
      commentCreatedAt: "2026-11-15T00:00:00.000Z", body: "[removed]",
    });
    expect(r.ok && r.mention.isDeleted).toBe(true);
  });

  const comment = { dataType: "comment", id: "abc", parsedPostId: "p1", subredditName: "pelotoncycle", commentCreatedAt: "2026-11-15T00:00:00.000Z" };

  it("rejects an unparseable date instead of failing the whole ingest", () => {
    expect(parseItem({ ...comment, commentCreatedAt: "yesterday-ish" }).ok).toBe(false);
    expect(parseItem({ ...comment, crawledAt: "not a date" }).ok).toBe(false);
  });

  it("keeps only http(s) links, since they are rendered as hrefs", () => {
    const bad = parseItem({ ...comment, url: "javascript:alert(1)" });
    expect(bad.ok && bad.mention.url).toBeNull();
    const good = parseItem({ ...comment, url: "https://www.reddit.com/r/x/comments/1/abc" });
    expect(good.ok && good.mention.url).toBe("https://www.reddit.com/r/x/comments/1/abc");
  });
});
