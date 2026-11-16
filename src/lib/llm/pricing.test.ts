import { describe, expect, it } from "vitest";
import { costUsd } from "./pricing";

describe("costUsd", () => {
  it("prices Sonnet 5.5 input, output and cache tokens", () => {
    // 1M input ($2) + 100k output ($1) + 1M cache read ($0.10) + 100k cache write ($0.25)
    expect(costUsd("claude-sonnet-5-5", {
      input_tokens: 1_000_000, output_tokens: 100_000,
      cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 100_000,
    })).toBeCloseTo(3.35, 6);
  });
  it("prices Haiku 5.5", () => {
    expect(costUsd("claude-haiku-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6, 6);
  });
});
