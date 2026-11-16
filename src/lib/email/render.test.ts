import { describe, expect, it } from "vitest";
import { digestSubject, renderDigest, renderSpikeAlert, type DigestBrand } from "./render";
import { localDay } from "./send";

const brand = (over: Partial<DigestBrand> = {}): DigestBrand => ({
  name: "Peloton", counts: { P0: 0, P1: 0, P2: 0, replies: 0 }, spikes: [], items: [], newToday: 0, ...over,
});

describe("digest", () => {
  it("says it's a quiet day when nothing needs attention", () => {
    const { html, text } = renderDigest([brand()], "2026-11-16", "https://app");
    expect(text).toContain("Quiet day");
    expect(html).toContain("Quiet day");
    expect(digestSubject([brand()], "2026-11-16")).toBe("Reddit digest 2026-11-16: nothing urgent");
  });

  it("lists items with importance, action, subreddit and a link", () => {
    const b = brand({
      counts: { P0: 1, P1: 2, P2: 0, replies: 1 },
      items: [{ id: "abc", importance: "P1", action: "reply", routeTo: "support", subreddit: "pelotoncycle", reason: "Screen failing", isNew: true }],
    });
    const { text } = renderDigest([b], "2026-11-16", "https://app");
    expect(text).toContain("[Today] Reply suggested · r/pelotoncycle · new: Screen failing https://app/m/abc");
    expect(digestSubject([b], "2026-11-16")).toBe("Reddit digest 2026-11-16: 1 urgent, 2 for today");
  });

  it("escapes Reddit text in HTML", () => {
    const b = brand({ counts: { P0: 1, P1: 0, P2: 0, replies: 0 },
      items: [{ id: "x", importance: "P0", action: "route", routeTo: null, subreddit: "s", reason: "<script>alert(1)</script>", isNew: false }] });
    const { html } = renderDigest([b], "d", "https://app");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("labels simulated spikes", () => {
    const alert = renderSpikeAlert({ brand: "Peloton", id: "1", title: "t", subreddit: "s", reason: "+60 comments", negative: true, simulated: true }, "https://app");
    expect(alert.subject).toContain("simulated");
  });
});

describe("localDay", () => {
  it("returns the date and hour in a time zone", () => {
    const d = new Date("2026-11-16T03:30:00Z");
    expect(localDay("America/New_York", d)).toEqual({ date: "2026-11-15", hour: 22 });
    expect(localDay("UTC", d)).toEqual({ date: "2026-11-16", hour: 3 });
  });
});
