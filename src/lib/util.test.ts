import { describe, expect, it } from "vitest";
import { z } from "zod";
import { blankToNaN, excerpt } from "./util";

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

describe("blankToNaN", () => {
  const budget = z.preprocess(blankToNaN, z.coerce.number({ error: "required" }).min(0));
  it("rejects a blank field instead of saving 0", () => {
    for (const v of ["", "  ", null]) expect(budget.safeParse(v).success).toBe(false);
  });
  it("still accepts real numbers, including 0", () => {
    expect(budget.parse("5")).toBe(5);
    expect(budget.parse("0")).toBe(0);
  });
});
