import { describe, expect, it } from "vitest";
import { excerpt } from "./util";

describe("excerpt", () => {
  const long = `${"knee rehab story. ".repeat(100)}Today I went 100% on my Peloton and pushed through.${" more text.".repeat(50)}`;
  it("keeps the brand mention that plain truncation would cut", () => {
    expect(long.slice(0, 1200)).not.toMatch(/Peloton/);
    const out = excerpt(long, 1200, /peloton/i);
    expect(out).toMatch(/100% on my Peloton/);
    expect(out.startsWith("knee rehab story.")).toBe(true);
    expect(out.length).toBeLessThan(1300);
  });
  it("returns short text unchanged", () => {
    expect(excerpt("short Peloton text", 1200, /peloton/i)).toBe("short Peloton text");
  });
});
