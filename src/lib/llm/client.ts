// One place where Claude is called. Every call is logged with its token
// usage and cost, which feeds the cost page. Reddit text is always data,
// passed inside tags, and outputs are schema-constrained (prompt-injection defense).
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { db, schema } from "@/db";
import { costUsd, type Usage } from "./pricing";

export { costUsd };

export const MODELS = {
  relevance: "claude-haiku-5-5",
  triage: "claude-sonnet-5-5",
  draft: "claude-sonnet-5-5",
} as const;

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  client ??= new Anthropic({ maxRetries: 2 }); // retries 408/409/429/5xx
  return client;
}

export class LlmError extends Error {
  constructor(message: string, readonly kind: "refusal" | "unparseable" | "api") {
    super(message);
  }
}

type Call<S extends z.ZodType> = {
  purpose: "relevance" | "triage" | "draft" | "improve" | "eval" | "setup";
  brandId: string | null;
  model: string;
  /** Stable text (rubric + brand context). Cached: keep it byte-identical across calls. */
  system: string;
  /** Per-call content (the Reddit items). */
  user: string;
  schema: S;
  maxTokens: number;
  effort: "low" | "medium" | "high";
  /** Haiku 5.5 allows thinking off at effort ≤ high; Sonnet 5.5 doesn't. */
  thinkingOff?: boolean;
};

export async function structuredCall<S extends z.ZodType>(c: Call<S>): Promise<z.infer<S>> {
  const isSonnet55 = c.model === "claude-sonnet-5-5";
  let usage: Usage = { input_tokens: 0, output_tokens: 0 };
  let servedBy = c.model;
  try {
    const res = await anthropic().beta.messages.parse({
      model: c.model,
      max_tokens: c.maxTokens,
      system: [{ type: "text", text: c.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: c.user }],
      output_config: { effort: c.effort, format: betaZodOutputFormat(c.schema) },
      ...(c.thinkingOff ? { thinking: { type: "disabled" as const } } : {}),
      // Server-side refusal fallback on Sonnet 5.5. Haiku 5.5 has none.
      ...(isSonnet55 ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    usage = res.usage;
    servedBy = res.model ?? c.model;
    if (res.stop_reason === "refusal") {
      const d = res.stop_details;
      throw new LlmError(`refused${d?.category ? ` (${d.category})` : ""}`, "refusal");
    }
    if (res.parsed_output == null) {
      throw new LlmError(`could not parse output (stop_reason=${res.stop_reason})`, "unparseable");
    }
    await log(c, servedBy, usage, true, null);
    return res.parsed_output as z.infer<S>;
  } catch (e) {
    const err = e instanceof LlmError ? e : new LlmError(e instanceof Error ? e.message : String(e), "api");
    await log(c, servedBy, usage, false, `${err.kind}: ${err.message}`.slice(0, 500));
    throw err;
  }
}

async function log(c: Call<z.ZodType>, model: string, u: Usage, ok: boolean, error: string | null) {
  await db.insert(schema.llmCalls).values({
    brandId: c.brandId,
    purpose: c.purpose,
    model,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    costUsd: costUsd(model, u),
    ok,
    error,
  });
}
