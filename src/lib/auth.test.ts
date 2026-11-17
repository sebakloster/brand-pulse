import { afterEach, describe, expect, it, vi } from "vitest";
import { isCronRequest, safeNext } from "./auth";

describe("safeNext", () => {
  it("keeps local paths", () => {
    expect(safeNext("/b/123?view=done")).toBe("/b/123?view=done");
  });

  it("refuses anything a browser would treat as another site", () => {
    for (const next of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/\tevil", ""]) {
      expect(safeNext(next)).toBe("/");
    }
  });
});

describe("isCronRequest", () => {
  afterEach(() => vi.unstubAllEnvs());
  const req = (auth?: string) => new Request("https://x/api/tick", { headers: auth ? { authorization: auth } : {} });

  it("needs the exact bearer secret", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isCronRequest(req("Bearer s3cret"))).toBe(true);
    expect(isCronRequest(req("Bearer nope"))).toBe(false);
    expect(isCronRequest(req())).toBe(false);
  });

  it("refuses everything when no secret is configured", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isCronRequest(req("Bearer "))).toBe(false);
  });
});
